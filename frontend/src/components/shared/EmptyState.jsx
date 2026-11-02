import React from 'react';

/**
 * Reusable EmptyState component across Search, Recents, Followed Artists, and Downloads.
 * Follows the Super Culture OLED card design language with clear messaging and accessibility.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  missingEndpoint,
  actionLabel,
  onAction,
}) {
  return (
    <div className="sc-card p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto my-6 border border-white/10">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#8A8A8E] mb-3.5 shadow-inner">
          <Icon className="w-6 h-6 text-[#1ED760]" aria-hidden="true" />
        </div>
      )}

      <h3 className="font-serif italic text-lg md:text-xl font-semibold text-[#F4F4F2] mb-1.5">
        {title}
      </h3>

      <p className="text-xs text-[#8A8A8E] leading-relaxed mb-4 max-w-sm">
        {description}
      </p>

      {missingEndpoint && (
        <div className="mb-4 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760] shrink-0" aria-hidden="true"></span>
          <span className="font-mono text-[10px] text-[#8A8A8E] truncate">
            Backend Requirement: <span className="text-[#F4F4F2]">{missingEndpoint}</span>
          </span>
        </div>
      )}

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          aria-label={actionLabel}
          className="sc-pill px-4 py-2 bg-white/10 hover:bg-[#1ED760] hover:text-black text-xs font-medium text-[#F4F4F2] transition cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

