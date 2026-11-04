// tests/utils/qrLogo.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// QR codes v2 (Chris, 3 Nov 2026 evening): "look at the logo?" — a BMW avatar with big empty margins drew as a tiny
// mark in the middle of the code. logoTrim finds the mark (pixels neither transparent nor near-white), and crops the
// logo to a square around it with a little padding, so the mark fills its circle. These tests trim padded logos the
// way prepareLogo does (pixels → crop box → crop), check the mark now fills the logo box, and that every code drawn
// with a trimmed logo still decodes with a real QR reader (jsQR) at 4096, 300 and 200 px, and slightly blurred.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQRModule from 'jsqr';
import { logoTrim, TRIM_PADDING } from '../../utils/qrLogo.ts';
import { qrSvg, printSafeColor } from '../../utils/qrStyle.ts';

const jsQR = jsQRModule.default ?? jsQRModule;
const URL8 = 'https://studio.stasht.com/q/K7PQ2MZX';

const svg = (body, w = 800, h = 800, bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bg}${body}</svg>`;
const WHITE_BG = (w = 800, h = 800) => `<rect width="${w}" height="${h}" fill="#fff"/>`;
// A BMW-like roundel: black outer ring, white band, blue/white quarters — only ~30% of an 800 px white JPEG, like the
// avatar in Chris's screenshot.
const roundel = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#111"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="#fff"/>` +
  `<path d="M${cx} ${cy}L${cx} ${cy - r * 0.6}A${r * 0.6} ${r * 0.6} 0 0 1 ${cx + r * 0.6} ${cy}Z" fill="#1C69D4"/>` +
  `<path d="M${cx} ${cy}L${cx} ${cy + r * 0.6}A${r * 0.6} ${r * 0.6} 0 0 1 ${cx - r * 0.6} ${cy}Z" fill="#1C69D4"/>`;
const BMW_JPEG_SVG = svg(roundel(400, 400, 120), 800, 800, WHITE_BG());
const BMW_TRANSPARENT_SVG = svg(roundel(430, 380, 110));

async function raw(input, width) {
  let img = sharp(Buffer.from(input));
  if (width) img = img.resize(width);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

/** Crop like prepareLogo: the square box (which may reach past the edges) on white (opaque) or transparent. */
async function cropToBox(buf, box, transparent) {
  const meta = await sharp(buf).metadata();
  const left = Math.round(box.x);
  const top = Math.round(box.y);
  const size = Math.round(box.size);
  const bg = transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };
  const pad = { top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + size - meta.height), right: Math.max(0, left + size - meta.width) };
  const extended = await sharp(buf).extend({ ...pad, background: bg }).png().toBuffer();
  return sharp(extended).extract({ left: left + pad.left, top: top + pad.top, width: size, height: size }).png().toBuffer();
}

/** The share of the image's width and height the mark (non-transparent, non-near-white pixels) spans. */
async function markSpan(png) {
  const { data, width, height } = await raw(png);
  let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 24 || Math.min(data[i], data[i + 1], data[i + 2]) >= 235) continue;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return { w: (x1 - x0 + 1) / width, h: (y1 - y0 + 1) / height };
}

async function trimmed(input, { transparent = false, jpeg = false } = {}) {
  let buf = await sharp(Buffer.from(input)).png().toBuffer();
  if (jpeg) buf = await sharp(buf).flatten({ background: '#fff' }).jpeg({ quality: 80 }).toBuffer();
  // prepareLogo measures a small copy (≤ 256 px) and scales the box back up to the image.
  const meta = await sharp(buf).metadata();
  const small = await raw(buf, 256);
  const box = logoTrim(small.data, small.width, small.height);
  if (!box) return { box: null, png: buf };
  const k = meta.width / small.width;
  const scaled = { x: box.x * k, y: box.y * k, size: box.size * k };
  return { box: scaled, png: await cropToBox(buf, scaled, transparent) };
}

async function decode(svgText, size, blur = 0) {
  let png = await sharp(Buffer.from(svgText)).resize(size, size).flatten({ background: '#fff' }).png().toBuffer();
  if (blur) png = await sharp(png).blur(blur).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const found = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  return found ? found.data : null;
}

const dataUri = async (png) => {
  const meta = await sharp(png).metadata();
  return { href: `data:image/png;base64,${png.toString('base64')}`, width: meta.width, height: meta.height };
};

test('a padded BMW-like JPEG avatar: trimmed to a square around the roundel; the mark fills ≥ 80% of the logo box', async () => {
  const before = await markSpan(await sharp(Buffer.from(BMW_JPEG_SVG)).png().toBuffer());
  assert.ok(before.w < 0.35, `before: the mark spans only ${(before.w * 100).toFixed(0)}% of the avatar`);
  const { box, png } = await trimmed(BMW_JPEG_SVG, { jpeg: true });
  assert.ok(box, 'trimmed');
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, meta.height, 'square');
  const after = await markSpan(png);
  assert.ok(after.w >= 0.8 && after.h >= 0.8, `after: the mark spans ${(after.w * 100).toFixed(0)}% × ${(after.h * 100).toFixed(0)}%`);
  assert.ok(after.w <= 1 / (1 + 2 * TRIM_PADDING) + 0.03, 'a little padding is kept around it');
});

test('a transparent logo off-centre: trimmed around the mark, wherever it sits', async () => {
  const { box, png } = await trimmed(BMW_TRANSPARENT_SVG, { transparent: true });
  assert.ok(box);
  const after = await markSpan(png);
  assert.ok(after.w >= 0.8 && after.h >= 0.8, `${after.w} × ${after.h}`);
  // Centred on the roundel (430, 380 of 800).
  assert.ok(Math.abs(box.x + box.size / 2 - 430) < 12 && Math.abs(box.y + box.size / 2 - 380) < 12, JSON.stringify(box));
});

// Round avatar (Chris, 4 Nov 2026): a solid tile on a margin (TheRoyalWoodShop's blue box with white lettering, a red
// square) used to be squared around its corners so the whole tile showed — a rectangle in the middle of the code. Chris
// wants the round-avatar look, so a tile (its bounding box edged all round by the mark) is cropped INSIDE the tile:
// the crop is all tile colour and the circle shows it edge to edge, like the account avatar.
const ROYAL_TILE = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#1F5FA8"/>` +
  `<g fill="#fff"><rect x="${x + w * 0.3}" y="${y + h * 0.36}" width="${w * 0.4}" height="${h * 0.07}"/><rect x="${x + w * 0.2}" y="${y + h * 0.47}" width="${w * 0.6}" height="${h * 0.1}"/><rect x="${x + w * 0.35}" y="${y + h * 0.61}" width="${w * 0.3}" height="${h * 0.05}"/></g>`;

/** Tile colour round the crop: the share of its edge pixels that are mark, and whether all four corners are. */
async function edgeFill(png) {
  const { data, width, height } = await raw(png);
  const mark = (x, y) => { const i = (y * width + x) * 4; return data[i + 3] >= 24 && Math.min(data[i], data[i + 1], data[i + 2]) < 235; };
  let hits = 0; let total = 0;
  for (let x = 0; x < width; x++) { total += 2; hits += mark(x, 1) + mark(x, height - 2); }
  for (let y = 0; y < height; y++) { total += 2; hits += mark(1, y) + mark(width - 2, y); }
  const corners = [[1, 1], [width - 2, 1], [1, height - 2], [width - 2, height - 2]].every(([x, y]) => mark(x, y));
  return { share: hits / total, corners };
}

test('a solid tile on a margin (a red square, a TheRoyalWoodShop-like box): cropped inside the tile — a round avatar', async () => {
  for (const [name, body, w, h, jpeg] of [
    ['red square on white', '<rect x="300" y="300" width="200" height="200" fill="#B91C1C"/>', 800, 800, false],
    ['wide blue box with white lettering, white JPEG margin', ROYAL_TILE(110, 220, 580, 400), 800, 800, true],
    ['wide blue box, rounded corners, transparent margin', `<g>${ROYAL_TILE(60, 40, 680, 320).replace('fill="#1F5FA8"', 'rx="24" fill="#1F5FA8"')}</g>`, 800, 400, false],
  ]) {
    const input = svg(body, w, h, jpeg ? WHITE_BG(w, h) : '');
    const { box, png } = await trimmed(input, { jpeg, transparent: !jpeg });
    assert.ok(box, `${name}: trimmed`);
    const meta = await sharp(png).metadata();
    assert.equal(meta.width, meta.height, `${name}: square`);
    const fill = await edgeFill(png);
    // Corners all tile colour (never the margin: a round crop shows tile edge to edge); the lettering may cross a
    // very wide box's sides, as it does in the account avatar.
    assert.ok(fill.corners, `${name}: the crop's corners are tile colour (inside the tile, not around it)`);
    assert.ok(fill.share >= 0.9, `${name}: the crop's edges are tile colour (${(fill.share * 100).toFixed(1)}%)`);
  }
});

test('a wide wordmark: squared around its full width, so it shows whole inside the circle', async () => {
  // Letters (separate glyphs, not a solid tile — a tile is cropped round, above).
  const glyphs = Array.from({ length: 6 }, (_, i) => `<rect x="${100 + i * 104}" y="350" width="80" height="100" rx="8" fill="#111"/>`).join('');
  const word = svg(glyphs, 800, 800, WHITE_BG());
  const { data, width, height } = await raw(word, 256);
  const box = logoTrim(data, width, height);
  assert.ok(box);
  const halfDiag = Math.hypot(600 / 2, 100 / 2) * 256 / 800;
  assert.ok(box.size / 2 >= halfDiag * 0.99, 'the wordmark\'s ends are inside the circle');
});

test('nothing to trim: a full-bleed photo / coloured square, a blank image — drawn as is (null)', async () => {
  const photo = svg('<rect width="800" height="800" fill="#1D4ED8"/><rect x="240" y="240" width="320" height="320" fill="#fff"/>');
  const p = await raw(photo, 256);
  assert.equal(logoTrim(p.data, p.width, p.height), null, 'full bleed: the corners are not background');
  const blank = svg('', 800, 800, WHITE_BG());
  const b = await raw(blank, 256);
  assert.equal(logoTrim(b.data, b.width, b.height), null, 'blank: no mark');
  const clear = await raw(svg('<circle cx="1" cy="1" r="0.2" fill="#000"/>'), 256);
  assert.equal(logoTrim(clear.data, clear.width, clear.height), null, 'transparent: no mark');
  assert.equal(logoTrim(new Uint8ClampedArray(0), 0, 0), null);
});

test('a mark already filling its image (an edge-to-edge round logo on transparent): left as it is', async () => {
  const round = svg('<circle cx="400" cy="400" r="400" fill="#00704A"/>');
  const r = await raw(round, 256);
  const box = logoTrim(r.data, r.width, r.height);
  // Either untouched, or a box no smaller than the image (only padding added).
  assert.ok(box === null || box.size >= 256 * 0.99, JSON.stringify(box));
});

test('stray JPEG noise near the edges does not stop the trim', async () => {
  const noisy = svg(roundel(400, 400, 120) + '<rect x="12" y="700" width="2" height="2" fill="#ddd"/>', 800, 800, WHITE_BG());
  const { box, png } = await trimmed(noisy, { jpeg: true });
  assert.ok(box);
  const after = await markSpan(png);
  assert.ok(after.w >= 0.8, `${after.w}`);
});

test('scans: codes drawn with the trimmed BMW-like logo decode at 4096, 300 and 200 px, and slightly blurred', async () => {
  const jpeg = await trimmed(BMW_JPEG_SVG, { jpeg: true });
  const clear = await trimmed(BMW_TRANSPARENT_SVG, { transparent: true });
  const cases = [
    { name: 'BMW-like JPEG, near-black', logo: await dataUri(jpeg.png), color: '#111827' },
    { name: 'BMW-like transparent, navy', logo: await dataUri(clear.png), color: '#1E3A8A' },
    { name: 'BMW-like JPEG, BMW blue', logo: await dataUri(jpeg.png), color: printSafeColor('#1C69D4') },
  ];
  for (const c of cases) {
    for (const background of ['white', 'transparent']) {
      const svgText = qrSvg(URL8, { color: c.color, background, logo: c.logo }, 4096);
      for (const [size, blur] of [[4096, 0], [300, 0], [200, 0], [300, 1.2]]) {
        assert.equal(await decode(svgText, size, blur), URL8, `${c.name}, ${background}, ${size}px${blur ? ' blurred' : ''}`);
      }
    }
  }
});

test('a wide image (800 × 400) whose crop is taller than the image: still trimmed, the square reaching past its edges', async () => {
  const wide = svg(roundel(400, 200, 190), 800, 400, WHITE_BG(800, 400));
  const r = await raw(wide, 256);
  const box = logoTrim(r.data, r.width, r.height);
  assert.ok(box, 'trimmed, although the square is taller than the image');
  assert.ok(box.size > r.height && box.y < 0, JSON.stringify(box));
  const { png } = await trimmed(wide, { jpeg: true });
  const meta = await sharp(png).metadata();
  assert.equal(meta.width, meta.height, 'square');
  const after = await markSpan(png);
  assert.ok(after.w >= 0.8 && after.h >= 0.8, `${after.w} × ${after.h}`);
  // A tall one too (300 × 900, a mark nearly as wide as it: the square is wider than the image).
  const tall = svg(roundel(150, 450, 146), 300, 900, WHITE_BG(300, 900));
  const t = await raw(tall, 256);
  const tb = logoTrim(t.data, t.width, t.height);
  assert.ok(tb && tb.size > t.width && tb.x < 0, JSON.stringify(tb));
  // A wordmark filling a wide image edge to edge: nothing to gain (no bigger than the image's long side).
  const lettersEdge = Array.from({ length: 8 }, (_, i) => `<rect x="${4 + i * 104}" y="60" width="64" height="120" fill="#111"/>`).join('');
  const fill = svg(lettersEdge, 800, 240, WHITE_BG(800, 240));
  const f = await raw(fill, 256);
  assert.equal(logoTrim(f.data, f.width, f.height), null);
  // A solid bar edge to edge is a tile: cropped to a square inside it (the round avatar), about the bar's height.
  const bar = svg('<rect x="4" y="60" width="792" height="120" fill="#111"/>', 800, 240, WHITE_BG(800, 240));
  const bb = await raw(bar, 256);
  const barBox = logoTrim(bb.data, bb.width, bb.height);
  const barH = (120 / 240) * bb.height;
  assert.ok(barBox && barBox.size <= barH && barBox.size >= barH * 0.85, JSON.stringify(barBox));
});

test('scans: codes drawn with a trimmed tile logo (TheRoyalWoodShop-like box on a white margin) decode at 4096, 300, 200 px and blurred', async () => {
  const tile = await trimmed(svg(ROYAL_TILE(110, 220, 580, 400), 800, 800, WHITE_BG()), { jpeg: true });
  const logo = await dataUri(tile.png);
  for (const background of ['white', 'transparent']) {
    const svgText = qrSvg(URL8, { color: printSafeColor('#1F5FA8'), background, logo }, 4096);
    for (const [size, blur] of [[4096, 0], [300, 0], [200, 0], [300, 1.2]]) {
      assert.equal(await decode(svgText, size, blur), URL8, `tile, ${background}, ${size}px${blur ? ' blurred' : ''}`);
    }
  }
});
