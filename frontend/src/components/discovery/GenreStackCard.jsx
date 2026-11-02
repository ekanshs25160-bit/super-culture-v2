import { Play } from 'lucide-react';
import CoverImage from '../shared/CoverImage';

/**
 * GenreStackCard
 * Editorial stack card with 3 overlapping album covers and play action.
 */
export default function GenreStackCard({ card, onOpen, onPlay }) {
  return (
    <div
      onClick={() => onOpen(card.slug, card.title, card.query, card.meta)}
      className="sc-card sc-card-hover group p-4 w-[175px] sm:w-[185px] shrink-0 snap-start flex flex-col justify-between cursor-pointer relative overflow-hidden"
    >
      <div>
        <span className="meta-label text-[#8A8A8E]">{card.meta}</span>
        <h3 className="font-serif text-base text-[#F4F4F2] mt-0.5">{card.title}</h3>
      </div>

      <div className="relative flex items-center my-2 h-14">
        <CoverImage
          src={card.covers[0]}
          alt=""
          iconSize="w-4 h-4"
          className="w-13 h-13 rounded-xl object-cover border-2 border-[#141416] shadow-md z-30 -rotate-2 group-hover:rotate-0 transition"
        />
        <CoverImage
          src={card.covers[1]}
          alt=""
          iconSize="w-3.5 h-3.5"
          className="w-11 h-11 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-3.5 z-20 rotate-3"
        />
        <CoverImage
          src={card.covers[2]}
          alt=""
          iconSize="w-3 h-3"
          className="w-10 h-10 rounded-xl object-cover border-2 border-[#141416] shadow-md -ml-3.5 z-10 -rotate-2"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#8A8A8E] truncate pr-2">{card.subtitle}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(card.topTrack);
          }}
          aria-label={`Play ${card.title}`}
          className="w-8 h-8 rounded-full bg-[#1ED760] text-[#0B0B0C] flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-105 shadow-[0_0_16px_rgba(30,215,96,0.4)] transition shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

