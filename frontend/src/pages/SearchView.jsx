import { useState, useEffect, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Clock, X, Search as SearchIcon } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { PageHeader, TrackRow, EmptyState, Skeleton, CoverImage } from '../components/shared';
import TopResultCard from '../components/search/TopResultCard';
import { TRENDING_TRACKS } from '../data/tracks';

const RECENT_KEY = 'super_culture_recent_searches';
const DEFAULT_RECENTS = ['Frank Ocean', 'Burial', 'Fred again..', 'Aphex Twin', 'Synthwave'];

const GENRE_CHIPS = [
  'All',
  'Electronic',
  'Hip Hop',
  'Ambient',
  'Synthwave',
  'Indie',
  'Lo-Fi',
  'Lossless Cuts',
  'Tokyo Express',
  'Jazz',
];

export default function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { playTrack } = useContext(AudioContext);
  const navigate = useNavigate();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_RECENTS;
    } catch (e) {
      console.warn('Failed to read recent searches:', e);
      return DEFAULT_RECENTS;
    }
  });

  // Fetch search results from /api/music/search
  useEffect(() => {
    let isMounted = true;

    const fetchSearch = async () => {
      if (!query.trim()) {
        if (isMounted) setTracks([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&limit=30`);
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        const rawList = Array.isArray(json) ? json : json.results || [];
        const normalized = rawList.map((t) => ({
          ...t,
          id: t.videoId || t.id,
          videoId: t.videoId || t.id,
          title: t.title || 'Untitled Track',
          artist: t.artist || 'Unknown Artist',
          cover: t.cover || t.thumbnailUrl || t.albumArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          duration: t.durationFormatted || t.duration || '3:30',
          seconds: typeof t.duration === 'number' ? t.duration : 210,
        }));
        if (isMounted) setTracks(normalized);
      } catch (err) {
        console.warn('[SearchView] API search fallback to seed:', err.message);
        if (isMounted) {
          const fallback = TRENDING_TRACKS.filter(
            (t) =>
              t.title.toLowerCase().includes(query.toLowerCase()) ||
              t.artist.toLowerCase().includes(query.toLowerCase())
          );
          setTracks(fallback.length > 0 ? fallback : TRENDING_TRACKS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSearch();
    return () => {
      isMounted = false;
    };
  }, [query]);

  const saveRecentSearch = (term) => {
    if (!term.trim()) return;
    const filtered = recentSearches.filter((s) => s.toLowerCase() !== term.toLowerCase());
    const updated = [term.trim(), ...filtered].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save recent search:', e);
    }
  };

  const removeRecentSearch = (e, term) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to remove recent search:', err);
    }
  };

  const handleSelectGenre = (chip) => {
    if (chip === 'All') {
      setSearchParams({});
    } else {
      saveRecentSearch(chip);
      setSearchParams({ q: chip });
    }
  };

  const topTrack = tracks[0] || null;
  const artistResults = [
    { name: query || 'Burial', role: 'Electronic / Ambient', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80' },
    { name: 'Four Tet', role: 'Curated Selection', avatar: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=160&q=80' },
    { name: 'Kavinsky', role: 'French Electro', avatar: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=160&q=80' },
    { name: 'Massive Attack', role: 'Trip-Hop Pioneer', avatar: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=160&q=80' },
  ];

  return (
    <div className="sc-card p-5 sm:p-6 w-full h-full flex flex-col min-h-0 overflow-y-auto no-scrollbar rounded-[24px]">
      <PageHeader
        title="Search"
        meta={query ? `RESULTS FOR "${query.toUpperCase()}"` : 'EXPLORE ARCHIVE'}
      />

      {/* Horizontally Scrollable High-Contrast Genre Chips (Contrast >= 4.5:1) */}
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x scroll-smooth pb-2 pt-1 mb-4 shrink-0 px-0.5"
        style={{ scrollPaddingRight: '16px' }}
      >
        {GENRE_CHIPS.map((chip) => {
          const isSelected = (!query && chip === 'All') || query.toLowerCase() === chip.toLowerCase();
          return (
            <button
              key={chip}
              onClick={() => handleSelectGenre(chip)}
              aria-label={`Filter by ${chip}`}
              className={`sc-pill px-3.5 py-1.5 text-xs shrink-0 snap-start transition cursor-pointer ${
                isSelected
                  ? 'bg-[#F4F4F2] text-[#0B0B0C] font-semibold shadow-sm'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-[#F4F4F2] border border-white/15 font-medium'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Loading State: Skeleton rows (no spinner on wordmark) */}
      {loading && (
        <div className="space-y-3 py-2">
          <Skeleton.Row count={6} />
        </div>
      )}

      {/* Empty State: Recent searches + sonic exploration prompt */}
      {!loading && !query && (
        <section className="flex-1 flex flex-col justify-start">
          <div className="flex items-center justify-between mb-3">
            <span className="meta-label text-[10px] text-[#8A8A8E] flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#1ED760]" aria-hidden="true" />
              <span>RECENT SEARCHES</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {recentSearches.map((term) => (
              <div
                key={term}
                onClick={() => handleSelectGenre(term)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectGenre(term);
                }}
                aria-label={`Search for ${term}`}
                className="sc-pill px-3 py-1.5 text-xs text-[#F4F4F2] bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 flex items-center gap-2 cursor-pointer transition"
              >
                <span>{term}</span>
                <button
                  onClick={(e) => removeRecentSearch(e, term)}
                  aria-label={`Remove ${term} from recents`}
                  className="text-[#8A8A8E] hover:text-white transition cursor-pointer"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <EmptyState
            icon={SearchIcon}
            title="Explore the Sonic Archive"
            description="Use the top search bar (⌘K) to explore lossless streams, full artist discographies, and editorial genre cuts."
          />
        </section>
      )}

      {/* Search Results Layout: Top Result Card + Song Rows + Artists */}
      {!loading && query && (
        <div className="space-y-6">
          {tracks.length > 0 ? (
            <>
              {/* Row: Top Result Card (Left) + Top Song Rows (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <TopResultCard
                  track={topTrack}
                  onPlay={(t) => playTrack(t, tracks)}
                />

                {/* Song Rows alongside Top Result */}
                <div className="lg:col-span-7 flex flex-col min-w-0">
                  <span className="meta-label text-[#8A8A8E] mb-2">SONGS</span>
                  <div className="space-y-2 flex-1">
                    {tracks.slice(topTrack ? 1 : 0, 5).map((track, idx) => (
                      <TrackRow
                        key={track.id + idx}
                        track={track}
                        index={topTrack ? idx + 1 : idx}
                        queue={tracks}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Compact Artists Row */}
              <div>
                <span className="meta-label text-[#8A8A8E] block mb-2.5">ARTISTS</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {artistResults.map((artist, i) => (
                    <div
                      key={i}
                      onClick={() => navigate('/genre/' + encodeURIComponent(artist.name))}
                      className="sc-card-secondary p-3 rounded-2xl flex items-center gap-3 group cursor-pointer hover:border-white/20 transition"
                    >
                      <CoverImage
                        src={artist.avatar}
                        alt=""
                        iconSize="w-4 h-4"
                        className="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                          {artist.name}
                        </p>
                        <span className="text-[10px] text-[#8A8A8E] block truncate">{artist.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Remaining Song Rows */}
              {tracks.length > 5 && (
                <div className="space-y-2 pt-2">
                  <span className="meta-label text-[#8A8A8E] block mb-1">MORE RECORDINGS</span>
                  {tracks.slice(5).map((track, idx) => (
                    <TrackRow
                      key={track.id + idx + 5}
                      track={track}
                      index={idx + 5}
                      queue={tracks}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={SearchIcon}
              title="No Tracks Found"
              description={`No sound recordings matched "${query}". Try searching for another artist or genre.`}
              actionLabel="Clear Search"
              onAction={() => setSearchParams({})}
            />
          )}
        </div>
      )}
    </div>
  );
}
