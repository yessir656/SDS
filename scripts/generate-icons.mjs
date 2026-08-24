// Generates PNG icons for the SDS-CHEM PWA from the source SVG.
//
// Outputs (in public/icons/):
//   - icon-16.png           (favicon, 16x16)
//   - icon-32.png           (favicon + shortcut, 32x32)
//   - icon-192.png          (PWA install / browser tab, 192x192)
//   - icon-512.png          (PWA install / browser tab, 512x512)
//   - icon-maskable-192.png (solid navy background, logo at 80% safe zone)
//   - icon-maskable-512.png (solid navy background, logo at 80% safe zone)
//
// Run with: bun run scripts/generate-icons.mjs

import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const ICONS_DIR = resolve(ROOT, 'public/icons');
const SVG_PATH = resolve(ICONS_DIR, 'icon.svg');

// DOST-MIRDC navy blue — matches the manifest theme_color and CSS --color-navy-900.
const THEME_COLOR = '#0a2540';

const SIZES = [16, 32, 192, 512];

async function generateRegular(svgBuffer, size) {
  const out = resolve(ICONS_DIR, `icon-${size}.png`);
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`  ✓ ${out}`);
}

async function generateMaskable(svgBuffer, size) {
  // Maskable icons must keep all meaningful content within the center 80%
  // (the "safe zone"). We composite the SVG at 80% scale on a solid navy
  // background so any platform mask (circle, squircle, rounded square, etc.)
  // never clips the MIRDC logo.
  const iconSize = Math.round(size * 0.8);
  const offset = Math.round((size - iconSize) / 2);

  const background = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: THEME_COLOR,
    },
  })
    .png()
    .toBuffer();

  const iconResized = await sharp(svgBuffer, { density: 384 })
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const out = resolve(ICONS_DIR, `icon-maskable-${size}.png`);
  await sharp(background)
    .composite([{ input: iconResized, top: offset, left: offset }])
    .png()
    .toFile(out);
  console.log(`  ✓ ${out}`);
}

async function main() {
  console.log('SDS-CHEM icon generator');
  console.log(`  Source SVG: ${SVG_PATH}`);
  const svgBuffer = readFileSync(SVG_PATH);

  // Regular icons for every size (including favicon sizes).
  for (const size of SIZES) {
    await generateRegular(svgBuffer, size);
  }

  // Maskable icons only for the standard PWA sizes — favicons don't need them.
  for (const size of [192, 512]) {
    await generateMaskable(svgBuffer, size);
  }

  console.log('Done. All icons generated.');
}

main().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
