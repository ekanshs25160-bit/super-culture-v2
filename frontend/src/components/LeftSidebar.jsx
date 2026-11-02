import { useState, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { LIBRARY_TRACKS } from '../data/tracks';

export default function LeftSidebar() {
  const {
    playTrack,
    isPlaying,
    showToast,
    activeMood,
    setMood,
  } = useContext(AudioContext);

  const [activeNav, setActiveNav] = useState('Home');
  const [customPlaylists, setCustomPlaylists] = useState([]);

  const navItems = [
    {
      id: 'Home',
      label: 'Home',
      icon: (
        <svg className="w-4 h-4 text-[#1ED760] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V9.5z" />
        </svg>
      ),
    },
    {
      id: 'Search',
      label: 'Search',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
      ),
    },
    {
      id: 'Magic Vibe',
      label: 'Magic Vibe',
      badge: 'AI',
      icon: (
        <svg className="w-4 h-4 text-[#1ED760] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.9 5.8L20 10.8l-6.1 1.9L12 18.5l-1.9-5.8L4 10.8l6.1-2L12 3z" />
        </svg>
      ),
    },
    {
      id: 'Recents',
      label: 'Recents',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      id: 'Followed artists',
      label: 'Followed artists',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v6M23 11h-6" />
        </svg>
      ),
    },
    {
      id: 'Downloaded',
      label: 'Downloaded',
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
      ),
    },
  ];

  const moods = [
    {
      name: 'Energetic',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 14h7c-.4 1.8-1.8 3-3.5 3s-3.1-1.2-3.5-3z" />
        </svg>
      ),
    },
    {
      name: 'Hypnotic',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M9 10h.01M15 10h.01" strokeWidth="2.2" />
          <path strokeLinecap="round" d="M9 14.5c1.5 1.2 4.5 1.2 6 0" />
        </svg>
      ),
    },
    {
      name: 'Nocturnal',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M8.5 10.5c.5-.8 1.5-.8 2 0M13.5 10.5c.5-.8 1.5-.8 2 0" />
          <path strokeLinecap="round" d="M9 15h6" />
        </svg>
      ),
    },
    {
      name: 'Melancholic',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M9 10h.01M15 10h.01" strokeWidth="2.2" />
          <path strokeLinecap="round" d="M9 15.8c1.5-1.2 4.5-1.2 6 0" />
        </svg>
      ),
    },
  ];

  const handleCreatePlaylist = () => {
    const names = ['Tokyo Late 90s', 'Runway Casting 04', 'Analog Tape Dubs'];
    const title = names[customPlaylists.length % names.length];
    const newPlaylist = {
      id: `custom-${Date.now()}`,
      title,
      artist: 'Super Culture Editorial',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=300&q=80',
      duration: '3:55',
      seconds: 235,
      videoId: 'MV_3Dpw-BRY',
    };
    setCustomPlaylists((prev) => [...prev, newPlaylist]);
    showToast(`Created Playlist: ${title}`);
  };

  return (
    <aside className="lg:col-span-3 w-full max-w-[268px] flex flex-col gap-3 pointer-events-auto">
      {/* CARD A: NAVIGATION CARD */}
      <nav className="sc-card sc-card-hover p-4" aria-label="Main Navigation">
        <ul className="space-y-1 text-xs font-medium">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveNav(item.id);
                    showToast(`Navigated to ${item.label}`);
                  }}
                  className={`nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl transition text-left cursor-pointer ${
                    isActive
                      ? 'nav-item-active text-[#F4F4F2]'
                      : 'text-[#8A8A8E] hover:text-[#F4F4F2] hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className="meta-label text-[9px] px-1.5 py-0.5 rounded bg-[#1ED760]/15 text-[#1ED760]">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* CARD B: MOOD CARD */}
      <section className="sc-card sc-card-hover px-4 py-3.5 flex flex-col items-center">
        <div className="flex items-center justify-between w-full gap-2 mb-2.5">
          {moods.map((m, idx) => {
            const isSelected = activeMood.index === idx;
            return (
              <button
                key={m.name}
                id={`mood-btn-${idx}`}
                onClick={() => setMood(idx, m.name)}
                title={m.name}
                className={`mood-btn w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FACC15] text-[#0B0B0C] shadow-[0_0_20px_rgba(250,204,21,0.35)] scale-105'
                    : 'bg-white/[0.04] border border-white/10 text-[#8A8A8E] hover:text-[#F4F4F2] hover:border-white/25'
                }`}
              >
                {m.icon}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[#8A8A8E]">
          I feel <span id="mood-text-highlight" className="text-[#FACC15] font-medium">{activeMood.name}</span> today
        </p>
      </section>

      {/* CARD C: LIBRARY CARD */}
      <section className="sc-card sc-card-hover p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F4F2]">
            <svg className="w-4 h-4 text-[#8A8A8E]" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6v12M8 6v12M12 6l6 12" />
            </svg>
            <span>Library</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* "+" Button to create a playlist */}
            <button
              onClick={handleCreatePlaylist}
              title="Create Playlist"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
            {/* Arrow-out Button */}
            <button
              onClick={() => showToast('Expanding Full Library Archive...')}
              title="Expand Library"
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
              </svg>
            </button>
          </div>
        </div>

        <div id="library-list" className="space-y-2">
          {/* Row 1: Liked Songs */}
          <div
            onClick={() => playTrack(LIBRARY_TRACKS.likedSongs)}
            className="group flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.06] cursor-pointer transition"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#A855F7] flex items-center justify-center shadow-md shrink-0">
              <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                Liked Songs
              </p>
              <div className="flex items-center gap-1 text-[10px] text-[#8A8A8E]">
                {/* Green Pin Icon */}
                <svg className="w-3 h-3 text-[#1ED760] shrink-0 rotate-45 fill-current" viewBox="0 0 24 24">
                  <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                </svg>
                <span className="truncate">Playlist • 874 songs</span>
              </div>
            </div>
          </div>

          {/* Row 2: Followed Artist with Animated Green Equalizer */}
          <div
            onClick={() => playTrack(LIBRARY_TRACKS.fredAgain)}
            className="group flex items-center justify-between gap-3 p-1.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] cursor-pointer transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
                alt="Fred again.."
                className="w-10 h-10 rounded-full object-cover grayscale contrast-125 shrink-0 border border-white/15"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F4F4F2] truncate">Fred again..</p>
                <p className="text-[10px] text-[#8A8A8E]">Artist</p>
              </div>
            </div>
            {/* Animated Green Equalizer - Pauses when !isPlaying */}
            <div className={`flex items-end gap-[2px] h-4 px-2 ${!isPlaying ? 'paused-eq' : ''}`}>
              <span className="w-[2.5px] bg-[#1ED760] rounded-full eq-bar-1"></span>
              <span className="w-[2.5px] bg-[#1ED760] rounded-full eq-bar-2"></span>
              <span className="w-[2.5px] bg-[#1ED760] rounded-full eq-bar-3"></span>
              <span className="w-[2.5px] bg-[#1ED760] rounded-full eq-bar-4"></span>
            </div>
          </div>

          {/* Row 3: Playlist with Cover Art */}
          <div
            onClick={() => playTrack(LIBRARY_TRACKS.tapeArchive)}
            className="group flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.06] cursor-pointer transition"
          >
            <img
              src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=200&q=80"
              alt="35mm Night Archive"
              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                35mm Night Archive
              </p>
              <p className="text-[10px] text-[#8A8A8E] truncate">Playlist • Sora</p>
            </div>
          </div>

          {/* Custom Dynamically Created Playlists */}
          {customPlaylists.map((playlist, idx) => (
            <div
              key={playlist.id}
              onClick={() => playTrack(playlist)}
              className="group flex items-center gap-3 p-1.5 rounded-2xl hover:bg-white/[0.06] cursor-pointer transition"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#1ED760] shrink-0 font-mono text-[10px]">
                0{idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                  {playlist.title}
                </p>
                <p className="text-[10px] text-[#8A8A8E] truncate">Playlist • Just created</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

