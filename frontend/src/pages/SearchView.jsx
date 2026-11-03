import { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, X, Search as SearchIcon, ChevronLeft, ChevronRight, User, Disc3 } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { PageHeader, TrackRow, EmptyState, Skeleton } from '../components/shared';
import ArtistCard from '../components/search/ArtistCard';
import { TRENDING_TRACKS } from '../data/tracks';
import { API_BASE } from '../services/api';

const RECENT_KEY = 'super_culture_recent_searches';
const DEFAULT_RECENTS = ['Frank Ocean', 'Burial', 'Fred again..', 'Aphex Twin', 'Synthwave'];
const GENRE_CHIPS = ['All', 'Electronic', 'Hip Hop', 'Ambient', 'Synthwave', 'Indie', 'Lo-Fi', 'Lossless Cuts', 'Tokyo Express', 'Jazz'];
const PAGE_SIZE = 12;

const extractUniqueArtists = (trackList) => {
  const seen = new Set();
  const list = [];
  for (const t of trackList) {
    if (t.artist && !seen.has(t.artist.toLowerCase())) {
      seen.add(t.artist.toLowerCase());
      list.push({ id: t.artist, name: t.artist, avatar: t.cover, role: 'Artist' });
    }
    if (list.length >= 8) break;
  }
  return list;
};

export default function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { playTrack } = useContext(AudioContext);

  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_RECENTS;
    } catch { return DEFAULT_RECENTS; }
  });

  useEffect(() => {
    let isMounted = true;
    const fetchSearch = async () => {
      if (!query.trim()) {
        if (isMounted) { setTracks([]); setArtists([]); setLoading(false); }
        return;
      }
      setLoading(true);
      setPage(1);

      try {
        const res = await fetch(`${API_BASE}/api/music/search?q=${encodeURIComponent(query)}&limit=40`);
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();

        const rawTracks = Array.isArray(json.tracks) ? json.tracks
          : Array.isArray(json.data) ? json.data
          : Array.isArray(json.data?.tracks) ? json.data.tracks
          : Array.isArray(json) ? json : [];

        const rawArtists = Array.isArray(json.artists) ? json.artists
          : Array.isArray(json.data?.artists) ? json.data.artists : [];

        const normalizedTracks = rawTracks.map((t) => ({
          ...t,
          id: t.videoId || t.id,
          videoId: t.videoId || t.id,
          title: t.title || 'Untitled Track',
          artist: t.artist || 'Unknown Artist',
          cover: t.cover || t.thumbnailUrl || t.albumArt || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          duration: t.durationFormatted || t.duration || '3:30',
          seconds: typeof t.duration === 'number' ? t.duration : 210,
        }));

        const foundArtists = rawArtists.length > 0
          ? rawArtists
          : extractUniqueArtists(normalizedTracks);

        if (isMounted) {
          setArtists(foundArtists);
          setTracks(normalizedTracks);
        }
      } catch (err) {
        console.warn('[SearchView] Search fallback:', err.message);
        if (isMounted) {
          const q = query.toLowerCase();
          const fallback = TRENDING_TRACKS.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
          const chosen = fallback.length > 0 ? fallback : TRENDING_TRACKS;
          setTracks(chosen);
          setArtists(extractUniqueArtists(chosen));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSearch();
    return () => { isMounted = false; };
  }, [query]);

  const saveRecentSearch = (term) => {
    if (!term.trim()) return;
    const updated = [term.trim(), ...recentSearches.filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch (err) { console.warn(err); }
  };

  const removeRecentSearch = (e, term) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch (err) { console.warn(err); }
  };

  const handleSelectGenre = (chip) => {
    if (chip === 'All') { setSearchParams({}); }
    else { saveRecentSearch(chip); setSearchParams({ q: chip }); }
  };

  const totalPages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
  const paginatedTracks = tracks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="sc-card p-3.5 sm:p-6 w-full h-full flex flex-col min-h-0 overflow-y-auto no-scrollbar rounded-[24px] pb-28">
      <PageHeader title="Search" meta={query ? `RESULTS FOR "${query.toUpperCase()}"` : 'EXPLORE ARCHIVE'} />

      {/* Horizontally Scrollable High-Contrast Genre Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x scroll-smooth pb-2 pt-1 mb-5 shrink-0 px-0.5" style={{ scrollPaddingRight: '16px' }}>
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

      {loading && <div className="space-y-3 py-2"><Skeleton.Row count={6} /></div>}

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
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelectGenre(term); }}
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

      {!loading && query && (
        <div className="space-y-5">
          {artists.length === 0 && tracks.length === 0 ? (
            <EmptyState
              icon={SearchIcon}
              title="No Results Found"
              description={`No sound recordings or artists matched "${query}". Try searching for another artist or genre.`}
              actionLabel="Clear Search"
              onAction={() => setSearchParams({})}
            />
          ) : (
            <>
              {/* Top Section: Artists in a distinct horizontal row */}
              {artists.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <User className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
                    <span className="meta-label text-xs text-[#F4F4F2]">
                      ARTISTS ({artists.length})
                    </span>
                  </div>
                  <div className="flex overflow-x-auto gap-4 no-scrollbar pb-3 pt-1 snap-x scroll-smooth">
                    {artists.map((artist) => (
                      <ArtistCard key={artist.id || artist.name} artist={artist} />
                    ))}
                  </div>
                </section>
              )}

              {/* Divider between Artists and Tracks */}
              {artists.length > 0 && tracks.length > 0 && (
                <div className="border-t border-white/10 my-2" />
              )}

              {/* Bottom Section: Standard paginated Tracks list */}
              {tracks.length > 0 && (
                <section className="flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <Disc3 className="w-4 h-4 text-[#1ED760]" aria-hidden="true" />
                      <span className="meta-label text-xs text-[#F4F4F2]">
                        SONGS &amp; RECORDINGS ({tracks.length})
                      </span>
                    </div>
                    {totalPages > 1 && (
                      <span className="meta-label text-[10px] text-[#8A8A8E]">
                        PAGE {page} OF {totalPages}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {paginatedTracks.map((track, idx) => {
                      const globalIndex = (page - 1) * PAGE_SIZE + idx;
                      return (
                        <TrackRow
                          key={(track.videoId || track.id) + globalIndex}
                          track={track}
                          index={globalIndex}
                          queue={tracks}
                          onPlay={() => playTrack(track, tracks)}
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
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
