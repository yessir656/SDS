// ============================================================================
// update-icon-svg.mjs — embed the master logo into public/icons/icon.svg.
//
// The PNG icon generator (generate-icons.mjs) renders everything from
// icon.svg — which is an SVG wrapper around a base64-encoded PNG of the
// DOST-MIRDC logo. Whenever public/dost-mirdc-logo.png changes, run this
// script FIRST so icon.svg picks up the new artwork, THEN generate the PNGs.
//
// Full pipeline (both steps):
//   bun run icons
//
// Run with: bun run scripts/update-icon-svg.mjs
// ============================================================================

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const LOGO_PATH = resolve(ROOT, 'public/dost-mirdc-logo.png');
const SVG_PATH = resolve(ROOT, 'public/icons/icon.svg');

async function main() {
  console.log('Embedding master logo into icon.svg');
  console.log(`  Source: ${LOGO_PATH}`);

  // Normalize to a 512×512 canvas (transparent letterbox if non-square).
  const png = await sharp(LOGO_PATH)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const base64 = png.toString('base64');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <title>DOST-MIRDC SDS-CHEM</title>
  <image href="data:image/png;base64,${base64}" width="512" height="512" x="0" y="0" />
</svg>
`;

  writeFileSync(SVG_PATH, svg);
  console.log(`  ✓ Written ${SVG_PATH} (${svg.length} bytes)`);
  console.log('  Next: run "bun run generate:icons" to rebuild the PNG set.');
}

main().catch((err) => {
  console.error('Failed to update icon.svg:', err);
  process.exit(1);
});
