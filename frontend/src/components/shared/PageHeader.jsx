import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Reusable PageHeader for all center canvas views
 * Displays large serif title, OLED telemetry meta-label, optional back button & action buttons.
 */
export default function PageHeader({
  title,
  meta,
  subtitle,
  backTo,
  backLabel = 'Back',
  children,
}) {
  const navigate = useNavigate();

  return (
    <header className="flex flex-col gap-2 mb-4 pt-1 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              aria-label={`Go back to ${backLabel}`}
              className="sc-pill px-3 py-1 text-xs text-[#F4F4F2] hover:text-white flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          )}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#1ED760] glow-green-sm shrink-0" aria-hidden="true"></span>
            <h1 className="font-serif italic text-2xl md:text-3xl font-semibold text-[#F4F4F2] tracking-tight truncate">
              {title}
            </h1>
          </div>
        </div>

        {meta && (
          <span className="meta-label text-[10px] text-[#1ED760] bg-[#1ED760]/10 px-2.5 py-1 rounded-full border border-[#1ED760]/20 shrink-0">
            {meta}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {subtitle && (
          <p className="text-xs text-[#8A8A8E] max-w-xl">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="flex items-center gap-2 ml-auto">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}

