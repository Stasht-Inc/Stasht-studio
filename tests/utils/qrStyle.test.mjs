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
  COLOR_PRESETS, DOT_RADIUS, alignmentCentres, FALLBACK_COLOR, LOGO_CIRCLE_RATIO, LOGO_RATIO, MIN_CONTRAST, QUIET_ZONE, contrastWithWhite, dominantColor, hexToRgb, logoPlacement,
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

// Round avatar (Chris, 4 Nov 2026): TheRoyalWoodShop's logo — a solid blue box with white lettering, wider than tall —
// drew as a rectangle in the middle. Every logo is now clipped to the logo circle. A square-ish image (an avatar)
// fills it (cover, like the account avatar). A wide or tall image, or a tile (utils/qrLogo marks it contain), is drawn
// WHOLE inside the circle — never cutting its lettering — on the circle filled with its edge colour (backdrop), so it
// still reads as one round avatar (review, 4 Nov: a centre-square crop cut "THE ROYAL" to "E ROYA").
test('logo fit: square avatars cover the circle; wide / tall images and tiles are drawn whole inside it', () => {
  const spot = { cx: 22.5, cy: 22.5, circleR: 5, imageR: 4 };
  const circleBox = { x: 18.5, y: 18.5, w: 8, h: 8 };
  const square = logoPlacement(spot, 400, 400);
  assert.equal(square.fit, 'cover');
  assert.deepEqual(square.src, { x: 0, y: 0, w: 400, h: 400 });
  assert.deepEqual(square.dest, circleBox);
  const photo = logoPlacement(spot, 450, 400);
  assert.equal(photo.fit, 'cover');
  assert.deepEqual(photo.src, { x: 25, y: 0, w: 400, h: 400 }, 'centre crop');
  // A 580 × 400 box (a = 1.45): the whole image, inscribed in the circle: w = 2r·a/√(1+a²), h = 2r/√(1+a²).
  const a = 580 / 400;
  const box = logoPlacement(spot, 580, 400);
  assert.equal(box.fit, 'contain');
  assert.deepEqual(box.src, { x: 0, y: 0, w: 580, h: 400 }, 'the whole image');
  assert.ok(Math.abs(box.dest.w - (8 * a) / Math.sqrt(1 + a * a)) < 1e-9 && Math.abs(box.dest.h - 8 / Math.sqrt(1 + a * a)) < 1e-9, JSON.stringify(box.dest));
  assert.ok(Math.abs(box.dest.x + box.dest.w / 2 - 22.5) < 1e-9 && Math.abs(box.dest.y + box.dest.h / 2 - 22.5) < 1e-9, 'centred');
  // Its corners touch the circle, never past it.
  assert.ok(Math.abs(Math.hypot(box.dest.w / 2, box.dest.h / 2) - 4) < 1e-9);
  const tall = logoPlacement(spot, 300, 900);
  assert.equal(tall.fit, 'contain');
  assert.ok(tall.dest.h > tall.dest.w);
  assert.equal(logoPlacement(spot, 800, 240).fit, 'contain');
  // A tile (contain: true from utils/qrLogo) is drawn whole even when square.
  const tile = logoPlacement(spot, 400, 400, true);
  assert.equal(tile.fit, 'contain');
  assert.ok(Math.abs(tile.dest.w - 8 / Math.SQRT2) < 1e-9);
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

// ── Round avatar (Chris, 4 Nov 2026) ─────────────────────────────────────
// A TheRoyalWoodShop-like logo: a solid blue box (full bleed: no margin), wide and square, white lettering — its middle
// line runs from 10% to 90% of the width, like "THE ROYAL / WOOD SHOP". utils/qrLogo gives the box's edge colour as
// the backdrop.
const ROYAL_BLUE = '#1F5FA8';
const royalBox = (w, h) => svgLogo(`<rect width="${w}" height="${h}" fill="${ROYAL_BLUE}"/>` +
  `<g fill="#fff"><rect x="${w * 0.3}" y="${h * 0.34}" width="${w * 0.4}" height="${h * 0.08}"/><rect x="${w * 0.1}" y="${h * 0.46}" width="${w * 0.8}" height="${h * 0.12}"/><rect x="${w * 0.35}" y="${h * 0.62}" width="${w * 0.3}" height="${h * 0.06}"/></g>`, w, h);
const ROYAL_WIDE = royalBox(580, 400);
const ROYAL_SQUARE = royalBox(400, 400);
const royal = async (logoSvg, extra = {}) => ({ ...(await pngDataUri(logoSvg)), backdrop: ROYAL_BLUE, ...extra });

/** RGB at a point given in modules, from a render of the SVG at px (transparent flattened on white). */
async function sampler(svgText, px, layoutSize) {
  const { data, info } = await sharp(Buffer.from(svgText)).resize(px, px).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  const k = px / layoutSize;
  return (mx, my) => {
    const x = Math.round(mx * k);
    const y = Math.round(my * k);
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
}
const isBlue = ([r, g, b]) => b > 120 && b - r > 60;
const isWhite = ([r, g, b]) => r > 225 && g > 225 && b > 225;

test('round avatar: a box logo fills the logo circle in its blue; the logo box\'s corners are not drawn (white ring)', async () => {
  const layout = qrLayout(URL8, true);
  const spot = layout.logo;
  for (const [name, logo] of [['wide box 580 × 400', await royal(ROYAL_WIDE)], ['square box 400 × 400', await pngDataUri(ROYAL_SQUARE)], ['square box as a tile', await royal(ROYAL_SQUARE, { contain: true })]]) {
    for (const background of ['white', 'transparent']) {
      const svg = qrSvg(URL8, { color: printSafeColor(ROYAL_BLUE), background, logo }, 1800);
      assert.ok(svg.includes('clip-path="url(#qr-logo)"'), `${name}: clipped to the circle`);
      const at = await sampler(svg, 1800, layout.size);
      // All round the circle's edge (just inside it): blue — a circle, not a rectangle.
      for (let deg = 0; deg < 360; deg += 30) {
        const r = (deg * Math.PI) / 180;
        const px = at(spot.cx + Math.cos(r) * spot.imageR * 0.92, spot.cy + Math.sin(r) * spot.imageR * 0.92);
        assert.ok(isBlue(px), `${name}, ${background}: blue at ${deg}° on the circle's edge (${px})`);
      }
      // The logo box's corners (outside the circle, inside the white ring): white, never the box's blue.
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = at(spot.cx + sx * spot.imageR * 0.8, spot.cy + sy * spot.imageR * 0.8);
        assert.ok(isWhite(px), `${name}, ${background}: corner (${sx}, ${sy}) of the logo box is white (${px})`);
      }
      assert.ok(isWhite(at(spot.cx, spot.cy - (spot.imageR + spot.circleR) / 2)), `${name}, ${background}: white ring`);
    }
  }
});

test('round avatar never cuts the mark: a wide box\'s lettering shows out to both ends (10% and 90% of its width)', async () => {
  const layout = qrLayout(URL8, true);
  const spot = layout.logo;
  const a = 580 / 400;
  const w = (2 * spot.imageR * a) / Math.sqrt(1 + a * a); // the image's drawn width (inscribed in the circle)
  const h = (2 * spot.imageR) / Math.sqrt(1 + a * a);
  const x0 = spot.cx - w / 2;
  const y0 = spot.cy - h / 2;
  for (const background of ['white', 'transparent']) {
    const svg = qrSvg(URL8, { color: printSafeColor(ROYAL_BLUE), background, logo: await royal(ROYAL_WIDE) }, 3600);
    assert.ok(/preserveAspectRatio="xMidYMid meet"/.test(svg), 'drawn whole (meet)');
    assert.ok(new RegExp(`<circle cx="[\\d.]+" cy="[\\d.]+" r="[\\d.]+" fill="${ROYAL_BLUE}"`).test(svg), 'the circle is filled with the box\'s blue first');
    const at = await sampler(svg, 3600, layout.size);
    const row = y0 + h * 0.52; // the long middle line
    for (const f of [0.12, 0.5, 0.88]) assert.ok(isWhite(at(x0 + w * f, row)), `${background}: lettering at ${f * 100}% of the width is drawn (${at(x0 + w * f, row)})`);
    for (const f of [0.04, 0.96]) assert.ok(isBlue(at(x0 + w * f, row)), `${background}: the box's blue past the lettering's ends at ${f * 100}%`);
  }
});

test('round avatar: a transparent logo still sits on the white ring; nothing drawn past the circle', async () => {
  const layout = qrLayout(URL8, true);
  const spot = layout.logo;
  const logo = await pngDataUri(YELLOW_LOGO);
  const svg = qrSvg(URL8, { color: printSafeColor('#FDE047'), background: 'transparent', logo }, 1800);
  const at = await sampler(svg, 1800, layout.size);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    assert.ok(isWhite(at(spot.cx + sx * spot.imageR * 0.8, spot.cy + sy * spot.imageR * 0.8)), `corner (${sx}, ${sy}) white`);
  }
  const centre = at(spot.cx, spot.cy);
  assert.ok(centre[0] > 200 && centre[2] < 150, `the sun shows in the middle (${centre})`);
});

test('a backdrop is only ever a plain #RRGGBB colour (nothing else reaches the SVG)', async () => {
  const logo = { ...(await pngDataUri(ROYAL_WIDE)), backdrop: 'red" onload="x' };
  const svg = qrSvg(URL8, { color: '#111827', background: 'white', logo });
  assert.ok(!svg.includes('onload') && !svg.includes('red"'));
});

test('round avatar scans: box logos (wide, square, tile) and a transparent logo decode at 4096, 300, 200 px and blurred', async () => {
  const cases = [
    { name: 'TheRoyalWoodShop-like wide box, auto blue', logo: await royal(ROYAL_WIDE), color: printSafeColor(ROYAL_BLUE) },
    { name: 'square box, near-black', logo: await pngDataUri(ROYAL_SQUARE), color: FALLBACK_COLOR },
    { name: 'square box as a tile, blue', logo: await royal(ROYAL_SQUARE, { contain: true }), color: printSafeColor(ROYAL_BLUE) },
    { name: 'transparent sun, auto', logo: await pngDataUri(YELLOW_LOGO), color: printSafeColor('#FDE047') },
    { name: 'wordmark (wide, drawn whole)', logo: await pngDataUri(WORDMARK), color: FALLBACK_COLOR },
  ];
  for (const c of cases) {
    for (const text of [URL8, URL_LONG]) {
      for (const background of ['white', 'transparent']) {
        const svg = qrSvg(text, { color: c.color, background, logo: c.logo }, 4096);
        for (const [size, blur] of [[4096, 0], [300, 0], [200, 0], [300, 1.2]]) {
          const got = await decodeSvg(svg, size, { flatten: background === 'transparent', blur });
          assert.equal(got, text, `${c.name}, ${text.length > 40 ? 'v8' : 'v5'}, ${background}, ${size}px${blur ? ', blurred' : ''}`);
        }
      }
    }
  }
});
