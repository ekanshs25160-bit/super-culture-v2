import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Standardized PageHeader component across all center canvas views.
 * Typography: Playfair Display serif title + monospace telemetry meta line.
 * Fixed top-left layout with optional back navigation, subtitle, and action slot.
 */
export default function PageHeader({
  title,
  meta,
  subtitle,
  backTo,
  backLabel = 'Back',
  onBack,
  children,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    }
  };

  return (
    <header className="w-full flex flex-col gap-1 mb-4 pt-0.5 shrink-0 text-left">
      {/* Top Monospace Telemetry Meta Line */}
      {meta && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ED760] glow-green-sm shrink-0" aria-hidden="true" />
          <span className="meta-label text-[10px] text-[#1ED760] tracking-widest uppercase">
            {meta}
          </span>
        </div>
      )}

      {/* Main Title Row with Optional Back Button & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {(backTo || onBack) && (
            <button
              onClick={handleBack}
              aria-label={`Go back to ${backLabel}`}
              className="sc-pill px-3 py-1 text-xs text-[#F4F4F2] hover:text-white flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          )}
          <h1 className="font-serif italic text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#F4F4F2] tracking-tight truncate">
            {title}
          </h1>
        </div>

        {children && (
          <div className="flex items-center gap-2 shrink-0">
            {children}
          </div>
        )}
      </div>

      {/* Optional Subtitle Description */}
      {subtitle && (
        <p className="text-xs text-[#8A8A8E] max-w-xl mt-0.5 leading-relaxed">
          {subtitle}
        </p>
      )}
    </header>
  );
}

