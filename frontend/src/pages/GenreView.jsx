import React, { useState, useEffect, useContext } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  Heart,
  Search,
  Bell,
  Settings,
  Sparkles,
} from "lucide-react";
import Sidebar from "../components/layout/Sidebar";
import { useAudio } from "../hooks/useAudio";
import { UserContext } from "../context/UserContext";
import { apiClient } from "../services/apiClient";
import { useJam } from "../context/JamContext";

// Fallback mappings for genre metadata when navigated directly via URL
const GENRE_METADATA = {
  "chill-vibes": {
    title: "Chill Vibes",
    query: "Lo-Fi Beats Ambient",
    subtitle: "Curated ambient, downtempo and lo-fi tapes",
  },
  "hip-hop-essentials": {
    title: "Hip Hop Essentials",
    query: "Top Hip Hop Songs",
    subtitle: "Golden era 90s to contemporary vanguard cuts",
  },
  "late-night-drive": {
    title: "Late Night Drive",
    query: "Synthwave and Midnight Pop",
    subtitle: "Neon synthesizers, midnight pop and highway frequencies",
  },
  "made-for-you": {
    title: "Made for you",
    query: "Super Culture Select",
    subtitle: "Algorithmic and editorial recommendations tailored to your taste",
  },
};

export default function GenreView() {
  const { genreId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudio();
  const { toggleLike, isLiked } = useContext(UserContext);
  const { currentRoom, leaveRoom, createRoom } = useJam();

  const isPublicJam = currentRoom && !currentRoom.isPrivate;
  const isPrivateJam = currentRoom && currentRoom.isPrivate;

  // 1. Read genre title and search query from state or URL fallback
  const fallback = GENRE_METADATA[genreId] || {
    title: genreId
      ? genreId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Genre",
    query: genreId ? genreId.replace(/-/g, " ") : "Music",
    subtitle: "Curated editorial selections",
  };

  const genreTitle = location.state?.title || fallback.title;
  const searchQuery = location.state?.query || fallback.query;

  // 2. Fetch tracks and track state
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 3. Client-Side Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    let isMounted = true;

    const fetchGenreTracks = async () => {
      setLoading(true);
      setCurrentPage(1);
      try {
        // Fetch up to 40 tracks for client-side pagination
        const data = await apiClient.search(searchQuery, 40);
        if (isMounted) {
          setTracks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to load genre tracks:", err);
        if (isMounted) {
          setTracks([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchGenreTracks();

    return () => {
      isMounted = false;
    };
  }, [genreId, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(tracks.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTracks = tracks.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    const scrollContainer = document.getElementById("genre-scroll-container");
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden px-6 pt-4">
      {/* Top Header */}
      <div className="flex items-center justify-between w-full pb-4 shrink-0 z-20 px-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white shadow-lg overflow-hidden">
            <img
              src="/src/assets/GAY-logo.png"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
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
              onClick={() => {
                if (isPublicJam) return leaveRoom();
                createRoom("Public Jam", false);
              }}
              className={`${isPublicJam ? "bg-white text-black font-bold shadow-sm" : "text-neutral-600 font-medium hover:bg-black/5"} px-4 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all cursor-pointer`}
            >
              <span className="text-lg leading-none">🎵</span> Public
            </button>
            <button
              onClick={() => {
                if (isPrivateJam) return leaveRoom();
                createRoom("Private Jam", true);
              }}
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

      {/* Main Content Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden pb-4 mt-2">
        <div className="ml-2">
          <Sidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden px-6">
          <div
            id="genre-scroll-container"
            className="flex-1 overflow-y-auto hidden-scrollbar pb-12 pr-2"
          >
            {/* Header & Back Button */}
            <div className="flex items-center justify-between mt-2 mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/")}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 shadow-md cursor-pointer"
                  title="Back to Genres"
                >
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">
                      {genreTitle}
                    </h1>
                    <span className="meta-label px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px]">
                      GENRE VIEW
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 font-medium">
                    {fallback.subtitle}
                  </p>
                </div>
              </div>

              {/* Total Tracks Count */}
              {!loading && tracks.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{tracks.length} tracks cataloged</span>
                </div>
              )}
            </div>

            {/* Loading State: Glassmorphic Spinner */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-neutral-400 font-medium text-sm">
                  Curating {genreTitle} track signals...
                </p>
              </div>
            ) : currentTracks.length > 0 ? (
              <>
                {/* 4. Responsive CSS Grid for Sliced Tracks */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {currentTracks.map((track) => {
                    const isCurrent = currentTrack?.id === track.id || (currentTrack?.videoId && track.videoId === currentTrack.videoId);

                    return (
                      <div
                        key={track.id || track.videoId}
                        onClick={() =>
                          isCurrent ? togglePlay() : playTrack(track, tracks)
                        }
                        className="sc-card-hover group relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3 cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
                      >
                        {/* Album Art with Play/Pause Overlay */}
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-md mb-3 bg-neutral-900">
                          <img
                            src={track.albumArt || track.thumbnail_url}
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />

                          {/* Like Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(track);
                            }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-emerald-400 hover:bg-black/80 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10 cursor-pointer shadow-md"
                            title="Save Track"
                          >
                            <Heart
                              size={14}
                              className={
                                isLiked(track.id)
                                  ? "fill-emerald-400 text-emerald-400"
                                  : "text-neutral-300"
                              }
                            />
                          </button>

                          {/* Play/Pause Overlay */}
                          <div
                            className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300 ${
                              isCurrent
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                          >
                            <div className="w-11 h-11 rounded-full bg-[#1ED760] text-black flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform shadow-xl shadow-emerald-500/40">
                              {isCurrent && isPlaying ? (
                                <Pause size={18} fill="currentColor" />
                              ) : (
                                <Play
                                  size={18}
                                  fill="currentColor"
                                  className="ml-0.5"
                                />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Track Info */}
                        <div className="space-y-0.5 min-w-0">
                          <h4
                            className={`font-semibold text-xs truncate transition-colors ${
                              isCurrent ? "text-emerald-400" : "text-white"
                            }`}
                            title={track.title}
                          >
                            {track.title}
                          </h4>
                          <p
                            className="text-[11px] text-neutral-400 truncate font-medium"
                            title={track.artist}
                          >
                            {track.artist}
                          </p>
                          {track.duration && (
                            <span className="meta-label text-[9px] text-neutral-500 block pt-0.5">
                              {track.duration}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 5. Pagination Controls: Frosted .sc-pill Buttons */}
                <div className="flex items-center justify-center gap-4 mt-10 pb-8">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="sc-pill px-5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 border border-white/10 bg-white/5 backdrop-blur-md text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/15 cursor-pointer shadow-lg"
                  >
                    Previous Page
                  </button>

                  <div className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                    <span className="text-xs font-mono text-neutral-300">
                      Page <span className="text-emerald-400 font-bold">{currentPage}</span> of {totalPages}
                    </span>
                  </div>

                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="sc-pill px-5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 border border-white/10 bg-white/5 backdrop-blur-md text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/15 cursor-pointer shadow-lg"
                  >
                    Next Page
                  </button>
                </div>
              </>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 mb-3">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-lg font-bold text-white">No tracks found</h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  We couldn't retrieve signals for &ldquo;{searchQuery}&rdquo;. Try another genre.
                </p>
                <button
                  onClick={() => navigate("/")}
                  className="mt-4 px-4 py-2 rounded-full bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition cursor-pointer"
                >
                  Return to Curated Genres
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
