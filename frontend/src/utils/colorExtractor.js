// Cache extracted colors by URL
const colorCache = new Map();

/**
 * Extracts the dominant RGB color from an image URL on the client.
 * Returns a string formatted as "r, g, b" (e.g. "215, 60, 40") or null if failed.
 */
export async function extractDominantColor(imageUrl) {
  if (!imageUrl) return null;
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          colorCache.set(imageUrl, null);
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
          // Filter out near-black and near-white pixels to extract the vibrant tone
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
          colorCache.set(imageUrl, null);
          resolve(null);
        }
      } catch (err) {
        console.warn('[colorExtractor] Canvas security fallback:', err.message);
        colorCache.set(imageUrl, null);
        resolve(null);
      }
    };

    img.onerror = () => {
      colorCache.set(imageUrl, null);
      resolve(null);
    };
  });
}

