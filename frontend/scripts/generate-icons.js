/* global Buffer, process */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// Standard SVG Icon
const standardSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1E1E24" />
      <stop offset="100%" stop-color="#0B0B0C" />
    </radialGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#D6D6D4" />
    </linearGradient>
    <filter id="neon" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#1ED760" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)"/>
  <rect width="508" height="508" x="2" y="2" rx="110" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>

  <!-- Compact Editorial Wordmark 'S' -->
  <text
    x="256"
    y="350"
    font-family="'Playfair Display', 'Instrument Serif', Georgia, serif"
    font-size="340"
    font-style="italic"
    font-weight="400"
    fill="url(#textGrad)"
    text-anchor="middle"
    letter-spacing="-0.04em"
  >S</text>

  <!-- High-fidelity Accent Orb -->
  <circle cx="376" cy="154" r="14" fill="#1ED760" filter="url(#neon)"/>
</svg>
`;

// Maskable SVG with safe-zone margin (inner 80% circle)
const maskableSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlowMask" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#1E1E24" />
      <stop offset="100%" stop-color="#0B0B0C" />
    </radialGradient>
    <linearGradient id="textGradMask" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="100%" stop-color="#D6D6D4" />
    </linearGradient>
    <filter id="neonMask" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#1ED760" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Edge-to-edge solid background for Android masking -->
  <rect width="512" height="512" fill="url(#bgGlowMask)"/>

  <!-- Compact Wordmark 'S' scaled within 80% safe circle -->
  <g transform="translate(256, 256) scale(0.82) translate(-256, -256)">
    <text
      x="256"
      y="350"
      font-family="'Playfair Display', 'Instrument Serif', Georgia, serif"
      font-size="340"
      font-style="italic"
      font-weight="400"
      fill="url(#textGradMask)"
      text-anchor="middle"
      letter-spacing="-0.04em"
    >S</text>
    <circle cx="376" cy="154" r="14" fill="#1ED760" filter="url(#neonMask)"/>
  </g>
</svg>
`;

async function generate() {
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const standardBuffer = Buffer.from(standardSvg);
  const maskableBuffer = Buffer.from(maskableSvg);

  // 1. 192x192 PNG
  await sharp(standardBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ Generated pwa-192x192.png');

  // 2. 512x512 PNG
  await sharp(standardBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ Generated pwa-512x512.png');

  // 3. Maskable 512x512 PNG
  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'maskable-icon-512x512.png'));
  console.log('✓ Generated maskable-icon-512x512.png');

  // 4. Apple Touch Icon 180x180 PNG
  await sharp(standardBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon-180x180.png'));

  await sharp(standardBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon-180x180.png & apple-touch-icon.png');
}

generate().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
