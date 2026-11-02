import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Clock, X, Disc, Users, Music } from 'lucide-react';
import { PageHeader, TrackRow, PlaylistCard, EmptyState, Skeleton } from '../components/shared';
import { TRENDING_TRACKS, LIBRARY_TRACKS } from '../data/tracks';

const RECENT_KEY = 'super_culture_recent_searches';
const DEFAULT_RECENTS = ['Frank Ocean', 'Burial', 'Fred again..', 'Aphex Twin', 'Synthwave'];

export default function SearchView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [activeTab, setActiveTab] = useState('Songs');
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

  const navigate = useNavigate();

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
          cover:
            t.cover ||
            t.thumbnailUrl ||
            t.albumArt ||
            t.thumbnail_url ||
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=544&h=544&fit=crop',
          duration: t.durationFormatted || t.duration || '3:30',
          seconds: typeof t.duration === 'number' ? t.duration : 210,
        }));
        if (isMounted) setTracks(normalized);
      } catch (err) {
        console.warn('[SearchView] API search failed, falling back to seed:', err);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      saveRecentSearch(searchInput.trim());
      setSearchParams({ q: searchInput.trim() });
    }
  };

  const handleSelectRecent = (term) => {
    setSearchInput(term);
    saveRecentSearch(term);
    setSearchParams({ q: term });
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto no-scrollbar px-2 py-1 pb-24">
      <PageHeader
        title="Search"
        meta={query ? `RESULTS FOR "${query.toUpperCase()}"` : 'EXPLORE ARCHIVE'}
      />

      {/* Search Input Bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4 shrink-0">
        <div className="sc-pill flex items-center gap-2.5 px-4 h-11 flex-1 focus-within:border-white/30 focus-within:bg-black/90">
          <SearchIcon className="w-4 h-4 text-[#8A8A8E] shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search tracks, artists, moods or albums..."
            aria-label="Search query"
            className="bg-transparent border-none outline-none text-xs text-[#F4F4F2] placeholder-[#8A8A8E] w-full font-normal"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearchParams({});
              }}
              aria-label="Clear search input"
              className="text-[#8A8A8E] hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="submit"
          aria-label="Submit search"
          className="sc-pill px-5 bg-white/10 hover:bg-[#1ED760] hover:text-black text-xs font-semibold text-[#F4F4F2] transition cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Tabs: Songs / Artists / Playlists */}
      {query && (
        <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-white/10 pb-2">
          {[
            { id: 'Songs', icon: Music, label: 'Songs' },
            { id: 'Artists', icon: Users, label: 'Artists' },
            { id: 'Playlists', icon: Disc, label: 'Playlists' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={`View ${tab.label}`}
                className={`sc-pill px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                  isActive
                    ? 'bg-[#F4F4F2] text-[#0B0B0C] shadow-sm'
                    : 'bg-white/5 hover:bg-white/10 text-[#8A8A8E] hover:text-[#F4F4F2]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Recent Searches Pills (When no active query) */}
      {!query && (
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="meta-label text-[10px] text-[#8A8A8E] flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#1ED760]" aria-hidden="true" />
              <span>RECENT SEARCHES</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <div
                key={term}
                onClick={() => handleSelectRecent(term)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectRecent(term);
                }}
                aria-label={`Search for ${term}`}
                className="sc-pill px-3 py-1.5 text-xs text-[#F4F4F2] hover:text-[#1ED760] hover:bg-white/10 flex items-center gap-2 cursor-pointer transition group"
              >
                <span>{term}</span>
                <button
                  onClick={(e) => removeRecentSearch(e, term)}
                  aria-label={`Remove ${term} from recent searches`}
                  className="text-[#8A8A8E] hover:text-white transition cursor-pointer"
                >
                  <X className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <EmptyState
              icon={SearchIcon}
              title="Explore the Sonic Archive"
              description="Type an artist, song title, or curated aesthetic keyword to explore lossless streams and editorial cuts."
            />
          </div>
        </section>
      )}

      {/* Loading Skeletons */}
      {loading && <Skeleton.Row count={6} />}

      {/* Results Display */}
      {!loading && query && (
        <>
          {activeTab === 'Songs' && (
            <div className="space-y-2">
              {tracks.length > 0 ? (
                tracks.map((t, idx) => (
                  <TrackRow key={t.id + idx} track={t} index={idx} queue={tracks} />
                ))
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

          {activeTab === 'Artists' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { name: query, genre: 'Electronic / Ambient', avatar: LIBRARY_TRACKS.fredAgain.cover },
                { name: `${query} & Friends`, genre: 'Collaborative Archive', avatar: LIBRARY_TRACKS.tapeArchive.cover },
              ].map((artist, i) => (
                <div
                  key={i}
                  className="sc-card sc-card-hover p-4 rounded-2xl flex flex-col items-center text-center cursor-pointer"
                >
                  <img
                    src={artist.avatar}
                    alt={artist.name}
                    className="w-16 h-16 rounded-full object-cover border border-white/15 mb-3"
                  />
                  <h4 className="text-sm font-semibold text-[#F4F4F2] truncate w-full">{artist.name}</h4>
                  <p className="text-xs text-[#8A8A8E] truncate w-full">{artist.genre}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Playlists' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <PlaylistCard
                title={`Curated: ${query}`}
                subtitle="Editorial Selection • 18 tracks"
                cover={tracks[0]?.cover || LIBRARY_TRACKS.tapeArchive.cover}
                tag="COLLECTION"
                onClick={() => navigate('/genre/' + encodeURIComponent(query))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
