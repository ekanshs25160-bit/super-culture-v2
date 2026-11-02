import { useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useUiStore } from '../store/useUiStore';
import { useJamStore } from '../store/useJamStore';
import { apiClient } from '../services/api';
import PlayerTransport from './player/PlayerTransport';
import PlayerUtilities from './player/PlayerUtilities';
import CoverImage from './shared/CoverImage';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function PlayerBar() {
  const {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    isRepeat,
    isEmptyPlayer,
    toastMessage,
    playTrack,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    setVolumeLevel,
    toggleShuffle,
    toggleRepeat,
    showToast,
  } = useContext(AudioContext);

  const isLiked = useLibraryStore((s) => s.isLiked(currentTrack?.videoId || currentTrack?.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const openAddToPlaylist = useUiStore((s) => s.openAddToPlaylist);
  const navigate = useNavigate();

  const currentRoom = useJamStore((s) => s.currentRoom);
  const broadcastPlay = useJamStore((s) => s.broadcastPlay);
  const broadcastPause = useJamStore((s) => s.broadcastPause);
  const broadcastSeek = useJamStore((s) => s.broadcastSeek);
  const broadcastTrackChange = useJamStore((s) => s.broadcastTrackChange);

  const progressTrackRef = useRef(null);
  const volumeTrackRef = useRef(null);
  const [serverUpNext, setServerUpNext] = useState(null);
  const lastLoggedRef = useRef(null);

  // Active queue next track
  const currentIndex = queue.findIndex(
    (t) => t.id === currentTrack?.id || (currentTrack?.videoId && t.videoId === currentTrack.videoId)
  );
  const queueNextTrack = queue.length > 1
    ? queue[(currentIndex + 1 + queue.length) % queue.length]
    : queue[0] || currentTrack;

  // Real server-backed up-next track recommendation & history logging
  useEffect(() => {
    if (!currentTrack?.videoId) return;

    let isMounted = true;
    const fetchUpNext = async () => {
      try {
        const res = await apiClient.music.getUpNext(currentTrack.videoId);
        if (isMounted && res?.tracks?.length > 0) {
          const raw = res.tracks[0];
          setServerUpNext({
            ...raw,
            id: raw.videoId || raw.id,
            cover: raw.cover || raw.thumbnailUrl || raw.thumbnail_url,
          });
        }
      } catch (err) {
        console.warn('[PlayerBar] UpNext error:', err);
      }
    };

    fetchUpNext();

    const trackKey = `${currentTrack.videoId || currentTrack.id}_${currentTrack.title}`;
    if (isPlaying && lastLoggedRef.current !== trackKey) {
      lastLoggedRef.current = trackKey;
      apiClient.ai.logHistory({
        title: currentTrack.title,
        artist: currentTrack.artist,
        videoId: currentTrack.videoId || currentTrack.id,
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [currentTrack, isPlaying]);

  // Next track prioritized from real active queue when multiple tracks exist
  const nextTrack = (queue && queue.length > 1) ? queueNextTrack : (serverUpNext || queueNextTrack);

  const handleLikeClick = (e) => {
    e.stopPropagation();
    if (!currentTrack) return;
    const wasLiked = isLiked;
    toggleLike(currentTrack);
    showToast(!wasLiked ? 'Saved to Liked Songs' : 'Removed from Liked Songs');
  };

  const handleMasterPlay = () => {
    if (currentRoom) {
      if (isPlaying) {
        broadcastPause(currentTime);
      } else {
        broadcastPlay(currentTime);
      }
    }
    togglePlay();
  };

  const handleSkipNext = () => {
    if (currentRoom && nextTrack) {
      broadcastTrackChange(nextTrack);
    }
    skipNext();
  };

  const handleNextClick = () => {
    if (queue.length > 1) {
      handleSkipNext();
    } else if (serverUpNext) {
      if (currentRoom) {
        broadcastTrackChange(serverUpNext);
      }
      playTrack(serverUpNext);
    } else {
      handleSkipNext();
    }
  };

  const currentSeconds = Math.floor(currentTime || 0);
  const totalSeconds = Math.floor(duration || (currentTrack?.seconds || 252));
  const progressPct = totalSeconds > 0
    ? Math.min(100, Math.max(0, (currentTime / totalSeconds) * 100))
    : 0;
  const volumePct = Math.round((volume ?? 0.74) * 100);

  const handleSeekClick = (e) => {
    if (isEmptyPlayer || !progressTrackRef.current) return;
    const rect = progressTrackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * totalSeconds;
    if (currentRoom) {
      broadcastSeek(target);
    }
    seekTo(target);
  };

  const handleVolumeClick = (e) => {
    if (!volumeTrackRef.current) return;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setVolumeLevel(ratio);
  };

  return (
    <>
      <footer className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-[1600px] px-5 pb-2.5 pointer-events-auto">
          <div className="sc-oled-bar px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* LEFT: Album Art, Track Name, Artist, Green Heart, Add Button */}
            <div className="flex items-center gap-3 w-full md:w-[30%] min-w-0">
              {!isEmptyPlayer && currentTrack ? (
                <div id="player-left-active" className="flex items-center gap-3 min-w-0 w-full">
                  <div className="relative w-12 h-12 shrink-0">
                    <CoverImage
                      id="player-cover"
                      src={currentTrack.cover}
                      alt=""
                      iconSize="w-5 h-5"
                      className="w-12 h-12 rounded-2xl object-cover border border-white/15 shadow-md"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p id="player-title" className="text-xs sm:text-sm font-semibold text-[#F4F4F2] truncate">
                      {currentTrack.title}
                    </p>
                    <p
                      id="player-artist"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (currentTrack.artist) {
                          navigate(`/artist/${encodeURIComponent(currentTrack.artist)}`);
                        }
                      }}
                      className="text-xs text-[#8A8A8E] truncate hover:underline hover:text-[#1ED760] transition cursor-pointer"
                    >
                      {currentTrack.artist}
                    </p>
                  </div>

                  <button
                    id="like-btn"
                    onClick={handleLikeClick}
                    aria-label={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                      isLiked
                        ? 'bg-[#1ED760]/15 border border-[#1ED760]/40 text-[#1ED760] shadow-[0_0_12px_rgba(30,215,96,0.3)] hover:scale-105'
                        : 'bg-black/85 hover:bg-black/95 border border-white/14 text-[#8A8A8E] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} aria-hidden="true" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddToPlaylist(currentTrack);
                    }}
                    aria-label="Add track to playlist"
                    className="w-8 h-8 rounded-full bg-black/85 hover:bg-black/95 border border-white/14 hover:border-white/28 flex items-center justify-center text-[#8A8A8E] hover:text-white transition shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div id="player-left-empty" className="flex items-center gap-3 min-w-0 w-full">
                  <div className="w-12 h-12 rounded-2xl bg-black/80 border border-dashed border-white/15 flex items-center justify-center text-[#8A8A8E] shrink-0 font-mono text-[10px]">
                    OFF
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="meta-label text-[#F4F4F2]">NO TRACK</p>
                    <p className="text-xs text-[#8A8A8E] truncate mt-0.5">Select a track</p>
                  </div>
                </div>
              )}
            </div>

            {/* CENTER: Transport Controls & Scrubber */}
            <PlayerTransport
              isPlaying={isPlaying}
              isEmptyPlayer={isEmptyPlayer}
              isShuffle={isShuffle}
              isRepeat={isRepeat}
              currentSeconds={currentSeconds}
              totalSeconds={totalSeconds}
              progressPct={progressPct}
              progressTrackRef={progressTrackRef}
              formatTime={formatTime}
              onTogglePlay={handleMasterPlay}
              onToggleShuffle={toggleShuffle}
              onToggleRepeat={toggleRepeat}
              onSkipPrev={skipPrev}
              onSkipNext={handleSkipNext}
              onSeekClick={handleSeekClick}
            />

            {/* RIGHT: "PLAYING NEXT" Pill, Lyrics, Devices, Volume */}
            <PlayerUtilities
              nextTrack={nextTrack}
              volumeTrackRef={volumeTrackRef}
              volumePct={volumePct}
              onNextClick={handleNextClick}
              onVolumeClick={handleVolumeClick}
              onShowToast={showToast}
            />
          </div>
        </div>
      </footer>

      {/* Floating Editorial Toast Notification */}
      <div
        id="sc-toast"
        className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 sc-pill px-4 py-2 flex items-center gap-2.5 shadow-2xl ${
          toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#1ED760] glow-green-sm" />
        <span id="sc-toast-text" className="meta-label text-[#F4F4F2]">
          {toastMessage || 'SYSTEM READY'}
        </span>
      </div>
    </>
  );
}
