import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAudio } from '../hooks/useAudio';

export default function GenreView() {
  const { genreId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudio();

  // Read metadata from router state with sensible fallbacks
  const title =
    location.state?.title ||
    (genreId
      ? genreId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Curated Genre');
  const query =
    location.state?.query ||
    (genreId ? genreId.replace(/-/g, ' ') : 'Popular Music');
  const meta = location.state?.meta || 'CURATED • 40 TRACKS';

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const topRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTracks = async () => {
      setLoading(true);
      setCurrentPage(1);
      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(query)}&limit=40`
        );

        // Catch non-200 responses cleanly to avoid parsing HTML as JSON
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`API Error ${res.status}: ${errorText}`);
        }

        const json = await res.json();
        const rawList = Array.isArray(json)
          ? json
          : json.results || json.tracks || [];

        // Normalize fetched data so every track has cover and videoId
        const normalized = rawList.map((t) => ({
          ...t,
          id: t.videoId || t.id,
          videoId: t.videoId || t.id,
          title: t.title || 'Untitled Track',
          artist: t.artist || 'Unknown Artist',
          cover:
            t.cover ||
            t.albumArt ||
            t.thumbnail_url ||
            t.thumbnailUrl ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          duration: t.duration || t.durationFormatted || '3:30',
          seconds: typeof t.duration === 'number' ? t.duration : 210,
        }));

        if (isMounted) {
          setTracks(normalized);
        }
      } catch (err) {
        console.error('[GenreView] Fetch error:', err);
        if (isMounted) {
          setTracks([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTracks();

    return () => {
      isMounted = false;
    };
  }, [query]);

  // Client-Side Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(tracks.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTracks = tracks.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-y-auto no-scrollbar px-2 py-1">
      <div ref={topRef}>
        {/* Header with Back Button, Genre Title, and Metadata */}
        <div className="flex items-center justify-between gap-4 mb-4 pt-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="sc-pill px-3.5 py-1.5 flex items-center gap-1.5 text-xs text-[#F4F4F2] hover:text-white transition cursor-pointer shadow-md"
              title="Return to Home"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span>Back</span>
            </button>
            <div>
              <h1 className="font-serif italic text-2xl md:text-3xl font-semibold text-[#F4F4F2] tracking-tight">
                {title}
              </h1>
              <p className="meta-label text-[9px] text-[#8A8A8E] mt-0.5">
                {meta}
              </p>
            </div>
          </div>

          {!loading && tracks.length > 0 && (
            <span className="meta-label text-[9px] text-[#1ED760] hidden sm:inline-block">
              {tracks.length} TRACKS LOADED
            </span>
          )}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-9 h-9 border-3 border-[#1ED760] border-t-transparent rounded-full animate-spin"></div>
            <p className="meta-label text-[10px] text-[#8A8A8E]">
              LOADING {title.toUpperCase()} ARCHIVE...
            </p>
          </div>
        ) : currentTracks.length > 0 ? (
          /* Responsive CSS Grid */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {currentTracks.map((track) => {
              const isCurrent =
                currentTrack?.id === track.id ||
                (currentTrack?.videoId && track.videoId === currentTrack.videoId);

              return (
                <div
                  key={track.videoId || track.id}
                  onClick={() =>
                    isCurrent ? togglePlay() : playTrack(track, tracks)
                  }
                  className="sc-card sc-card-hover group p-2.5 rounded-2xl cursor-pointer flex flex-col justify-between transition-all duration-300 relative overflow-hidden"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-2 border border-white/10 bg-black/40">
                    <img
                      src={track.cover}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div
                      className={`absolute inset-0 bg-black/35 flex items-center justify-center transition-opacity duration-200 ${
                        isCurrent
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center shadow-lg transform transition">
                        {isCurrent && isPlaying ? (
                          <svg
                            className="w-3.5 h-3.5 fill-current"
                            viewBox="0 0 24 24"
                          >
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </svg>
                        ) : (
                          <svg
                            className="w-3.5 h-3.5 fill-current ml-0.5"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-semibold truncate transition ${
                        isCurrent ? 'text-[#1ED760]' : 'text-[#F4F4F2] group-hover:text-[#1ED760]'
                      }`}
                      title={track.title}
                    >
                      {track.title}
                    </p>
                    <p
                      className="text-[10px] text-[#8A8A8E] truncate"
                      title={track.artist}
                    >
                      {track.artist}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-medium text-[#F4F4F2]">
              No tracks found for &ldquo;{query}&rdquo;
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-3 sc-pill px-4 py-2 text-xs text-[#1ED760] cursor-pointer"
            >
              Return to Discovery
            </button>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3.5 pt-4 pb-2">
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="sc-pill px-4 py-1.5 text-xs font-medium text-[#F4F4F2] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white cursor-pointer transition shadow-md"
          >
            Previous Page
          </button>
          <span className="meta-label text-[10px] text-[#8A8A8E]">
            PAGE {currentPage} OF {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="sc-pill px-4 py-1.5 text-xs font-medium text-[#F4F4F2] disabled:opacity-30 disabled:cursor-not-allowed hover:text-white cursor-pointer transition shadow-md"
          >
            Next Page
          </button>
        </div>
      )}
    </div>
  );
}
