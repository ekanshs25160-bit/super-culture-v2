import { useState } from 'react';
import { Music } from 'lucide-react';

/**
 * CoverImage
 * Renders an image with automatic graceful fallback to a neutral graphite tile
 * and centered Music icon on load failure. Never renders browser alt text in place of art.
 */
export default function CoverImage({
  src,
  alt = '',
  className = '',
  iconSize = 'w-4 h-4',
  ...props
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const hasError = !src || failedSrc === src;

  if (hasError) {
    return (
      <div
        className={`bg-[#17171A] border border-white/10 flex items-center justify-center text-[#8A8A8E] shrink-0 select-none ${className}`}
        aria-hidden="true"
      >
        <Music className={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      onError={() => setFailedSrc(src)}
      className={className}
      {...props}
    />
  );
}
