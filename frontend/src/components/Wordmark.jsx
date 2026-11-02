import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioContext } from '../context/AudioContext';
import { extractDominantColor } from '../utils/colorExtractor';

/**
 * Editorial Wordmark Component
 *
 * Interlocking masthead typography:
 * Line 1: "Super" (Playfair Display / Instrument Serif, italic)
 * Line 2: "culture" (Playfair Display / Instrument Serif, upright, offset right)
 *
 * @param {'hero' | 'compact'} variant
 * @param {string} className
 */
export default function Wordmark({ variant = 'compact', className = '' }) {
  const navigate = useNavigate();
  const { currentTrack, isPlaying } = useContext(AudioContext);
  const [glowColor, setGlowColor] = useState(null);

  // Extract cover dominant color for the hero radial glow
  useEffect(() => {
    let isCurrent = true;
    if (variant === 'hero' && isPlaying && currentTrack?.cover) {
      extractDominantColor(currentTrack.cover).then((rgb) => {
        if (isCurrent) setGlowColor(rgb);
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [variant, isPlaying, currentTrack?.cover]);

  const activeGlow = isPlaying ? glowColor : null;

  if (variant === 'hero') {
    return (
      <div
        className={`relative flex flex-col items-center justify-center select-none ${className}`}
        aria-label="Super Culture"
      >
        {/* Optional radial glow behind the hero in dominant cover hue (<= 10% opacity) */}
        {activeGlow && (
          <div
            className="absolute inset-0 -m-16 rounded-full pointer-events-none transition-opacity duration-1000 blur-3xl -z-10"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(${activeGlow}, 0.10) 0%, rgba(${activeGlow}, 0.03) 50%, transparent 75%)`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Live Typography Interlocking Editorial Masthead */}
        <div className="animate-hero-enter flex flex-col items-start leading-[0.8] text-[#F4F4F2] max-w-full">
          {/* Top Line: "Super" italic */}
          <span
            className="font-serif italic font-normal tracking-[-0.03em] leading-[0.8] text-[clamp(72px,13vw,220px)]"
            style={{
              textShadow: '0 8px 30px rgba(0,0,0,0.6)',
            }}
          >
            Super
          </span>

          {/* Bottom Line: "culture" upright, offset right to interlock with Super */}
          <span
            className="font-serif not-italic font-normal tracking-[-0.035em] leading-[0.8] pl-[0.34em] text-[clamp(72px,13vw,220px)]"
            style={{
              textShadow: '0 8px 30px rgba(0,0,0,0.6)',
            }}
          >
            culture
          </span>
        </div>
      </div>
    );
  }

  // Compact variant (all non-home routes in the top bar)
  return (
    <button
      onClick={() => navigate('/')}
      aria-label="Super Culture Home"
      className={`group flex flex-col items-start leading-[0.8] select-none text-[#F4F4F2] hover:opacity-85 active:scale-98 transition-all cursor-pointer ${className}`}
    >
      <span className="font-serif italic font-normal tracking-[-0.03em] text-[18px] sm:text-[20px] leading-[0.8] text-[#F4F4F2]">
        Super
      </span>
      <span className="font-serif not-italic font-normal tracking-[-0.035em] text-[13px] sm:text-[14px] leading-[0.8] pl-[0.52em] text-[#F4F4F2]">
        culture
      </span>
    </button>
  );
}
