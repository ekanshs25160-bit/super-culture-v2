// Cache extracted colors by URL
const colorCache = new Map();

/**
 * Deterministically generates an editorial RGB color by hashing a string URL.
 * Guarantees ambient glow always operates without CORS errors.
 */
function getDeterministicFallbackColor(str) {
  if (!str) return '30, 215, 96';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const r = 40 + (Math.abs(hash) % 160);
  const g = 40 + (Math.abs(hash >> 8) % 160);
  const b = 40 + (Math.abs(hash >> 16) % 160);
  return `${r}, ${g}, ${b}`;
}

/**
 * Extracts the dominant RGB color from an image URL on the client.
 * Returns a string formatted as "r, g, b" (e.g. "215, 60, 40").
 */
export async function extractDominantColor(imageUrl) {
  if (!imageUrl) return null;
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl);
  }

  if (typeof Image === 'undefined') {
    const fallback = getDeterministicFallbackColor(imageUrl);
    colorCache.set(imageUrl, fallback);
    return fallback;
  }

  return new Promise((resolve) => {
    const img = new Image();
    // Ensure Anonymous crossOrigin is configured strictly before setting src
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          const fallback = getDeterministicFallbackColor(imageUrl);
          colorCache.set(imageUrl, fallback);
          resolve(fallback);
          return;
        }

        ctx.drawImage(img, 0, 0, 16, 16);

        let data;
        try {
          data = ctx.getImageData(0, 0, 16, 16).data;
        } catch {
          // CORS SecurityError fallback (e.g. i.ytimg.com)
          const fallback = getDeterministicFallbackColor(imageUrl);
          colorCache.set(imageUrl, fallback);
          resolve(fallback);
          return;
        }

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
          if (brightness > 25 && brightness < 235) {
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
        }

        if (count > 0) {
          const rgb = `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`;
          colorCache.set(imageUrl, rgb);
          resolve(rgb);
        } else {
          const fallback = getDeterministicFallbackColor(imageUrl);
          colorCache.set(imageUrl, fallback);
          resolve(fallback);
        }
      } catch {
        const fallback = getDeterministicFallbackColor(imageUrl);
        colorCache.set(imageUrl, fallback);
        resolve(fallback);
      }
    };

    img.onerror = () => {
      const fallback = getDeterministicFallbackColor(imageUrl);
      colorCache.set(imageUrl, fallback);
      resolve(fallback);
    };
  });
}
