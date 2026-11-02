import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioContext } from '../context/AudioContext';
import { apiClient } from '../services/api';
import {
  TRENDING_TRACKS,
  GENRE_STACKS,
  MADE_FOR_YOU_TRACK,
} from '../data/tracks';

export default function BottomDiscoveryRow() {
  const { playTrack, showToast } = useContext(AudioContext);
  const navigate = useNavigate();

  const [shelves, setShelves] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchShelves = async () => {
      try {
        const data = await apiClient.music.getHomeShelves();
        if (isMounted && data?.shelves?.length) {
          setShelves(data.shelves);
        }
      } catch (err) {
        console.warn('[BottomDiscoveryRow] Failed to load shelves, using seed fallback:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchShelves();
    return () => {
      isMounted = false;
    };
  }, []);

  const openGenre = (slug, title, query, meta) => {
    navigate('/genre/' + slug, { state: { title, query, meta } });
  };

  // Derive shelves or fallback to data/tracks.js seed
  const trendingShelf = shelves?.find((s) => s.id === 'trending_worldwide')?.items || TRENDING_TRACKS;
  const chillShelf = shelves?.find((s) => s.id === 'chill_vibes')?.items || [GENRE_STACKS.chillVibes];
  const hipHopShelf = shelves?.find((s) => s.id === 'hip_hop_essentials')?.items || [GENRE_STACKS.hipHopEssentials];
  const lateNightShelf = shelves?.find((s) => s.id === 'late_night_drive')?.items || [GENRE_STACKS.lateNightDrive];
  const madeForYouItem = shelves?.find((s) => s.id === 'made_for_you')?.items?.[0] || MADE_FOR_YOU_TRACK;

  // Normalized helper for track objects
  const normalize = (t) => ({
    ...t,
    id: t.videoId || t.id,
    videoId: t.videoId || t.id,
    cover: t.cover || t.thumbnailUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop',
    duration: t.durationFormatted || t.duration || '3:50',
    seconds: t.duration || 230,
  });

  const normalizedTrending = trendingShelf.map(normalize);
  const topChill = normalize(chillShelf[0] || GENRE_STACKS.chillVibes);
  const topHipHop = normalize(hipHopShelf[0] || GENRE_STACKS.hipHopEssentials);
  const topLateNight = normalize(lateNightShelf[0] || GENRE_STACKS.lateNightDrive);
  const normalizedMadeForYou = normalize(madeForYouItem);

  return (
    <section className="relative z-20 px-5 pb-2.5">
      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar">
        {/* Loading Glass Shimmer Skeletons */}
        {loading ? (
          <>
            <div className="sc-card sc-shimmer p-4 min-w-[530px] flex-1 h-[178px] rounded-[24px]"></div>
            <div className="sc-card sc-shimmer p-4 w-[185px] shrink-0 h-[178px] rounded-[24px]"></div>
            <div className="sc-card sc-shimmer p-4 w-[185px] shrink-0 h-[178px] rounded-[24px]"></div>
            <div className="sc-card sc-shimmer p-4 w-[185px] shrink-0 h-[178px] rounded-[24px]"></div>
            <div className="sc-card-white sc-shimmer p-4 w-[265px] shrink-0 h-[178px] rounded-[24px]"></div>
          </>
        ) : (
          <>
            {/* MODULE A: "Trending Worldwide" */}
            <div className="sc-card sc-card-hover p-4 min-w-[530px] flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-baseline gap-2.5">
                  <h2 className="font-serif italic text-lg sm:text-xl text-[#F4F4F2] tracking-tight">
                    Trending Worldwide
                  </h2>
                  <span className="meta-label text-[#8A8A8E]">GLOBAL TOP 04</span>
                </div>
                <button
                  onClick={() => showToast('Exploring Global Editorial Charts')}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </button>
              </div>

              {/* 4 Square Album Covers with Titles & Artist Names */}
              <div className="grid grid-cols-4 gap-3">
                {normalizedTrending.slice(0, 4).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, normalizedTrending)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-1.5 border border-white/10 bg-black/40">
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-2">
                        <span className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center shadow-lg transform translate-y-1 group-hover:translate-y-0 transition">
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-[#F4F4F2] truncate group-hover:text-[#1ED760] transition">
                      {track.title}
                    </p>
                    <p className="text-[10px] text-[#8A8A8E] truncate">{track.artist}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* MODULE B: 3 SMALLER OVERLAPPING THUMBNAIL CARDS */}

            {/* 1. Chill Vibes */}
            <div
              onClick={() =>
                openGenre(
                  'chill-vibes',
                  'Chill Vibes',
                  'Lo-Fi Beats Ambient',
                  'CURATED • 42 TRACKS'
                )
              }
              className="sc-card sc-card-hover group p-4 w-[185px] shrink-0 flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              <div>
                <span className="meta-label text-[#8A8A8E]">CURATED • 42 TRACKS</span>
                <h3 className="font-serif text-base text-[#F4F4F2] mt-0.5">Chill Vibes</h3>
              </div>

              {/* 3 Overlapping Cover Thumbnails */}
              <div className="relative flex items-center my-2.5 h-16">
                <img
                  src={topChill.cover}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 -rotate-3 group-hover:rotate-0 transition"
                />
                <img
                  src={chillShelf[1]?.thumbnailUrl || chillShelf[1]?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=180&q=80'}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-20 rotate-3"
                />
                <img
                  src={chillShelf[2]?.thumbnailUrl || chillShelf[2]?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=180&q=80'}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-10 -rotate-2"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8A8A8E] truncate pr-2">Ambient & Lo-Fi</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(topChill);
                  }}
                  className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 2. Hip Hop Essentials */}
            <div
              onClick={() =>
                openGenre(
                  'hip-hop-essentials',
                  'Hip Hop Essentials',
                  'Top Hip Hop Songs',
                  'ARCHIVE • 64 TRACKS'
                )
              }
              className="sc-card sc-card-hover group p-4 w-[185px] shrink-0 flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              <div>
                <span className="meta-label text-[#8A8A8E]">ARCHIVE • 64 TRACKS</span>
                <h3 className="font-serif text-base text-[#F4F4F2] mt-0.5">Hip Hop Essentials</h3>
              </div>

              {/* 3 Overlapping Cover Thumbnails */}
              <div className="relative flex items-center my-2.5 h-16">
                <img
                  src={topHipHop.cover}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 -rotate-2 group-hover:rotate-0 transition"
                />
                <img
                  src={hipHopShelf[1]?.thumbnailUrl || hipHopShelf[1]?.cover || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=180&q=80'}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-20 rotate-6"
                />
                <img
                  src={hipHopShelf[2]?.thumbnailUrl || hipHopShelf[2]?.cover || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=180&q=80'}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-10"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8A8A8E] truncate pr-2">90s — 2026 Cuts</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(topHipHop);
                  }}
                  className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 3. Late Night Drive */}
            <div
              onClick={() =>
                openGenre(
                  'late-night-drive',
                  'Late Night Drive',
                  'Synthwave and Midnight Pop',
                  'SYNTH • 38 TRACKS'
                )
              }
              className="sc-card sc-card-hover group p-4 w-[185px] shrink-0 flex flex-col justify-between cursor-pointer relative overflow-hidden"
            >
              <div>
                <span className="meta-label text-[#8A8A8E]">SYNTH • 38 TRACKS</span>
                <h3 className="font-serif text-base text-[#F4F4F2] mt-0.5">Late Night Drive</h3>
              </div>

              {/* 3 Overlapping Cover Thumbnails */}
              <div className="relative flex items-center my-2.5 h-16">
                <img
                  src={topLateNight.cover}
                  alt=""
                  className="w-14 h-14 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 rotate-2 group-hover:rotate-0 transition"
                />
                <img
                  src={lateNightShelf[1]?.thumbnailUrl || lateNightShelf[1]?.cover || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=180&q=80'}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-20 -rotate-3"
                />
                <img
                  src={lateNightShelf[2]?.thumbnailUrl || lateNightShelf[2]?.cover || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=180&q=80'}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-4 z-10 rotate-3"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8A8A8E] truncate pr-2">Tokyo Expressway</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(topLateNight);
                  }}
                  className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* MODULE C: WHITE HIGHLIGHT CARD ("Made for you") */}
            <div
              onClick={() =>
                openGenre(
                  'made-for-you',
                  'Made for you',
                  'Super Culture Select',
                  '50 TRACKS • PERSONALIZED'
                )
              }
              className="sc-card-white group p-4 w-[265px] shrink-0 flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#0B0B0C] fill-current" viewBox="0 0 24 24">
                    <path d="M12 2L14.3 9.7L22 12L14.3 14.3L12 22L9.7 14.3L2 12L9.7 9.7L12 2Z" />
                  </svg>
                  <h3 className="font-serif italic text-lg font-semibold text-[#0B0B0C]">Made for you</h3>
                </div>
                <span className="w-7 h-7 rounded-full bg-black/5 group-hover:bg-black/10 flex items-center justify-center text-[#0B0B0C] transition">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </span>
              </div>

              {/* Daily Mix Cover Art Row */}
              <div className="flex items-center gap-3 my-2">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-md shrink-0 border border-black/10 bg-black/10">
                  <img
                    src={normalizedMadeForYou.cover}
                    alt="Daily Mix 01"
                    className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition"
                  />
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[#0B0B0C]/85 text-[#F4F4F2] font-mono text-[8px]">
                    MIX 01
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="meta-label text-[#0B0B0C]/55">DAILY MIX • UPDATED</span>
                  <p className="text-xs font-semibold text-[#0B0B0C] leading-snug mt-0.5 truncate">{normalizedMadeForYou.title}</p>
                  <p className="text-[11px] text-[#0B0B0C]/65 truncate mt-0.5">{normalizedMadeForYou.artist}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-black/10">
                <span className="meta-label text-[9px] text-[#0B0B0C]/60">50 TRACKS • PERSONALIZED</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(normalizedMadeForYou);
                  }}
                  className="w-9 h-9 rounded-full bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] flex items-center justify-center shadow-[0_6px_18px_rgba(30,215,96,0.45)] group-hover:scale-105 transition cursor-pointer"
                  title="Play Daily Mix"
                >
                  <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
