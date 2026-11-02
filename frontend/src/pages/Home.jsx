import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";
import {
  Search,
  Bell,
  Settings,
  Plus,
  Sparkles,
} from "lucide-react";
import { apiClient } from "../services/apiClient";
import { useJam } from "../context/JamContext";


export default function Home() {
  const navigate = useNavigate();
  const { createRoom, currentRoom, leaveRoom } = useJam();

  const isPublicJam = currentRoom && !currentRoom.isPrivate;
  const isPrivateJam = currentRoom && currentRoom.isPrivate;

  const handleStartPublic = () => {
    if (isPublicJam) return leaveRoom();
    createRoom("My Public Jam", false);
  };

  const handleStartPrivate = () => {
    if (isPrivateJam) return leaveRoom();
    createRoom("My Private Jam", true);
  };

  const [activeRooms, setActiveRooms] = useState([]);

  useEffect(() => {
    const loadRooms = async () => {
      const rooms = await apiClient.getActivePublicRooms();
      setActiveRooms(rooms);
    };

    loadRooms();
    const interval = setInterval(loadRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden px-6 pt-4">
      {/* Fixed Top Header */}
      <div className="flex items-center justify-between w-full pb-4 shrink-0 z-20 px-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white shadow-lg overflow-hidden">
            <img
              src="src/assets/GAY-logo.png"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="bg-black/5 backdrop-blur-md px-4 py-2.5 rounded-full w-96 focus-within:w-[32rem] transition-all duration-300 flex items-center gap-3 border border-black/10 shadow-sm">
            <Search size={18} className="text-neutral-500" />
            <input
              type="text"
              onClick={() => navigate("/search")}
              placeholder="What do you want to play?"
              className="bg-transparent border-none outline-none text-black w-full text-sm placeholder:text-neutral-500 font-medium cursor-pointer"
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-black/5 backdrop-blur-md rounded-full p-1 border border-black/10 shadow-sm">
            <button
              onClick={handleStartPublic}
              className={`${isPublicJam ? "bg-white text-black font-bold shadow-sm" : "text-neutral-600 font-medium hover:bg-black/5"} px-4 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all cursor-pointer`}
            >
              <span className="text-lg leading-none">🎵</span> Public
            </button>
            <button
              onClick={handleStartPrivate}
              className={`${isPrivateJam ? "bg-white text-black font-bold shadow-sm" : "text-neutral-600 font-medium hover:bg-black/5"} px-4 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all cursor-pointer`}
            >
              <span className="text-lg leading-none">🥽</span> Private
            </button>
          </div>

          <div className="flex items-center gap-2 bg-black/5 backdrop-blur-md rounded-full p-1.5 px-3 border border-black/10 shadow-sm text-neutral-600">
            <button className="w-8 h-8 flex items-center justify-center hover:text-black transition-colors cursor-pointer">
              <Bell size={18} />
            </button>
            <button className="w-8 h-8 flex items-center justify-center hover:text-black transition-colors cursor-pointer">
              <Settings size={18} />
            </button>
            <button className="w-8 h-8 rounded-full overflow-hidden border border-black/20 hover:border-black transition-colors cursor-pointer">
              <img
                src="https://i.pravatar.cc/100?img=12"
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="flex flex-1 min-h-0 overflow-hidden pb-4 mt-2">
        <div className="ml-2">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden px-6">
          <div className="flex gap-6 flex-1 min-h-0">
            {/* Center Content: Category & Genre Cards (Module B & Module C) */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto hidden-scrollbar pb-8 rounded-[2rem]">
                <div className="space-y-6 mt-2">
                  <div className="flex items-baseline justify-between px-1">
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">
                        Curated Archives & Genres
                      </h2>
                      <p className="text-xs text-neutral-400 mt-1">
                        Select a category card to explore full lossless track collections.
                      </p>
                    </div>
                    <span className="meta-label text-neutral-400">SELECTS 04</span>
                  </div>

                  {/* Category Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                    {/* 1. Chill Vibes (Module B) */}
                    <div
                      onClick={() =>
                        navigate("/genre/chill-vibes", {
                          state: { query: "Lo-Fi Beats Ambient", title: "Chill Vibes" },
                        })
                      }
                      className="group p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 shadow-xl cursor-pointer flex flex-col justify-between min-h-[220px]"
                    >
                      <div>
                        <span className="meta-label text-[#8A8A8E] text-[10px] block">
                          CURATED • 42 TRACKS
                        </span>
                        <h3 className="font-serif text-xl font-bold text-[#F4F4F2] mt-1 tracking-tight">
                          Chill Vibes
                        </h3>
                      </div>

                      {/* 3 Overlapping Cover Thumbnails */}
                      <div className="relative flex items-center my-4 h-16">
                        <img
                          src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=180&q=80"
                          alt="Chill Vibes 01"
                          className="w-14 h-14 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 -rotate-3 group-hover:rotate-0 transition duration-300"
                        />
                        <img
                          src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=180&q=80"
                          alt="Chill Vibes 02"
                          className="w-12 h-12 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-20 rotate-3 group-hover:rotate-0 transition duration-300"
                        />
                        <img
                          src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=180&q=80"
                          alt="Chill Vibes 03"
                          className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-10 -rotate-2 group-hover:rotate-0 transition duration-300"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-[#8A8A8E] truncate pr-2 font-medium">
                          Ambient & Lo-Fi
                        </span>
                        <span className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0">
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* 2. Hip Hop Essentials (Module B) */}
                    <div
                      onClick={() =>
                        navigate("/genre/hip-hop-essentials", {
                          state: { query: "Top Hip Hop Songs", title: "Hip Hop Essentials" },
                        })
                      }
                      className="group p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 shadow-xl cursor-pointer flex flex-col justify-between min-h-[220px]"
                    >
                      <div>
                        <span className="meta-label text-[#8A8A8E] text-[10px] block">
                          ARCHIVE • 64 TRACKS
                        </span>
                        <h3 className="font-serif text-xl font-bold text-[#F4F4F2] mt-1 tracking-tight">
                          Hip Hop Essentials
                        </h3>
                      </div>

                      {/* 3 Overlapping Cover Thumbnails */}
                      <div className="relative flex items-center my-4 h-16">
                        <img
                          src="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=180&q=80"
                          alt="Hip Hop Essentials 01"
                          className="w-14 h-14 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 -rotate-2 group-hover:rotate-0 transition duration-300"
                        />
                        <img
                          src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=180&q=80"
                          alt="Hip Hop Essentials 02"
                          className="w-12 h-12 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-20 rotate-6 group-hover:rotate-0 transition duration-300"
                        />
                        <img
                          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=180&q=80"
                          alt="Hip Hop Essentials 03"
                          className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-10 group-hover:rotate-0 transition duration-300"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-[#8A8A8E] truncate pr-2 font-medium">
                          90s — 2026 Cuts
                        </span>
                        <span className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0">
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* 3. Late Night Drive (Module B) */}
                    <div
                      onClick={() =>
                        navigate("/genre/late-night-drive", {
                          state: { query: "Synthwave and Midnight Pop", title: "Late Night Drive" },
                        })
                      }
                      className="group p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:-translate-y-1 transition-all duration-300 shadow-xl cursor-pointer flex flex-col justify-between min-h-[220px]"
                    >
                      <div>
                        <span className="meta-label text-[#8A8A8E] text-[10px] block">
                          SYNTH • 38 TRACKS
                        </span>
                        <h3 className="font-serif text-xl font-bold text-[#F4F4F2] mt-1 tracking-tight">
                          Late Night Drive
                        </h3>
                      </div>

                      {/* 3 Overlapping Cover Thumbnails */}
                      <div className="relative flex items-center my-4 h-16">
                        <img
                          src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=180&q=80"
                          alt="Late Night Drive 01"
                          className="w-14 h-14 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 rotate-2 group-hover:rotate-0 transition duration-300"
                        />
                        <img
                          src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=180&q=80"
                          alt="Late Night Drive 02"
                          className="w-12 h-12 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-20 -rotate-3 group-hover:rotate-0 transition duration-300"
                        />
                        <img
                          src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=180&q=80"
                          alt="Late Night Drive 03"
                          className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-10 rotate-3 group-hover:rotate-0 transition duration-300"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <span className="text-xs text-[#8A8A8E] truncate pr-2 font-medium">
                          Tokyo Expressway
                        </span>
                        <span className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0">
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* 4. Made for you (Module C High-Contrast White Card) */}
                    <div
                      onClick={() =>
                        navigate("/genre/made-for-you", {
                          state: { query: "Super Culture Select", title: "Made for you" },
                        })
                      }
                      className="group p-5 rounded-2xl bg-[#F4F4F2] text-[#0B0B0C] hover:-translate-y-1 transition-all duration-300 shadow-2xl cursor-pointer flex flex-col justify-between min-h-[220px] border border-white/90"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={16} className="text-[#0B0B0C] fill-current" />
                          <h3 className="font-serif italic text-lg font-bold text-[#0B0B0C]">
                            Made for you
                          </h3>
                        </div>
                        <span className="w-7 h-7 rounded-full bg-black/5 group-hover:bg-black/10 flex items-center justify-center text-[#0B0B0C] transition">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                          </svg>
                        </span>
                      </div>

                      {/* Daily Mix Cover Art Row */}
                      <div className="flex items-center gap-3 my-2">
                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md shrink-0 border border-black/10">
                          <img
                            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80"
                            alt="Daily Mix 01"
                            className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition"
                          />
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#0B0B0C]/85 text-[#F4F4F2] font-mono text-[8px]">
                            MIX 01
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="meta-label text-[#0B0B0C]/60 text-[9px] block">
                            DAILY MIX • UPDATED
                          </span>
                          <p className="text-xs font-semibold text-[#0B0B0C] leading-snug mt-0.5">
                            Super Culture Select
                          </p>
                          <p className="text-[11px] text-[#0B0B0C]/70 truncate mt-0.5">
                            Aphex Twin, Tirzah, Dean Blunt
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-black/10">
                        <span className="meta-label text-[9px] text-[#0B0B0C]/60">
                          50 TRACKS • PERSONALIZED
                        </span>
                        <span className="w-8 h-8 rounded-full bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] flex items-center justify-center shadow-[0_6px_18px_rgba(30,215,96,0.45)] group-hover:scale-110 transition">
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Live Jam Rooms */}
            <div className="w-[300px] shrink-0 bg-black/40 backdrop-blur-md rounded-[2rem] p-5 shadow-2xl border border-white/5 flex flex-col h-full overflow-y-auto hidden-scrollbar relative z-10">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="font-bold text-sm text-neutral-200">
                  Live Jam Rooms
                </h3>
                <button
                  onClick={() => createRoom("Tokyo Vinyl Jam", false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-neutral-300 cursor-pointer"
                  title="Create Jam Room"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {activeRooms.length > 0 ? (
                  activeRooms.map((room) => (
                    <div
                      key={room.roomId}
                      onClick={() => navigate("/search")}
                      className="bg-[#2a2a2a] p-3 rounded-2xl flex gap-3 cursor-pointer hover:bg-[#333] transition-colors shadow-lg"
                    >
                      {room.currentTrack ? (
                        <img
                          src={room.currentTrack.albumArt}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center font-bold text-lg text-emerald-500">
                          J
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                          {room.name}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                          {room.currentTrack
                            ? room.currentTrack.title
                            : "No track playing"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-neutral-300">
                            {room.participants} listening
                          </span>
                          {room.state === "playing" && (
                            <div className="ml-auto flex gap-0.5 items-end h-3">
                              <div className="w-0.5 bg-emerald-500 h-full animate-pulse"></div>
                              <div className="w-0.5 bg-emerald-500 h-2/3 animate-pulse delay-75"></div>
                              <div className="w-0.5 bg-emerald-500 h-4/5 animate-pulse delay-150"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-neutral-500 text-center mt-10">
                    No public jam rooms active.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
