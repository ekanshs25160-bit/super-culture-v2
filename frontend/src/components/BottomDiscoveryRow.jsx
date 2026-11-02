import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play, Sparkles } from 'lucide-react';
import { AudioContext } from '../context/AudioContext';
import { apiClient } from '../services/api';
import GenreStackCard from './discovery/GenreStackCard';
import CoverImage from './shared/CoverImage';
import {
  TRENDING_TRACKS,
  GENRE_STACKS,
  MADE_FOR_YOU_TRACK,
} from '../data/tracks';

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=544&h=544&fit=crop';

export default function BottomDiscoveryRow() {
  const { playTrack, showToast } = useContext(AudioContext);
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  const [shelves, setShelves] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchShelves = async () => {
      try {
        const data = await apiClient.music.getHomeShelves();
        if (isMounted && data?.shelves?.length) {
          setShelves(data.shelves);
        }
      } catch (err) {
        console.warn('[BottomDiscoveryRow] Fallback to seed data:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchShelves();
    return () => {
      isMounted = false;
    };
  }, []);

  const checkScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollState();
    el.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);
    return () => {
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [loading, shelves]);

  const scrollByCard = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = dir === 'left' ? -340 : 340;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const openGenre = (slug, title, query, meta) => {
    navigate('/genre/' + slug, { state: { title, query, meta } });
  };

  const normalize = (t) => ({
    ...t,
    id: t?.videoId || t?.id,
    videoId: t?.videoId || t?.id,
    cover: t?.cover || t?.thumbnailUrl || FALLBACK_COVER,
    duration: t?.durationFormatted || t?.duration || '3:50',
    seconds: t?.duration || 230,
  });

  const trendingShelf = shelves?.find((s) => s.id === 'trending_worldwide')?.items || TRENDING_TRACKS;
  const chillShelf = shelves?.find((s) => s.id === 'chill_vibes')?.items || [GENRE_STACKS.chillVibes];
  const hipHopShelf = shelves?.find((s) => s.id === 'hip_hop_essentials')?.items || [GENRE_STACKS.hipHopEssentials];
  const lateNightShelf = shelves?.find((s) => s.id === 'late_night_drive')?.items || [GENRE_STACKS.lateNightDrive];
  const madeForYouItem = shelves?.find((s) => s.id === 'made_for_you')?.items?.[0] || MADE_FOR_YOU_TRACK;

  const normalizedTrending = trendingShelf.map(normalize);
  const topChill = normalize(chillShelf[0] || GENRE_STACKS.chillVibes);
  const topHipHop = normalize(hipHopShelf[0] || GENRE_STACKS.hipHopEssentials);
  const topLateNight = normalize(lateNightShelf[0] || GENRE_STACKS.lateNightDrive);
  const normalizedMadeForYou = normalize(madeForYouItem);

  const genreCards = [
    {
      slug: 'chill-vibes',
      title: 'Chill Vibes',
      query: 'Lo-Fi Beats Ambient',
      meta: 'CURATED • 42 TRACKS',
      subtitle: 'Ambient & Lo-Fi',
      topTrack: topChill,
      covers: [topChill.cover, chillShelf[1]?.thumbnailUrl || chillShelf[1]?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=180&q=80', chillShelf[2]?.thumbnailUrl || chillShelf[2]?.cover || FALLBACK_COVER],
    },
    {
      slug: 'hip-hop-essentials',
      title: 'Hip Hop Essentials',
      query: 'Top Hip Hop Songs',
      meta: 'ARCHIVE • 64 TRACKS',
      subtitle: '90s — 2026 Cuts',
      topTrack: topHipHop,
      covers: [topHipHop.cover, hipHopShelf[1]?.thumbnailUrl || hipHopShelf[1]?.cover || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=180&q=80', hipHopShelf[2]?.thumbnailUrl || hipHopShelf[2]?.cover || FALLBACK_COVER],
    },
    {
      slug: 'late-night-drive',
      title: 'Late Night Drive',
      query: 'Synthwave and Midnight Pop',
      meta: 'SYNTH • 38 TRACKS',
      subtitle: 'Tokyo Expressway',
      topTrack: topLateNight,
      covers: [topLateNight.cover, lateNightShelf[1]?.thumbnailUrl || lateNightShelf[1]?.cover || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=180&q=80', lateNightShelf[2]?.thumbnailUrl || lateNightShelf[2]?.cover || FALLBACK_COVER],
    },
  ];

  return (
    <section className="relative z-20 w-full max-w-full pb-1 pointer-events-auto">
      {/* Scroll Navigation Controls (subtle pill buttons) */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="meta-label text-[#8A8A8E]">EDITORIAL ARCHIVES</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scrollByCard('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll shelves left"
            className={`w-6 h-6 rounded-full border border-white/10 flex items-center justify-center transition cursor-pointer ${
              canScrollLeft ? 'bg-white/10 text-[#F4F4F2] hover:bg-white/20' : 'bg-transparent text-white/20 opacity-40 cursor-default'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => scrollByCard('right')}
            disabled={!canScrollRight}
            aria-label="Scroll shelves right"
            className={`w-6 h-6 rounded-full border border-white/10 flex items-center justify-center transition cursor-pointer ${
              canScrollRight ? 'bg-white/10 text-[#F4F4F2] hover:bg-white/20' : 'bg-transparent text-white/20 opacity-40 cursor-default'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Scroll-Snap Container */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth px-0.5 pb-1"
        style={{ scrollPaddingRight: '20px', scrollPaddingLeft: '4px' }}
      >
        {loading ? (
          <>
            <div className="sc-card sc-shimmer p-4 min-w-[380px] flex-1 h-[178px] rounded-[24px] snap-start" />
            <div className="sc-card sc-shimmer p-4 w-[180px] shrink-0 h-[178px] rounded-[24px] snap-start" />
            <div className="sc-card sc-shimmer p-4 w-[180px] shrink-0 h-[178px] rounded-[24px] snap-start" />
            <div className="sc-card sc-shimmer p-4 w-[180px] shrink-0 h-[178px] rounded-[24px] snap-start" />
            <div className="sc-card-white sc-shimmer p-4 w-[250px] shrink-0 h-[178px] rounded-[24px] snap-start" />
          </>
        ) : (
          <>
            {/* MODULE A: Trending Worldwide */}
            <div className="sc-card sc-card-hover p-4 min-w-[340px] sm:min-w-[420px] md:min-w-[460px] max-w-[500px] flex-1 shrink-0 snap-start flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-serif italic text-lg sm:text-xl text-[#F4F4F2] tracking-tight">
                    Trending Worldwide
                  </h2>
                  <span className="meta-label text-[#8A8A8E]">GLOBAL TOP 04</span>
                </div>
                <button
                  onClick={() => showToast('Exploring Global Editorial Charts')}
                  aria-label="Explore Global Editorial Charts"
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-[#F4F4F2] transition cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current ml-0.5" aria-hidden="true" />
                </button>
              </div>

              {/* 4 Square Album Covers */}
              <div className="grid grid-cols-4 gap-2.5">
                {normalizedTrending.slice(0, 4).map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, normalizedTrending)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-1 border border-white/10 bg-black/40">
                      <CoverImage
                        src={track.cover}
                        alt=""
                        iconSize="w-5 h-5"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition flex items-end justify-end p-1.5">
                        <span className="w-7 h-7 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center shadow-lg transition">
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
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

            {/* MODULE B: 3 Genre Stack Cards */}
            {genreCards.map((card) => (
              <GenreStackCard
                key={card.slug}
                card={card}
                onOpen={openGenre}
                onPlay={playTrack}
              />
            ))}

            {/* MODULE C: White Highlight Card ("Made for you") */}
            <div
              onClick={() =>
                openGenre('made-for-you', 'Made for you', 'Super Culture Select', '50 TRACKS • PERSONALIZED')
              }
              className="sc-card-white group p-4 w-[240px] sm:w-[260px] shrink-0 snap-start flex flex-col justify-between cursor-pointer mr-1"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#0B0B0C] fill-current" aria-hidden="true" />
                  <h3 className="font-serif italic text-lg font-semibold text-[#0B0B0C]">Made for you</h3>
                </div>
                <span className="meta-label text-[9px] text-[#0B0B0C]/60">DAILY MIX</span>
              </div>

              <div className="flex items-center gap-2.5 my-2">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md shrink-0 border border-black/10 bg-black/10">
                  <CoverImage
                    src={normalizedMadeForYou.cover}
                    alt=""
                    iconSize="w-5 h-5"
                    className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition"
                  />
                  <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-[#0B0B0C]/85 text-[#F4F4F2] font-mono text-[7px]">
                    MIX 01
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="meta-label text-[#0B0B0C]/55 text-[9px]">UPDATED</span>
                  <p className="text-xs font-semibold text-[#0B0B0C] leading-snug truncate mt-0.5">
                    {normalizedMadeForYou.title}
                  </p>
                  <p className="text-[11px] text-[#0B0B0C]/65 truncate mt-0.5">{normalizedMadeForYou.artist}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-black/10">
                <span className="meta-label text-[9px] text-[#0B0B0C]/60">50 TRACKS</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(normalizedMadeForYou);
                  }}
                  aria-label="Play Daily Mix"
                  className="w-8 h-8 rounded-full bg-[#1ED760] hover:bg-[#22e868] text-[#0B0B0C] flex items-center justify-center shadow-[0_4px_14px_rgba(30,215,96,0.45)] group-hover:scale-105 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
