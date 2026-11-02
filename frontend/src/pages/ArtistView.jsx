import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Play, ArrowLeft, UserCheck, UserPlus, Disc3, ChevronLeft, ChevronRight } from 'lucide-react';
import { TrackRow, CoverImage, EmptyState, Skeleton } from '../components/shared';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';

const PAGE_SIZE = 12;

export default function ArtistView() {
  const { artistName: rawArtistName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { playTrack, showToast } = useAudio();

  const artistName = useMemo(() => {
    try {
      return decodeURIComponent(rawArtistName || '');
    } catch {
      return rawArtistName || '';
    }
  }, [rawArtistName]);

  const passedAvatar = location.state?.avatar;
  const passedGenre = location.state?.genre;

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const isFollowing = useLibraryStore((s) => s.isFollowingArtist(artistName));
  const toggleFollowArtist = useLibraryStore((s) => s.toggleFollowArtist);

  useEffect(() => {
    let isMounted = true;

    const fetchArtistTracks = async () => {
      setLoading(true);
      setPage(1);
      try {
        const res = await fetch(`/api/music/artist/${encodeURIComponent(artistName)}`);
        if (!res.ok) throw new Error('Failed to load artist tracks');
        const json = await res.json();
        const rawList = Array.isArray(json) ? json : json.results || json.tracks || [];

        const normalized = rawList.map((t) => ({
          ...t,
          id: t.videoId || t.id,
          videoId: t.videoId || t.id,
          title: t.title || 'Untitled Recording',
          artist: t.artist || artistName,
          cover: t.cover || t.thumbnailUrl || t.thumbnail_url || t.albumArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          duration: t.durationFormatted || t.duration || '3:30',
          seconds: typeof t.duration === 'number' ? t.duration : 210,
        }));

        if (isMounted) setTracks(normalized);
      } catch (err) {
        console.warn('[ArtistView] Fetch error:', err.message);
        if (isMounted) setTracks([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (artistName) {
      fetchArtistTracks();
    }

    return () => {
      isMounted = false;
    };
  }, [artistName]);

  const avatarUrl =
    passedAvatar ||
    tracks[0]?.cover ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop';

  const handlePlayArtist = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
      showToast(`Playing discography: ${artistName}`);
    } else {
      showToast('No tracks found for this artist');
    }
  };

  const handleToggleFollow = () => {
    const isNowFollowing = toggleFollowArtist({
      name: artistName,
      avatar: avatarUrl,
      genre: passedGenre || 'Electronic',
    });
    showToast(isNowFollowing ? `Now following ${artistName}` : `Unfollowed ${artistName}`);
  };

  const totalPages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
  const paginatedTracks = tracks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="sc-pill px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs text-[#8A8A8E] hover:text-[#F4F4F2] flex items-center gap-1.5 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back</span>
        </button>
        <span className="meta-label text-[10px] text-[#8A8A8E]">ARTIST DISCOGRAPHY</span>
      </div>

      {/* Hero Header Card */}
      <section className="sc-card p-6 mb-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-end gap-6 relative overflow-hidden">
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border border-white/15 bg-black/50 shadow-2xl shrink-0">
          <CoverImage
            src={avatarUrl}
            alt={artistName}
            iconSize="w-10 h-10"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <span className="meta-label text-[10px] text-[#1ED760] mb-1.5 block">
            VERIFIED ARTIST • ARCHIVE CATALOG
          </span>
          <h1 className="font-serif italic text-3xl sm:text-4xl font-semibold text-[#F4F4F2] tracking-tight leading-tight mb-2 truncate">
            {artistName}
          </h1>
          <p className="text-xs text-[#8A8A8E] mb-4">
            {passedGenre ? `${passedGenre} • ` : ''}{tracks.length} recordings indexed in archive
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <button
              onClick={handlePlayArtist}
              disabled={tracks.length === 0}
              aria-label={`Play ${artistName}`}
              className="sc-pill px-4 py-2 bg-[#1ED760] hover:bg-[#22e868] disabled:opacity-40 text-[#0B0B0C] font-semibold text-xs flex items-center gap-2 transition cursor-pointer shadow-lg"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
              <span>Play Catalog</span>
            </button>

            <button
              onClick={handleToggleFollow}
              aria-label={isFollowing ? `Unfollow ${artistName}` : `Follow ${artistName}`}
              className={`sc-pill px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                isFollowing
                  ? 'bg-white/15 text-[#1ED760] border border-[#1ED760]/40'
                  : 'bg-white/10 hover:bg-white/15 text-[#F4F4F2]'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-[#1ED760]" aria-hidden="true" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>+ Follow</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Songs Section */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
            <h2 className="meta-label text-xs text-[#F4F4F2]">
              TOP RECORDINGS ({tracks.length})
            </h2>
          </div>
          {totalPages > 1 && (
            <span className="meta-label text-[10px] text-[#8A8A8E]">
              PAGE {page} OF {totalPages}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton.Row count={6} />
          </div>
        ) : tracks.length > 0 ? (
          <>
            <div className="space-y-2 mb-4">
              {paginatedTracks.map((track, idx) => {
                const globalIndex = (page - 1) * PAGE_SIZE + idx;
                return (
                  <TrackRow
                    key={(track.videoId || track.id) + globalIndex}
                    track={track}
                    index={globalIndex}
                    queue={tracks}
                  />
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-3 pb-36">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous recordings page"
                  className="sc-pill px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs text-[#F4F4F2] flex items-center gap-1 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="text-xs font-mono text-[#8A8A8E]">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next recordings page"
                  className="sc-pill px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs text-[#F4F4F2] flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {totalPages <= 1 && <div className="h-32 w-full shrink-0" aria-hidden="true" />}
          </>
        ) : (
          <EmptyState
            title={`No Recordings Found for ${artistName}`}
            description="We could not find any catalog recordings for this artist in the live index."
          />
        )}
      </section>
    </div>
  );
}
