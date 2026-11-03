// tests/utils/qrStyle.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Branded QR codes (Chris, 3 Nov 2026): the dot / rounded-finder / centre-logo look, the logo's colour picked
// automatically and kept print safe, and — most important — every drawing still scans: each SVG is rendered to pixels
// (sharp) and read back with a real QR decoder (jsQR), at 4096 px and downscaled to ~300 px, with and without a logo,
// in several colours including a light yellow logo, on white and on transparent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQRModule from 'jsqr';
import {
  COLOR_PRESETS, DOT_RADIUS, alignmentCentres, FALLBACK_COLOR, LOGO_CIRCLE_RATIO, LOGO_RATIO, MIN_CONTRAST, QUIET_ZONE, contrastWithWhite, dominantColor, hexToRgb, logoFit, logoPlacement,
  normalizeHex, printSafeColor, qrDrawColor, qrLayout, qrMatrix, qrSvg, rgbToHsl, svgDataUrl,
} from '../../utils/qrStyle.ts';

const jsQR = jsQRModule.default ?? jsQRModule;
const URL8 = 'https://studio.stasht.com/q/K7PQ2MZX';
const URL16 = 'https://studio.stasht.com/q/K7PQ2MZXAB3CD4EF';
// Longer than any short URL today: version 8, with an alignment pattern under the logo.
const URL_LONG = 'https://studio.stasht.com/q/K7PQ2MZXAB3CD4EF?utm_source=print-flyer-2026';

// ── Fixture logos (PNG data URIs) ─────────────────────────────────────────
const svgLogo = (body, w = 400, h = 400) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
async function pngDataUri(svg) {
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { href: `data:image/png;base64,${buf.toString('base64')}`, width: meta.width, height: meta.height };
}
async function pixels(svg, size) {
  const { data, info } = await sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info };
}
// A round green "coffee" logo: green disc, white ring, white star (like the reference).
const GREEN_LOGO = svgLogo('<circle cx="200" cy="200" r="198" fill="#00704A"/><circle cx="200" cy="200" r="150" fill="none" stroke="#fff" stroke-width="14"/><polygon fill="#fff" points="200,90 228,170 312,170 244,220 270,300 200,250 130,300 156,220 88,170 172,170"/>');
// A light yellow logo on a transparent background (a sun) — far too light to print as is.
const YELLOW_LOGO = svgLogo('<circle cx="200" cy="200" r="120" fill="#FDE047"/><g stroke="#FDE047" stroke-width="22">' +
  [0, 45, 90, 135].map((a) => `<line x1="200" y1="20" x2="200" y2="380" transform="rotate(${a} 200 200)"/>`).join('') + '</g>');
// A black wordmark on white, wide (no brand colour: near-black fallback; fits inside the circle whole).
const WORDMARK = svgLogo('<rect width="800" height="240" fill="#fff"/><rect x="40" y="60" width="720" height="120" rx="20" fill="#111"/>', 800, 240);

async function decodeSvg(svg, size, { flatten = false, blur = 0 } = {}) {
  let img = sharp(Buffer.from(svg)).resize(size, size);
  if (flatten) img = img.flatten({ background: '#ffffff' });
  let png = await img.png().toBuffer();
  if (blur) png = await sharp(png).blur(blur).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const found = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  return found ? found.data : null;
}

test('the matrix is error correction H, smallest version that fits (version 5, 37 modules, up to a 16-character code)', () => {
  assert.equal(qrMatrix(URL8).length, 37);
  assert.equal(qrMatrix(URL16).length, 37);
  assert.equal(qrMatrix(URL_LONG).length, 49);
});

test('alignment patterns are drawn whole (rounded square + centre dot), not as dots; one under the logo is left out', () => {
  assert.deepEqual(alignmentCentres(21), []);
  assert.deepEqual(alignmentCentres(37), [[30, 30]]);
  assert.equal(alignmentCentres(49).length, 6, 'version 8: 3×3 minus the three under finders');
  const v5 = qrLayout(URL8, true);
  assert.equal((v5.alignPath.match(/M/g) || []).length, 3, 'one pattern: ring outer, ring inner, centre');
  const v8 = qrLayout(URL_LONG, true);
  assert.equal((v8.alignPath.match(/M/g) || []).length, 5 * 3, 'version 8 with a logo: the centre pattern is covered');
  assert.equal((qrLayout(URL_LONG, false).alignPath.match(/M/g) || []).length, 6 * 3);
});

test('layout: a 4-module quiet zone, three rounded finder squares, dots elsewhere, a white circle for the logo', () => {
  const plain = qrLayout(URL8, false);
  assert.equal(plain.modules, 37);
  assert.equal(plain.size, 37 + QUIET_ZONE * 2);
  assert.equal(plain.logo, null);
  assert.equal(plain.hiddenDark, 0);
  assert.equal((plain.ringsPath.match(/M/g) || []).length, 6, 'three rings, each an outer and an inner rounded square');
  assert.equal((plain.centresPath.match(/M/g) || []).length, 3);
  assert.ok(plain.ringsPath.includes('A'), 'rounded corners');
  assert.equal((plain.dotsPath.match(/M/g) || []).length, plain.darkTotal, 'every dark module outside the finders is a dot');
  assert.ok(plain.dotsPath.includes(`a${DOT_RADIUS} ${DOT_RADIUS}`), 'dots are circles');

  const branded = qrLayout(URL8, true);
  assert.ok(branded.logo);
  assert.equal(branded.logo.cx, QUIET_ZONE + 37 / 2);
  // Close to the reference (~38%): the white circle is 35% of the code's width, the logo 29% (padding around it).
  assert.equal(LOGO_CIRCLE_RATIO, 0.35);
  assert.equal(LOGO_RATIO, 0.29);
  assert.ok(Math.abs((branded.logo.circleR * 2) / 37 - 0.35) < 1e-9, 'white circle 35% of the width');
  assert.ok(Math.abs((branded.logo.imageR * 2) / 37 - 0.29) < 1e-9, 'logo 29% of the width');
  assert.ok(branded.logo.circleR - branded.logo.imageR >= 1, 'at least a module of white padding around the logo');
  assert.ok(branded.hiddenDark > 0 && branded.hiddenDark / branded.darkTotal < 0.14, `logo hides ${branded.hiddenDark}/${branded.darkTotal} dark modules — well within H's 30%`);
});

test('dominant colour: the logo\'s brand colour, ignoring transparent / white / black / grey pixels', async () => {
  const green = await pixels(GREEN_LOGO, 64);
  const g = hexToRgb(dominantColor(green.data));
  assert.ok(g.g > g.r + 60 && g.g > g.b + 20, `green logo → green (${dominantColor(green.data)})`);
  const yellow = await pixels(YELLOW_LOGO, 64);
  const y = rgbToHsl(hexToRgb(dominantColor(yellow.data)));
  assert.ok(y.h > 45 && y.h < 60 && y.l > 0.55, `yellow logo → light yellow (${dominantColor(yellow.data)})`);
  const mark = await pixels(WORDMARK, 64);
  assert.equal(dominantColor(mark.data), null, 'black and white wordmark → no colour');
  // Mostly white with a small red patch (≥ 3%): red; a few stray pixels: nothing.
  const px = (n, rgba) => Array.from({ length: n }, () => rgba).flat();
  assert.equal(dominantColor([...px(900, [255, 255, 255, 255]), ...px(100, [200, 20, 30, 255])]), '#C8141E');
  assert.equal(dominantColor([...px(990, [255, 255, 255, 255]), ...px(5, [200, 20, 30, 255])]), null);
  assert.equal(dominantColor(px(500, [200, 20, 30, 0])), null, 'transparent pixels never count');
  // Saturation weighs in: a vivid blue beats a slightly larger dull brown.
  const vivid = dominantColor([...px(100, [20, 60, 230, 255]), ...px(110, [140, 105, 80, 255])]);
  assert.equal(vivid, '#143CE6');
  assert.equal(dominantColor([]), null);
});

test('print safe colour: dark enough against white (4.5:1), same hue; none → near-black', () => {
  assert.equal(printSafeColor('#00704A'), '#00704A', 'a dark brand colour is kept');
  const safeYellow = printSafeColor('#FDE047');
  assert.ok(contrastWithWhite(safeYellow) >= MIN_CONTRAST, `${safeYellow} contrast ${contrastWithWhite(safeYellow).toFixed(2)}`);
  assert.ok(Math.abs(rgbToHsl(hexToRgb(safeYellow)).h - rgbToHsl(hexToRgb('#FDE047')).h) < 4, 'same hue');
  assert.ok(contrastWithWhite('#FDE047') < 2);
  assert.ok(contrastWithWhite(printSafeColor('#FFFFFF')) >= MIN_CONTRAST, 'even white becomes printable');
  assert.equal(printSafeColor(null), FALLBACK_COLOR);
  assert.equal(printSafeColor('red'), FALLBACK_COLOR);
  for (const p of COLOR_PRESETS) assert.equal(printSafeColor(p.hex), p.hex, `preset ${p.name} is already print safe`);
  assert.equal(qrDrawColor('#b91c1c', '#00704A'), '#B91C1C', 'a saved colour wins over the logo');
  assert.equal(qrDrawColor(null, '#00704A'), '#00704A', 'auto: the logo colour');
  assert.equal(qrDrawColor(null, null), FALLBACK_COLOR);
  assert.equal(normalizeHex(' #abcdef '), '#ABCDEF');
  assert.equal(normalizeHex('#abc'), null);
});

test('logo fit: square images fill the circle, wide wordmarks fit inside it whole', () => {
  assert.equal(logoFit(400, 400), 'cover');
  assert.equal(logoFit(800, 240), 'contain');
  const spot = { cx: 22.5, cy: 22.5, circleR: 5, imageR: 4 };
  const wide = logoPlacement(spot, 800, 240);
  assert.ok(wide.dest.w <= 4 * Math.SQRT2 + 1e-9 && Math.abs(wide.dest.w / wide.dest.h - 800 / 240) < 1e-6);
  assert.equal(logoFit(600, 400), 'contain');
  const photo = logoPlacement(spot, 450, 400);
  assert.equal(photo.fit, 'cover');
  assert.deepEqual(photo.src, { x: 25, y: 0, w: 400, h: 400 }, 'centre crop');
});

test('SVG: self-contained (logo as a data URI, nothing fetched), vector, white or transparent', async () => {
  const logo = await pngDataUri(GREEN_LOGO);
  const svg = qrSvg(URL8, { color: '#00704A', background: 'white', logo });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 45 45"/);
  assert.ok(svg.includes('href="data:image/png;base64,'));
  assert.ok(!/href="https?:/.test(svg), 'no outside links');
  assert.ok(svg.includes('<rect width="45" height="45" fill="#FFFFFF"/>'));
  assert.ok(svg.includes('fill="#00704A"'));
  const clear = qrSvg(URL8, { color: '#00704A', background: 'transparent', logo });
  assert.ok(!clear.includes('<rect width="45"'), 'transparent: no background');
  assert.ok(clear.includes('<circle') && clear.includes('fill="#FFFFFF"'), 'the logo keeps its white circle');
  // Only data: URIs are embedded; anything else draws a plain code.
  const outside = qrSvg(URL8, { color: '#00704A', background: 'white', logo: { href: 'https://evil.example/x.png', width: 10, height: 10 } });
  assert.ok(!outside.includes('<image') && !outside.includes('evil'));
  assert.ok(svgDataUrl(svg).startsWith('data:image/svg+xml;charset=utf-8,%3Csvg'));
  assert.ok(qrSvg(URL8, { color: '#FDE047', background: 'white', logo: null }).includes(`fill="${printSafeColor('#FDE047')}"`), 'drawn print safe');
});

test('scans: every look decodes with jsQR at 4096 px, downscaled to 300 and 200 px, and slightly blurred', async () => {
  const green = await pngDataUri(GREEN_LOGO);
  const yellow = await pngDataUri(YELLOW_LOGO);
  const wordmark = await pngDataUri(WORDMARK);
  const yellowAuto = qrDrawColor(null, dominantColor((await pixels(YELLOW_LOGO, 64)).data));
  const cases = [
    { name: 'green logo, auto green', text: URL8, color: '#00704A', logo: green },
    { name: 'light yellow logo, auto (darkened)', text: URL8, color: yellowAuto, logo: yellow },
    { name: 'light yellow logo, raw yellow asked (drawn print safe)', text: URL8, color: '#FDE047', logo: yellow },
    { name: 'wordmark, fallback near-black', text: URL8, color: FALLBACK_COLOR, logo: wordmark },
    ...COLOR_PRESETS.map((p) => ({ name: `preset ${p.name}, green logo`, text: URL8, color: p.hex, logo: green })),
    { name: 'no logo', text: URL8, color: '#B91C1C', logo: null },
    { name: '16-character code, logo', text: URL16, color: '#1E3A8A', logo: green },
    { name: 'version 8 (alignment pattern under the logo), logo', text: URL_LONG, color: '#166534', logo: green },
  ];
  for (const c of cases) {
    for (const background of ['white', 'transparent']) {
      const svg = qrSvg(c.text, { color: c.color, background, logo: c.logo }, 4096);
      for (const [size, blur] of [[4096, 0], [300, 0], [200, 0], [300, 1.2]]) {
        const got = await decodeSvg(svg, size, { flatten: background === 'transparent', blur });
        assert.equal(got, c.text, `${c.name}, ${background}, ${size}px${blur ? `, blurred ${blur}` : ''}`);
      }
    }
  }
});

// Why 35%: a sweep over 12 codes × 3 logos × white/transparent × (4096, 300, 200 px, blurred) decoded every one up to a
// 46% circle and first failed at 50%. This keeps that margin checked: ten more codes (other mask patterns) still scan
// at our size, and a circle a quarter wider (44%) still scans too.
test('size margin: 35% scans on many codes; a 44% circle still scans', async () => {
  const green = await pngDataUri(GREEN_LOGO);
  const yellow = await pngDataUri(YELLOW_LOGO);
  const codes = ['A7KGZTL2', 'Z6BJTSPG', 'Q2WE9RTY', 'M4NB8VCX', 'H3JK7LPA', 'T9YU2IOP', 'C5VB6NMZ', 'R8EW3QAS', 'P2LK9JHG', 'X7CV4BNM']
    .map((c) => `https://studio.stasht.com/q/${c}`);
  for (const text of codes) {
    for (const [ratio, logo, color] of [[LOGO_CIRCLE_RATIO, yellow, printSafeColor('#FDE047')], [0.44, green, '#00704A']]) {
      const svg = qrSvg(text, { color, background: 'white', logo, circleRatio: ratio }, 2048);
      for (const [size, blur] of [[300, 0], [200, 0], [300, 1.2]]) {
        assert.equal(await decodeSvg(svg, size, { blur }), text, `${text.slice(-8)} circle ${ratio}, ${size}px${blur ? ' blurred' : ''}`);
      }
    }
  }
});
