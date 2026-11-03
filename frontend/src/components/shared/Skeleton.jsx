import React from 'react';
import { useServerWakeState } from '../../services/api';

/**
 * Animated banner notifying users when Render free-tier cold-start is in progress (>3s)
 */
export function ServerWakeBadge() {
  const isWakingUp = useServerWakeState();
  if (!isWakingUp) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono animate-pulse select-none"
    >
      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block shrink-0" />
      <span>Waking up the server...</span>
    </div>
  );
}

/**
 * Reusable loading skeletons with .sc-shimmer glass effect.
 */
export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`sc-shimmer rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

Skeleton.WakeBadge = ServerWakeBadge;

Skeleton.Row = function SkeletonRow({ count = 3 }) {
  return (
    <div className="space-y-2 w-full" aria-label="Loading tracks" aria-busy="true">
      <ServerWakeBadge />
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="sc-card sc-shimmer p-2.5 h-14 rounded-2xl flex items-center justify-between gap-3"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0" />
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <div className="h-3 w-32 bg-white/10 rounded" />
              <div className="h-2.5 w-20 bg-white/5 rounded" />
            </div>
          </div>
          <div className="h-3 w-10 bg-white/10 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
};

Skeleton.Card = function SkeletonCard() {
  return (
    <div
      className="sc-card sc-shimmer p-3.5 rounded-2xl aspect-square flex flex-col justify-between"
      aria-hidden="true"
    >
      <div className="w-full h-3/4 rounded-xl bg-white/10" />
      <div className="space-y-1.5 mt-2">
        <div className="h-3 w-28 bg-white/10 rounded" />
        <div className="h-2 w-16 bg-white/5 rounded" />
      </div>
    </div>
  );
};

Skeleton.Grid = function SkeletonGrid({ count = 6 }) {
  return (
    <div className="w-full" aria-label="Loading content" aria-busy="true">
      <ServerWakeBadge />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton.Card key={i} />
        ))}
      </div>
    </div>
  );
};
