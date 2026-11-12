package com.superculture.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MediaPlaybackService : Service() {

    companion object {
        private const val TAG = "MediaPlaybackService"
        const val CHANNEL_ID = "superculture_playback"
        const val NOTIFICATION_ID = 1001

        const val ACTION_UPDATE_METADATA = "com.superculture.app.ACTION_UPDATE_METADATA"
        const val ACTION_UPDATE_STATE = "com.superculture.app.ACTION_UPDATE_STATE"
        const val ACTION_STOP_SERVICE = "com.superculture.app.ACTION_STOP_SERVICE"

        const val ACTION_NOTIFICATION_PLAY = "com.superculture.app.NOTIF_PLAY"
        const val ACTION_NOTIFICATION_PAUSE = "com.superculture.app.NOTIF_PAUSE"
        const val ACTION_NOTIFICATION_NEXT = "com.superculture.app.NOTIF_NEXT"
        const val ACTION_NOTIFICATION_PREV = "com.superculture.app.NOTIF_PREV"

        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_ARTIST = "extra_artist"
        const val EXTRA_ALBUM = "extra_album"
        const val EXTRA_ARTWORK_URL = "extra_artwork_url"
        const val EXTRA_DURATION = "extra_duration"
        const val EXTRA_IS_PLAYING = "extra_is_playing"
        const val EXTRA_POSITION = "extra_position"

        const val WAKELOCK_TIMEOUT_MS = 10 * 60 * 1000L // 10 minutes
        const val PAUSE_RELEASE_TIMEOUT_MS = 5 * 60 * 1000L // 5 minutes
        const val ACTION_REFRESH_WAKELOCK = "com.superculture.app.ACTION_REFRESH_WAKELOCK"

        @Volatile
        private var instance: MediaPlaybackService? = null

        @JvmStatic
        @JvmOverloads
        fun refreshWakeLock(context: Context? = null) {
            val service = instance
            if (service != null) {
                service.mainHandler.post {
                    service.onChunksFlowing()
                }
            } else if (context != null) {
                val intent = Intent(context, MediaPlaybackService::class.java).apply {
                    action = ACTION_REFRESH_WAKELOCK
                }
                startServiceSafely(context, intent)
            }
        }

        @JvmStatic
        fun updateMetadata(
            context: Context,
            title: String,
            artist: String,
            album: String,
            artworkUrl: String,
            durationSec: Double
        ) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_UPDATE_METADATA
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_ARTIST, artist)
                putExtra(EXTRA_ALBUM, album)
                putExtra(EXTRA_ARTWORK_URL, artworkUrl)
                putExtra(EXTRA_DURATION, durationSec)
            }
            startServiceSafely(context, intent)
        }

        @JvmStatic
        fun updatePlaybackState(
            context: Context,
            isPlaying: Boolean,
            positionSec: Double,
            durationSec: Double
        ) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_UPDATE_STATE
                putExtra(EXTRA_IS_PLAYING, isPlaying)
                putExtra(EXTRA_POSITION, positionSec)
                putExtra(EXTRA_DURATION, durationSec)
            }
            startServiceSafely(context, intent)
        }

        @JvmStatic
        fun start(context: Context, title: String, artist: String) {
            updateMetadata(context, title, artist, "Super Culture", "", 0.0)
        }

        @JvmStatic
        fun stop(context: Context) {
            val intent = Intent(context, MediaPlaybackService::class.java).apply {
                action = ACTION_STOP_SERVICE
            }
            context.stopService(intent)
        }

        private fun startServiceSafely(context: Context, intent: Intent) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to start MediaPlaybackService: ${e.message}")
            }
        }
    }

    private var mediaSession: MediaSession? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val artworkExecutor = Executors.newSingleThreadExecutor()

    private var currentTitle: String = "Super Culture"
    private var currentArtist: String = "Super Culture Radio"
    private var currentAlbum: String = "Super Culture Stream"
    private var currentArtworkUrl: String = ""
    private var currentArtworkBitmap: Bitmap? = null
    private var currentDurationMs: Long = 0L
    private var currentPositionMs: Long = 0L
    private var currentIsPlaying: Boolean = true
    private var isForegroundStarted: Boolean = false

    private val delayedReleaseRunnable = Runnable {
        if (!currentIsPlaying) {
            Log.i(TAG, "Paused for > 5 minutes; releasing wake locks and stopping foreground mode.")
            releaseLocks()
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping foreground mode: ${e.message}")
            }
            isForegroundStarted = false
        }
    }

    fun onChunksFlowing() {
        currentIsPlaying = true
        mainHandler.removeCallbacks(delayedReleaseRunnable)
        acquireLocks()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        initLocks()
        initMediaSession()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_SERVICE -> {
                releaseLocks()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                isForegroundStarted = false
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_REFRESH_WAKELOCK -> {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                return START_STICKY
            }

            ACTION_NOTIFICATION_PLAY -> {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                updateMediaSessionPlaybackState()
                ensureForeground()
                StreamProxyPlugin.emitMediaAction("play", null)
                return START_STICKY
            }

            ACTION_NOTIFICATION_PAUSE -> {
                currentIsPlaying = false
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                mainHandler.postDelayed(delayedReleaseRunnable, PAUSE_RELEASE_TIMEOUT_MS)
                updateMediaSessionPlaybackState()
                ensureForeground()
                StreamProxyPlugin.emitMediaAction("pause", null)
                return START_STICKY
            }

            ACTION_NOTIFICATION_NEXT -> {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                updateMediaSessionPlaybackState()
                ensureForeground()
                StreamProxyPlugin.emitMediaAction("next", null)
                return START_STICKY
            }

            ACTION_NOTIFICATION_PREV -> {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                updateMediaSessionPlaybackState()
                ensureForeground()
                StreamProxyPlugin.emitMediaAction("previous", null)
                return START_STICKY
            }

            ACTION_UPDATE_METADATA -> {
                currentTitle = intent.getStringExtra(EXTRA_TITLE) ?: currentTitle
                currentArtist = intent.getStringExtra(EXTRA_ARTIST) ?: currentArtist
                currentAlbum = intent.getStringExtra(EXTRA_ALBUM) ?: currentAlbum
                val newArtUrl = intent.getStringExtra(EXTRA_ARTWORK_URL) ?: ""
                val durSec = intent.getDoubleExtra(EXTRA_DURATION, 0.0)
                if (durSec > 0) {
                    currentDurationMs = (durSec * 1000.0).toLong()
                }

                // Always acquire locks and cancel any pending pause timeout on track metadata update
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                currentIsPlaying = true
                acquireLocks()

                if (newArtUrl.isNotEmpty() && newArtUrl != currentArtworkUrl) {
                    currentArtworkUrl = newArtUrl
                    fetchArtworkAsync(newArtUrl)
                }

                updateMediaSessionMetadata()
                updateMediaSessionPlaybackState()
                ensureForeground()
            }

            ACTION_UPDATE_STATE -> {
                currentIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true)
                val posSec = intent.getDoubleExtra(EXTRA_POSITION, -1.0)
                if (posSec >= 0) {
                    currentPositionMs = (posSec * 1000.0).toLong()
                }
                val durSec = intent.getDoubleExtra(EXTRA_DURATION, -1.0)
                if (durSec > 0) {
                    currentDurationMs = (durSec * 1000.0).toLong()
                }

                mainHandler.removeCallbacks(delayedReleaseRunnable)
                if (currentIsPlaying) {
                    acquireLocks()
                } else {
                    // Hold wake lock across brief pauses / track transitions; release only after 5 min
                    mainHandler.postDelayed(delayedReleaseRunnable, PAUSE_RELEASE_TIMEOUT_MS)
                }

                updateMediaSessionMetadata()
                updateMediaSessionPlaybackState()
                ensureForeground()
            }

            else -> {
                acquireLocks()
                ensureForeground()
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        if (instance == this) {
            instance = null
        }
        mainHandler.removeCallbacks(delayedReleaseRunnable)
        releaseLocks()
        try {
            mediaSession?.isActive = false
            mediaSession?.release()
        } catch (_: Exception) {}
        mediaSession = null
        super.onDestroy()
    }

    private fun initLocks() {
        try {
            val pm = applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = pm?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "SuperCulture::MediaPlaybackWakeLock"
            )?.apply {
                setReferenceCounted(false)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not create WakeLock: ${e.message}")
        }

        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val wifiMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                WifiManager.WIFI_MODE_FULL_LOW_LATENCY
            } else {
                @Suppress("DEPRECATION")
                WifiManager.WIFI_MODE_FULL_HIGH_PERF
            }
            wifiLock = wm?.createWifiLock(wifiMode, "SuperCulture::MediaPlaybackWifiLock")?.apply {
                setReferenceCounted(false)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not create WifiLock: ${e.message}")
        }
    }

    fun acquireLocks() {
        try {
            wakeLock?.acquire(WAKELOCK_TIMEOUT_MS)
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock acquire error: ${e.message}")
        }
        try {
            if (wifiLock?.isHeld == false) {
                wifiLock?.acquire()
            }
        } catch (e: Exception) {
            Log.w(TAG, "WifiLock acquire error: ${e.message}")
        }
    }

    private fun releaseLocks() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {}
        try {
            if (wifiLock?.isHeld == true) {
                wifiLock?.release()
            }
        } catch (_: Exception) {}
    }

    private fun initMediaSession() {
        val session = MediaSession(this, "SuperCultureMediaSession")
        session.setCallback(object : MediaSession.Callback() {
            override fun onPlay() {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                updateMediaSessionPlaybackState()
                ensureForeground()
                StreamProxyPlugin.emitMediaAction("play", null)
            }

            override fun onPause() {
                currentIsPlaying = false
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                mainHandler.postDelayed(delayedReleaseRunnable, PAUSE_RELEASE_TIMEOUT_MS)
                updateMediaSessionPlaybackState()
                ensureForeground()
                StreamProxyPlugin.emitMediaAction("pause", null)
            }

            override fun onSkipToNext() {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                StreamProxyPlugin.emitMediaAction("next", null)
            }

            override fun onSkipToPrevious() {
                currentIsPlaying = true
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                acquireLocks()
                StreamProxyPlugin.emitMediaAction("previous", null)
            }

            override fun onSeekTo(pos: Long) {
                currentPositionMs = pos
                updateMediaSessionPlaybackState()
                StreamProxyPlugin.emitMediaAction("seekTo", pos / 1000.0)
            }

            override fun onStop() {
                currentIsPlaying = false
                mainHandler.removeCallbacks(delayedReleaseRunnable)
                mainHandler.postDelayed(delayedReleaseRunnable, PAUSE_RELEASE_TIMEOUT_MS)
                updateMediaSessionPlaybackState()
                StreamProxyPlugin.emitMediaAction("pause", null)
            }
        })
        session.isActive = true
        mediaSession = session
    }

    private fun updateMediaSessionMetadata() {
        val session = mediaSession ?: return
        val builder = MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, currentAlbum)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, currentDurationMs)

        currentArtworkBitmap?.let { bmp ->
            builder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, bmp)
            builder.putBitmap(MediaMetadata.METADATA_KEY_ART, bmp)
        }

        session.setMetadata(builder.build())
    }

    private fun updateMediaSessionPlaybackState() {
        val session = mediaSession ?: return
        val actions = PlaybackState.ACTION_PLAY or
                PlaybackState.ACTION_PAUSE or
                PlaybackState.ACTION_PLAY_PAUSE or
                PlaybackState.ACTION_SKIP_TO_NEXT or
                PlaybackState.ACTION_SKIP_TO_PREVIOUS or
                PlaybackState.ACTION_SEEK_TO or
                PlaybackState.ACTION_STOP

        val stateCode = if (currentIsPlaying) {
            PlaybackState.STATE_PLAYING
        } else {
            PlaybackState.STATE_PAUSED
        }

        val playbackState = PlaybackState.Builder()
            .setActions(actions)
            .setState(
                stateCode,
                currentPositionMs,
                if (currentIsPlaying) 1.0f else 0.0f,
                SystemClock.elapsedRealtime()
            )
            .build()

        session.setPlaybackState(playbackState)
    }

    private fun fetchArtworkAsync(url: String) {
        artworkExecutor.execute {
            var conn: HttpURLConnection? = null
            try {
                conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 6000
                conn.readTimeout = 6000
                conn.doInput = true
                conn.connect()
                if (conn.responseCode in 200..299) {
                    val bmp = BitmapFactory.decodeStream(conn.inputStream)
                    if (bmp != null && url == currentArtworkUrl) {
                        mainHandler.post {
                            currentArtworkBitmap = bmp
                            updateMediaSessionMetadata()
                            ensureForeground()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.d(TAG, "Artwork fetch skipped: ${e.message}")
            } finally {
                try {
                    conn?.disconnect()
                } catch (_: Exception) {}
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Super Culture Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Lock-screen and background audio controls"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun servicePendingIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, MediaPlaybackService::class.java).apply {
            this.action = action
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getService(this, requestCode, intent, flags)
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        val prevAction = Notification.Action.Builder(
            android.R.drawable.ic_media_previous,
            "Previous",
            servicePendingIntent(ACTION_NOTIFICATION_PREV, 101)
        ).build()

        val playPauseAction = if (currentIsPlaying) {
            Notification.Action.Builder(
                android.R.drawable.ic_media_pause,
                "Pause",
                servicePendingIntent(ACTION_NOTIFICATION_PAUSE, 102)
            ).build()
        } else {
            Notification.Action.Builder(
                android.R.drawable.ic_media_play,
                "Play",
                servicePendingIntent(ACTION_NOTIFICATION_PLAY, 103)
            ).build()
        }

        val nextAction = Notification.Action.Builder(
            android.R.drawable.ic_media_next,
            "Next",
            servicePendingIntent(ACTION_NOTIFICATION_NEXT, 104)
        ).build()

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        val mediaStyle = Notification.MediaStyle()
            .setShowActionsInCompactView(0, 1, 2)
        mediaSession?.sessionToken?.let { token ->
            mediaStyle.setMediaSession(token)
        }

        builder
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSubText(currentAlbum)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(currentIsPlaying)
            .setStyle(mediaStyle)
            .addAction(prevAction)
            .addAction(playPauseAction)
            .addAction(nextAction)

        currentArtworkBitmap?.let { bmp ->
            builder.setLargeIcon(bmp)
        }

        return builder.build()
    }

    private fun ensureForeground() {
        val notification = buildNotification()
        try {
            if (!isForegroundStarted) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                isForegroundStarted = true
            } else {
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                manager?.notify(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "ensureForeground error: ${e.message}")
        }
    }
}
