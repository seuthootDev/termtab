// npm run icons → icons/icon.svg plus icons/icon-{16,32,48,128}.png and store/promo-440x280.png.
// The glyph is drawn with paths (no font), so the icon looks the same on every machine.
// Small sizes get a simplified drawing: bigger traffic lights and a thicker prompt.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = fileURLToPath(new URL('../', import.meta.url));
const C = { win: '#1e1e1e', bar: '#2e2e2e', edge: '#4a4a4a', text: '#d4d4d4', green: '#98c379', r: '#ff5f57', y: '#febc2e', g: '#28c840' };

/** The window artwork in a 100×100 box. `small` is the 16/32 px variant. */
function artwork(small) {
  const dot = small ? { r: 9, y: 17, xs: [17, 42, 67] } : { r: 6, y: 13, xs: [14, 30, 46] };
  const bar = small ? 33 : 25;
  const chev = small ? { pts: '20,48 40,64 20,80', w: 13 } : { pts: '22,46 40,61 22,76', w: 9 };
  const cur = small ? { x: 48, y: 71, w: 34, h: 12 } : { x: 48, y: 69, w: 30, h: 8 };
  const rx = small ? 16 : 14;
  return [
    `<rect x="0.75" y="0.75" width="98.5" height="98.5" rx="${rx}" fill="${C.win}" stroke="${C.edge}" stroke-width="${small ? 0 : 1.5}"/>`,
    small ? '' : `<path d="M0.75 ${bar} V${rx + 0.75} a${rx} ${rx} 0 0 1 ${rx} -${rx} H${99.25 - rx} a${rx} ${rx} 0 0 1 ${rx} ${rx} V${bar} Z" fill="${C.bar}"/>`,
    ...dot.xs.map((x, i) => `<circle cx="${x}" cy="${dot.y}" r="${dot.r}" fill="${[C.r, C.y, C.g][i]}"/>`),
    `<polyline points="${chev.pts}" fill="none" stroke="${C.green}" stroke-width="${chev.w}" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<rect x="${cur.x}" y="${cur.y}" width="${cur.w}" height="${cur.h}" rx="2" fill="${C.text}"/>`,
  ].join('\n  ');
}

/** Full SVG for one icon size. 128 keeps the store's 16 px transparent margin (96 px artwork). */
export function iconSvg(size) {
  const small = size <= 32;
  const pad = size >= 128 ? 16 : 0;
  const scale = (size - 2 * pad) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${pad} ${pad}) scale(${scale})">
  ${artwork(small)}
  </g>
</svg>
`;
}

function promoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2f45"/><stop offset="1" stop-color="#14161f"/></linearGradient></defs>
  <rect width="440" height="280" fill="url(#bg)"/>
  <g transform="translate(36 80) scale(1.2)">${artwork(false)}</g>
  <text x="178" y="136" font-family="Cascadia Mono, Consolas, Menlo, monospace" font-size="44" font-weight="bold" fill="${C.text}">termtab</text>
  <text x="180" y="168" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="16" fill="${C.green}">Your new tab, as a macOS Terminal</text>
  <text x="180" y="192" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" fill="#8a8a8a">free · no permissions to fear</text>
</svg>
`;
}

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng();

writeFileSync(join(root, 'icons', 'icon.svg'), iconSvg(128));
for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(root, 'icons', `icon-${size}.png`), png(iconSvg(size), size));
  console.log(`icons/icon-${size}.png`);
}
mkdirSync(join(root, 'store'), { recursive: true });
writeFileSync(join(root, 'store', 'promo-440x280.png'), png(promoSvg(), 440));
console.log('store/promo-440x280.png');
// A zoomed preview of the small sizes for review (not committed).
if (process.argv.includes('--preview')) {
  const big = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s * 8}" height="${s * 8}"><image width="${s * 8}" height="${s * 8}" style="image-rendering:pixelated" href="data:image/png;base64,${png(iconSvg(s), s).toString('base64')}"/></svg>`;
  for (const s of [16, 32]) writeFileSync(join(root, 'dist', `preview-${s}.png`), png(big(s), s * 8));
}
