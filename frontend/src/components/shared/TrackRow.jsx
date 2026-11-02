import React from 'react';
import { Play, Pause, Heart, Plus } from 'lucide-react';
import { useAudio } from '../../hooks/useAudio';
import { useLibraryStore } from '../../store/useLibraryStore';
import CoverImage from './CoverImage';

/**
 * Reusable TrackRow component across Search, Library, Playlist, Genre, Recents & Magic Vibe.
 * Ensures consistent design tokens, buttons with aria-labels, and optimistic like states.
 */
export default function TrackRow({
  track,
  index,
  queue,
  onAddToPlaylist,
  showIndex = true,
  showLike = true,
  showAdd = true,
}) {
  const { playTrack, currentTrack, isPlaying, togglePlay, showToast } = useAudio();
  const isLiked = useLibraryStore((s) => s.isLiked(track?.videoId || track?.id));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  if (!track) return null;

  const trackId = track.videoId || track.id;
  const isCurrent = currentTrack && (currentTrack.videoId === trackId || currentTrack.id === trackId);
  const isCurrentPlaying = isCurrent && isPlaying;

  const handleRowClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playTrack(track, queue);
    }
  };

  const handleLikeClick = (e) => {
    e.stopPropagation();
    toggleLike(track);
    showToast(!isLiked ? `Saved "${track.title}" to Liked Songs` : `Removed "${track.title}" from Liked Songs`);
  };

  const handleAddClick = (e) => {
    e.stopPropagation();
    if (onAddToPlaylist) {
      onAddToPlaylist(track);
    } else {
      showToast(`Track "${track.title}" added to queue`);
    }
  };

  const coverUrl =
    track.cover ||
    track.thumbnailUrl ||
    track.thumbnail_url ||
    track.albumArt ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

  const durationStr =
    track.durationFormatted ||
    track.duration ||
    (typeof track.seconds === 'number'
      ? `${Math.floor(track.seconds / 60)}:${track.seconds % 60 < 10 ? '0' : ''}${track.seconds % 60}`
      : '3:30');

  const formattedIndex = typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;

  return (
    <div
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      aria-label={`Play ${track.title} by ${track.artist}`}
      className={`group sc-card sc-card-hover p-2.5 flex items-center justify-between rounded-2xl cursor-pointer transition select-none ${
        isCurrent ? 'ring-1 ring-[#1ED760]/80 bg-white/[0.09] shadow-[0_0_16px_rgba(30,215,96,0.14)]' : 'hover:bg-white/[0.05]'
      }`}
    >
      {/* Left: Index / Equalizer + 48px Cover + Title + Artist */}
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        {showIndex && (
          <div className="w-6 shrink-0 flex items-center justify-center font-mono text-[11px] text-[#8A8A8E]">
            {isCurrentPlaying ? (
              <div className="flex items-end gap-[2px] h-3.5">
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-1 motion-reduce:animate-none"></span>
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-2 motion-reduce:animate-none"></span>
                <span className="w-[2px] bg-[#1ED760] rounded-full eq-bar-3 motion-reduce:animate-none"></span>
              </div>
            ) : (
              <span className="group-hover:hidden">{formattedIndex}</span>
            )}
            <Play
              className={`w-3.5 h-3.5 text-[#F4F4F2] fill-current ${
                isCurrentPlaying ? 'hidden' : 'hidden group-hover:block'
              }`}
              aria-hidden="true"
            />
          </div>
        )}

        {/* 48px Thumbnail Cover */}
        <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-black/40">
          <CoverImage
            src={coverUrl}
            alt=""
            iconSize="w-5 h-5"
            className="w-full h-full object-cover group-hover:scale-105 transition"
            loading="lazy"
          />
        </div>

        {/* Metadata: 2-line wrapped full title */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs sm:text-sm font-medium line-clamp-2 leading-snug break-words transition ${
              isCurrent ? 'text-[#1ED760]' : 'text-[#F4F4F2] group-hover:text-white'
            }`}
          >
            {track.title}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[#8A8A8E] truncate mt-0.5">
            <span className="truncate">{track.artist}</span>
            {track.reason && (
              <>
                <span>•</span>
                <span className="text-[10px] text-[#1ED760]/85 font-mono truncate">{track.reason}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Duration + Like + Add + Play Button */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-mono text-[#8A8A8E] w-10 text-right">
          {durationStr}
        </span>

        {showLike && (
          <button
            onClick={handleLikeClick}
            aria-label={isLiked ? `Remove ${track.title} from liked songs` : `Save ${track.title} to liked songs`}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${
              isLiked
                ? 'text-[#1ED760] bg-[#1ED760]/15 border border-[#1ED760]/30 shadow-sm'
                : 'text-[#8A8A8E] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
        )}

        {showAdd && (
          <button
            onClick={handleAddClick}
            aria-label={`Add ${track.title} to queue`}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#8A8A8E] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}

        {/* Play/Pause pill button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRowClick();
          }}
          aria-label={isCurrentPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
            isCurrentPlaying
              ? 'bg-[#1ED760] text-black shadow-md'
              : 'bg-white/5 hover:bg-[#1ED760] hover:text-black text-[#F4F4F2]'
          }`}
        >
          {isCurrentPlaying ? (
            <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

