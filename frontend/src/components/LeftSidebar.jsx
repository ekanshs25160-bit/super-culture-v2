import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Sparkles,
  Clock,
  Users,
  Download,
  Plus,
  ArrowUpRight,
  Heart,
} from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { useLibraryStore } from '../store/useLibraryStore';
import CoverImage from './shared/CoverImage';

export default function LeftSidebar() {
  const { showToast } = useAudio();

  const {
    likedCount,
    playlists,
    followedArtists,
    createPlaylist,
    fetchLibraryOverview,
    loading,
  } = useLibraryStore();

  const navigate = useNavigate();

  useEffect(() => {
    fetchLibraryOverview();
  }, [fetchLibraryOverview]);

  const navItems = [
    { id: 'Home', label: 'Home', to: '/', icon: HomeIcon },
    { id: 'Search', label: 'Search', to: '/search', icon: SearchIcon },
    { id: 'Magic Vibe', label: 'Magic Vibe', to: '/magic-vibe', badge: 'AI', icon: Sparkles },
    { id: 'Recents', label: 'Recents', to: '/recents', icon: Clock },
    { id: 'Followed artists', label: 'Followed artists', to: '/followed', icon: Users },
    { id: 'Downloaded', label: 'Downloaded', to: '/downloaded', icon: Download },
  ];

  const handleCreatePlaylist = async (e) => {
    e.stopPropagation();
    const count = playlists.length + 1;
    const defaultTitle = `My Playlist #${count}`;
    const title = window.prompt ? window.prompt('Name your new playlist:', defaultTitle) : defaultTitle;
    if (title && title.trim()) {
      const created = await createPlaylist(title.trim());
      if (created) {
        showToast(`Created Playlist: ${created.name || title}`);
        navigate(`/library/${created.id}`);
      }
    }
  };

  return (
    <aside className="w-full flex flex-col gap-3 pointer-events-auto h-full min-h-0 overflow-y-auto no-scrollbar">
      {/* CARD A: NAVIGATION CARD */}
      <nav className="sc-card sc-card-hover p-4 shrink-0" aria-label="Main Navigation">
        <ul className="space-y-1 text-xs font-medium">
          {navItems.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl transition text-left cursor-pointer ${
                    isActive
                      ? 'nav-item-active text-[#F4F4F2]'
                      : 'text-[#8A8A8E] hover:text-[#F4F4F2] hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => {
                  const Icon = item.icon;
                  return (
                    <>
                      <span className="flex items-center gap-3">
                        <span className={isActive ? 'text-[#1ED760]' : 'text-current'}>
                          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        </span>
                        <span>{item.label}</span>
                      </span>
                      {item.badge && (
                        <span className="meta-label text-[9px] px-1.5 py-0.5 rounded bg-[#1ED760]/15 text-[#1ED760]">
                          {item.badge}
                        </span>
                      )}
                    </>
                  );
                }}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* CARD C: LIBRARY CARD */}
      <section className="sc-card sc-card-hover p-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div
            onClick={() => navigate('/library')}
            className="flex items-center gap-2 text-xs font-semibold text-[#F4F4F2] cursor-pointer hover:text-[#1ED760] transition"
          >
            <span>Library</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* "+" Button to create a playlist */}
            <button
              onClick={handleCreatePlaylist}
              aria-label="Create Playlist"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            {/* Arrow-out Button */}
            <button
              onClick={() => navigate('/library')}
              aria-label="Expand Library"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div id="library-list" className="space-y-2 overflow-y-auto no-scrollbar flex-1 min-h-0">
          {/* Loading Glass Skeletons */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-1.5 rounded-2xl sc-shimmer h-12">
                <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-24 h-3 bg-white/10 rounded" />
                  <div className="w-16 h-2 bg-white/5 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3 p-1.5 rounded-2xl sc-shimmer h-12">
                <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-20 h-3 bg-white/10 rounded" />
                  <div className="w-12 h-2 bg-white/5 rounded" />
                </div>
              </div>
            </div>
          )}

          {/* Row 1: Liked Songs - Navigates directly without playing audio */}
          <div
            onClick={() => navigate('/library/liked-songs')}
            className="group flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.06] cursor-pointer transition select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-[#17171A] border border-white/10 flex items-center justify-center shadow-md shrink-0">
              <Heart className="w-4 h-4 text-[#1ED760] fill-current" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                Liked Songs
              </p>
              <div className="flex items-center gap-1 text-[10px] text-[#8A8A8E]">
                <svg className="w-3 h-3 text-[#1ED760] shrink-0 rotate-45 fill-current" viewBox="0 0 24 24">
                  <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                </svg>
                <span className="truncate">Playlist • {likedCount} songs</span>
              </div>
            </div>
          </div>

          {/* User Playlists */}
          {playlists.map((playlist, idx) => (
            <div
              key={playlist.id}
              onClick={() => navigate(`/library/${playlist.id}`)}
              className="group flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.06] cursor-pointer transition select-none"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#1ED760] shrink-0 font-mono text-[10px]">
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                  {playlist.name || playlist.title}
                </p>
                <p className="text-[10px] text-[#8A8A8E] truncate">
                  Playlist • {playlist.tracks?.length || 0} songs
                </p>
              </div>
            </div>
          ))}

          {/* Followed Artists */}
          {followedArtists?.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1">
              <span className="meta-label text-[9px] text-[#8A8A8E] block px-1">FOLLOWED ARTISTS</span>
              {followedArtists.slice(0, 5).map((artist) => (
                <div
                  key={artist.id || artist.name}
                  onClick={() => navigate(`/artist/${encodeURIComponent(artist.name)}`)}
                  className="group flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-white/[0.06] cursor-pointer transition select-none"
                >
                  <CoverImage
                    src={artist.avatar}
                    alt=""
                    iconSize="w-3.5 h-3.5"
                    className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                      {artist.name}
                    </p>
                    <p className="text-[10px] text-[#8A8A8E] truncate">Artist</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
