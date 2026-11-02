import { useContext, useRef } from 'react';
import { AudioContext } from '../context/AudioContext';

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
    isLiked,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,
    setVolumeLevel,
    toggleShuffle,
    toggleRepeat,
    toggleEmptyPlayer,
    toggleLikeTrack,
    showToast,
  } = useContext(AudioContext);

  const progressTrackRef = useRef(null);
  const volumeTrackRef = useRef(null);

  // Determine next track for the "PLAYING NEXT" pill
  const currentIndex = queue.findIndex(
    (t) => t.id === currentTrack?.id || (currentTrack?.videoId && t.videoId === currentTrack.videoId)
  );
  const nextTrack = queue.length > 0
    ? queue[(currentIndex + 1 + queue.length) % queue.length]
    : currentTrack;

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
    seekTo(ratio * totalSeconds);
  };

  const handleVolumeClick = (e) => {
    if (!volumeTrackRef.current) return;
    const rect = volumeTrackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setVolumeLevel(ratio);
  };

  return (
    <>
      {/* Fixed Audio Player Bar at bottom with Dark OLED Styling */}
      <footer className="fixed bottom-0 xl:bottom-2 left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="w-full max-w-[1480px] px-5 pb-2.5 xl:pb-3.5 pointer-events-auto">
          <div className="sc-oled-bar px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* LEFT: Album Art, Track Name, Artist, Green Heart, Add Button (+ Empty State Variant) */}
          <div className="flex items-center gap-3 w-full md:w-[30%] min-w-0">
            {!isEmptyPlayer ? (
              <div id="player-left-active" className="flex items-center gap-3 min-w-0 w-full">
                <div className="relative w-13 h-13 shrink-0">
                  <img
                    id="player-cover"
                    src={currentTrack?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&q=80'}
                    alt="Now Playing Cover"
                    className="w-12 h-12 rounded-2xl object-cover border border-white/15 shadow-md"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p id="player-title" className="text-xs sm:text-sm font-semibold text-[#F4F4F2] truncate">
                      {currentTrack?.title || 'NIGHTCALL (RUNWAY EDIT)'}
                    </p>
                  </div>
                  <p id="player-artist" className="text-[11px] text-[#8A8A8E] truncate">
                    {currentTrack?.artist || 'Kavinsky, Lovefoxxx'}
                  </p>
                </div>
                {/* Green Liked Heart Button */}
                <button
                  id="like-btn"
                  onClick={toggleLikeTrack}
                  title="Like Track"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 cursor-pointer ${
                    isLiked
                      ? 'bg-[#1ED760]/15 border border-[#1ED760]/40 text-[#1ED760] shadow-[0_0_12px_rgba(30,215,96,0.3)] hover:scale-105'
                      : 'bg-black/85 hover:bg-black/95 border border-white/14 text-[#8A8A8E] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
                {/* Add to Playlist "+" Button */}
                <button
                  onClick={() => showToast('Added track to 35mm Night Archive')}
                  title="Add to Playlist"
                  className="w-8 h-8 rounded-full bg-black/85 hover:bg-black/95 border border-white/14 hover:border-white/28 flex items-center justify-center text-[#8A8A8E] hover:text-white transition shrink-0 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" d="M12 8v8M8 12h8" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Empty State Variant ("NO TRACK / Select a track") */
              <div id="player-left-empty" className="flex items-center gap-3 min-w-0 w-full">
                <div className="w-12 h-12 rounded-2xl bg-black/80 border border-dashed border-white/15 flex items-center justify-center text-[#8A8A8E] shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="2.5" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="meta-label text-[#F4F4F2]">NO TRACK</p>
                  <p className="text-[11px] text-[#8A8A8E] truncate mt-0.5">Select a track</p>
                </div>
              </div>
            )}
          </div>

          {/* CENTER: Transport Controls & Scrubber */}
          <div className="flex flex-col items-center justify-center w-full md:w-[40%] max-w-[520px]">
            <div className="flex items-center gap-5 mb-1.5">
              {/* Shuffle */}
              <button
                onClick={toggleShuffle}
                title="Shuffle"
                className={`transition cursor-pointer ${isShuffle ? 'text-[#1ED760] drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]' : 'text-[#8A8A8E] hover:text-white'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
              </button>

              {/* Previous */}
              <button
                onClick={skipPrev}
                title="Previous"
                className="text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20L9 12l10-8v16zM5 19V5" />
                </svg>
              </button>

              {/* Large White Circular Play/Pause Button */}
              <button
                id="master-play-btn"
                onClick={togglePlay}
                title="Play / Pause"
                className="w-10 h-10 rounded-full bg-[#F4F4F2] hover:scale-105 active:scale-95 text-[#0B0B0C] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] transition cursor-pointer"
              >
                {isPlaying && !isEmptyPlayer ? (
                  /* Pause Icon */
                  <svg id="icon-pause" className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  /* Play Icon */
                  <svg id="icon-play" className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={skipNext}
                title="Next"
                className="text-[#F4F4F2]/85 hover:text-white transition cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 4l10 8-10 8V4zM19 5v14" />
                </svg>
              </button>

              {/* Repeat */}
              <button
                onClick={toggleRepeat}
                title="Repeat"
                className={`transition cursor-pointer ${isRepeat ? 'text-[#1ED760] drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]' : 'text-[#8A8A8E] hover:text-white'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 1l4 4-4 4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 13v2a4 4 0 01-4 4H3" />
                </svg>
              </button>
            </div>

            {/* Dark OLED Seek Progress Bar & Timestamps */}
            <div className="w-full flex items-center gap-3">
              <span id="time-current" className="font-mono text-[10px] text-[#8A8A8E] w-7 text-right">
                {isEmptyPlayer ? '0:00' : formatTime(currentSeconds)}
              </span>
              <div
                ref={progressTrackRef}
                id="progress-track"
                onClick={handleSeekClick}
                className="relative flex-1 h-3 cursor-pointer group flex items-center"
              >
                <div className="sc-oled-track w-full h-1.5 rounded-full overflow-hidden">
                  <div
                    id="progress-fill"
                    className="h-full bg-[#1ED760] rounded-full transition-all duration-150 shadow-[0_0_10px_rgba(30,215,96,0.7)]"
                    style={{ width: `${isEmptyPlayer ? 0 : progressPct}%` }}
                  ></div>
                </div>
                <div
                  id="progress-thumb"
                  className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] opacity-0 group-hover:opacity-100 transition absolute pointer-events-none"
                  style={{ left: `calc(${isEmptyPlayer ? 0 : progressPct}% - 5px)` }}
                ></div>
              </div>
              <span id="time-total" className="font-mono text-[10px] text-[#8A8A8E] w-7">
                {isEmptyPlayer ? '0:00' : formatTime(totalSeconds)}
              </span>
            </div>
          </div>

          {/* RIGHT: "PLAYING NEXT" Pill, Lyrics, Devices, Volume Slider */}
          <div className="flex items-center justify-end gap-2.5 w-full md:w-[30%]">
            {/* Toggle Button for Empty Player State Preview */}
            <button
              id="btn-empty-player"
              onClick={() => toggleEmptyPlayer()}
              title="Preview Player Empty State ('NO TRACK / Select a track')"
              className="meta-label text-[9px] px-2.5 py-1 rounded-full bg-black/85 hover:bg-black/95 border border-white/14 text-[#8A8A8E] hover:text-white transition hidden xl:inline-block cursor-pointer shadow-sm"
            >
              {isEmptyPlayer ? 'ACTIVE STATE' : 'EMPTY STATE'}
            </button>

            {/* "PLAYING NEXT" Dark OLED Frosted Pill */}
            <div
              onClick={skipNext}
              title="Click to Play Next Track"
              className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-2xl bg-black/90 hover:bg-black/98 border border-white/14 hover:border-white/28 shadow-[0_4px_16px_rgba(0,0,0,0.85)] cursor-pointer transition max-w-[185px]"
            >
              <img
                id="next-track-cover"
                src={nextTrack?.cover || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=100&q=80'}
                alt="Playing Next"
                className="w-7 h-7 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="meta-label text-[8px] text-[#1ED760] block">PLAYING NEXT</span>
                <p id="next-track-title" className="text-[11px] font-medium text-[#F4F4F2] truncate">
                  {nextTrack?.title || 'Veridis Quo'}
                </p>
              </div>
              {/* Queue Icon */}
              <svg className="w-3.5 h-3.5 text-[#8A8A8E] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            </div>

            {/* Utility Icons + Volume Slider */}
            <div className="flex items-center gap-2 text-[#8A8A8E]">
              {/* Lyrics Icon */}
              <button
                onClick={() => showToast('Time-synced Editorial Lyrics Active')}
                title="Lyrics"
                className="hover:text-[#F4F4F2] transition p-1 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                </svg>
              </button>

              {/* Connect Devices Icon */}
              <button
                onClick={() => showToast('Connected: Teenage Engineering OB-4 Studio')}
                title="Devices"
                className="hover:text-[#F4F4F2] transition p-1 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="14" height="10" rx="2" />
                  <rect x="14" y="10" width="8" height="10" rx="2" />
                  <path strokeLinecap="round" d="M6 18h4" />
                </svg>
              </button>

              {/* Speaker + Dark OLED Volume Slider */}
              <div className="hidden sm:flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[#F4F4F2]/80" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07" />
                </svg>
                <div
                  ref={volumeTrackRef}
                  onClick={handleVolumeClick}
                  className="sc-oled-track w-18 h-2 rounded-full p-[2px] overflow-hidden cursor-pointer flex items-center"
                  title="Volume"
                >
                  <div
                    id="volume-fill"
                    className="h-full bg-[#F4F4F2] rounded-full transition-all shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                    style={{ width: `${volumePct}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
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
        <span className="w-2 h-2 rounded-full bg-[#1ED760] glow-green-sm"></span>
        <span id="sc-toast-text" className="meta-label text-[#F4F4F2]">
          {toastMessage || 'SYSTEM READY'}
        </span>
      </div>
    </>
  );
}

