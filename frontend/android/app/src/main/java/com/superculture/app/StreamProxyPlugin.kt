package com.superculture.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.lang.ref.WeakReference

@CapacitorPlugin(name = "StreamProxy")
class StreamProxyPlugin : Plugin() {

    companion object {
        private var instanceRef: WeakReference<StreamProxyPlugin>? = null

        @JvmStatic
        fun emitMediaAction(action: String, seekTime: Double?) {
            val plugin = instanceRef?.get() ?: return
            val payload = JSObject().apply {
                put("action", action)
                if (seekTime != null) {
                    put("seekTime", seekTime)
                }
            }
            plugin.notifyListeners("mediaAction", payload, true)
        }
    }

    override fun load() {
        super.load()
        instanceRef = WeakReference(this)
    }

    @PluginMethod
    fun getProxyUrl(call: PluginCall) {
        val port = LocalStreamProxy.start(context)
        val secret = LocalStreamProxy.secret
        val ret = JSObject()
        ret.put("baseUrl", "http://127.0.0.1:$port")
        ret.put("port", port)
        ret.put("secret", secret)
        call.resolve(ret)
    }

    @PluginMethod
    fun getProxyPort(call: PluginCall) {
        val port = LocalStreamProxy.start(context)
        val secret = LocalStreamProxy.secret
        val ret = JSObject()
        ret.put("port", port)
        ret.put("baseUrl", "http://127.0.0.1:$port")
        ret.put("secret", secret)
        call.resolve(ret)
    }

    @PluginMethod
    fun updateMetadata(call: PluginCall) {
        val title = call.getString("title", "Super Culture") ?: "Super Culture"
        val artist = call.getString("artist", "Super Culture Radio") ?: "Super Culture Radio"
        val album = call.getString("album", "Super Culture Stream") ?: "Super Culture Stream"
        val artworkUrl = call.getString("artworkUrl", "") ?: ""
        val duration = call.getDouble("duration", 0.0) ?: 0.0

        context?.let { ctx ->
            MediaPlaybackService.updateMetadata(ctx, title, artist, album, artworkUrl, duration)
        }
        call.resolve()
    }

    @PluginMethod
    fun updatePlaybackState(call: PluginCall) {
        val isPlaying = call.getBoolean("isPlaying", true) ?: true
        val position = call.getDouble("position", 0.0) ?: 0.0
        val duration = call.getDouble("duration", 0.0) ?: 0.0

        context?.let { ctx ->
            MediaPlaybackService.updatePlaybackState(ctx, isPlaying, position, duration)
        }
        call.resolve()
    }

    @PluginMethod
    fun startForegroundService(call: PluginCall) {
        val title = call.getString("title", "Super Culture") ?: "Super Culture"
        val artist = call.getString("artist", "Playing Audio") ?: "Playing Audio"
        context?.let { ctx ->
            MediaPlaybackService.start(ctx, title, artist)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopForegroundService(call: PluginCall) {
        context?.let { ctx ->
            MediaPlaybackService.stop(ctx)
        }
        call.resolve()
    }
}
