// tests/utils/brandPicture.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 7 Nov 2026:
//  - point 5: a campaign with no cover shows the brand logo; its cover is now ONE SOLID colour = the logo's primary
//    colour ("so in this case background would be blue" — The Royal Wood Shop's blue box), never the blurred copy.
//    Transparent / near-white / near-black edge pixels are ignored when picking; no usable colour → the caller's
//    fallback (profile colour → Studio purple).
//  - point 10: the "brand" can be the owner's profile PHOTO (a selfie). It was drawn small and whole like a logo; a
//    photo must fill the card. brandPicture tells a logo (plain / transparent edges) from a photo (busy edges).
// The pixels are made with sharp exactly as the browser sampler sees them (RGBA, longest side BRAND_SAMPLE).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { brandPicture, BRAND_SAMPLE } from '../../utils/brandPicture.ts';
import { campaignCoverLayout } from '../../utils/campaignCover.ts';

async function pixels(svg, { jpeg = false } = {}) {
  let input = Buffer.from(svg);
  if (jpeg) input = await sharp(input).flatten({ background: '#ffffff' }).jpeg({ quality: 70 }).toBuffer();
  const { data, info } = await sharp(input)
    .resize(BRAND_SAMPLE, BRAND_SAMPLE, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
const analyse = async (svg, opts) => { const p = await pixels(svg, opts); return brandPicture(p.data, p.width, p.height); };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]));
const hue = (h) => {
  const [r, g, b] = hex(h).map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  if (!d) return 0;
  const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (x * 60 + 360) % 360;
};
// Thin lettering is mostly antialiased edge at sample size: the colour must be the mark's HUE, a little darker / paler.
const sameHue = (actual, expected, label) => {
  assert.ok(actual, `${label}: a colour (got ${actual})`);
  const dh = Math.abs(hue(actual) - hue(expected));
  assert.ok(Math.min(dh, 360 - dh) <= 12 && dist(actual, expected) <= 70, `${label}: ${actual} is ${expected}'s hue (Δhue ${Math.min(dh, 360 - dh).toFixed(1)}, distance ${dist(actual, expected).toFixed(1)})`);
};
const near = (actual, expected, tol, label) => {
  assert.ok(actual, `${label}: a colour (got ${actual})`);
  assert.ok(dist(actual, expected) <= tol, `${label}: ${actual} ≈ ${expected} (distance ${dist(actual, expected).toFixed(1)})`);
};

const ROYAL_BLUE = '#0062A8';
const royalWood = (w, h, margin = 0, bg = 'none') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <rect x="${margin}" y="${margin}" width="${w - 2 * margin}" height="${h - 2 * margin}" fill="${ROYAL_BLUE}"/>
  <rect x="${margin + 0.1 * w}" y="${0.22 * h}" width="${0.8 * w - 2 * margin}" height="4" fill="#fff"/>
  <text x="${w / 2}" y="${0.5 * h}" text-anchor="middle" font-family="Georgia, serif" font-size="${0.17 * h}" font-weight="700" fill="#fff">THE ROYAL</text>
  <text x="${w / 2}" y="${0.7 * h}" text-anchor="middle" font-family="Georgia, serif" font-size="${0.17 * h}" font-weight="700" fill="#fff">WOOD SHOP</text>
  <rect x="${margin + 0.1 * w}" y="${0.78 * h}" width="${0.8 * w - 2 * margin}" height="4" fill="#fff"/>
</svg>`;

// A selfie-like photo: a busy, varied scene right up to every edge (trees, stone wall, faces, shirts).
function selfie(w = 300, h = 400) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let blobs = '';
  for (let i = 0; i < 220; i++) {
    const hue = Math.floor(rnd() * 360);
    blobs += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" r="${(6 + rnd() * 40).toFixed(1)}" fill="hsl(${hue},${30 + Math.floor(rnd() * 50)}%,${20 + Math.floor(rnd() * 60)}%)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="#7a8f6a"/>${blobs}
    <ellipse cx="${w * 0.35}" cy="${h * 0.45}" rx="${w * 0.17}" ry="${h * 0.16}" fill="#e0b090"/>
    <ellipse cx="${w * 0.7}" cy="${h * 0.5}" rx="${w * 0.15}" ry="${h * 0.14}" fill="#d8a888"/>
    <rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="#9ec3e6"/>
    <rect x="${w * 0.55}" y="${h * 0.75}" width="${w * 0.45}" height="${h * 0.25}" fill="#27466e"/>
  </svg>`;
}

// A landscape photo (the 4 Nov fixtures' PHOTO_SVG): sky, sun, two ridges.
const landscape = (w, h, hue = 205) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 2000 1500">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},70%,62%)"/><stop offset="1" stop-color="hsl(${hue + 30},80%,88%)"/></linearGradient></defs>
  <rect width="2000" height="1500" fill="url(#sky)"/>
  <circle cx="1500" cy="380" r="160" fill="#FDE68A"/>
  <polygon points="0,1100 500,520 900,1000 1300,600 2000,1150 2000,1500 0,1500" fill="hsl(${hue + 120},35%,32%)"/>
  <polygon points="0,1300 700,900 1400,1250 2000,1000 2000,1500 0,1500" fill="hsl(${hue + 120},40%,22%)"/>
</svg>`;

test('The Royal Wood Shop: a blue box filling the image (JPEG) → a logo on its own blue', async () => {
  const pic = await analyse(royalWood(600, 420), { jpeg: true });
  assert.equal(pic.kind, 'logo');
  near(pic.color, ROYAL_BLUE, 14, 'royal wood jpeg');
});

test('the same blue box on a white margin (PNG) and on a transparent margin → still the blue', async () => {
  const white = await analyse(royalWood(600, 420, 40, '#ffffff'));
  assert.equal(white.kind, 'logo');
  near(white.color, ROYAL_BLUE, 14, 'on white');
  const clear = await analyse(royalWood(600, 420, 40));
  assert.equal(clear.kind, 'logo');
  near(clear.color, ROYAL_BLUE, 14, 'on transparent');
});

test('a transparent PNG mark → a logo in the mark\'s colour (transparent pixels ignored)', async () => {
  const pic = await analyse(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <circle cx="256" cy="256" r="150" fill="#D62828"/><circle cx="256" cy="256" r="60" fill="#ffffff"/></svg>`);
  assert.equal(pic.kind, 'logo');
  near(pic.color, '#D62828', 16, 'transparent mark');
});

test('a coloured mark on white (JPEG) → its colour, never the white', async () => {
  const pic = await analyse(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300">
    <rect width="500" height="300" fill="#fff"/><text x="250" y="190" text-anchor="middle" font-family="Arial" font-size="120" font-weight="700" fill="#15803D">GREEN</text></svg>`, { jpeg: true });
  assert.equal(pic.kind, 'logo');
  sameHue(pic.color, '#15803D', 'green wordmark');
});

test('a black-on-white logo has no usable colour (null → the caller\'s profile colour / Studio purple)', async () => {
  const pic = await analyse(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" fill="#fff"/><rect x="120" y="120" width="160" height="160" fill="#000"/></svg>`, { jpeg: true });
  assert.equal(pic.kind, 'logo');
  assert.equal(pic.color, null);
});

test('a near-black box is not used as the colour; its coloured lettering is', async () => {
  const pic = await analyse(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">
    <rect width="600" height="300" fill="#0A0A0A"/><text x="300" y="190" text-anchor="middle" font-family="Arial" font-size="130" font-weight="700" fill="#F59E0B">GOLD</text></svg>`);
  assert.equal(pic.kind, 'logo');
  sameHue(pic.color, '#F59E0B', 'gold on black');
});

test('the 4 Nov wordmark fixture (navy tile on a white margin, amber accents) → the navy tile', async () => {
  const pic = await analyse(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
    <rect width="600" height="200" fill="#FFFFFF"/><rect x="10" y="10" width="580" height="180" rx="16" fill="#0F172A"/>
    <circle cx="60" cy="100" r="34" fill="#F59E0B"/><rect x="560" y="30" width="16" height="140" fill="#F59E0B"/></svg>`);
  assert.equal(pic.kind, 'logo');
  near(pic.color, '#0F172A', 20, 'navy tile');
});

test('a selfie / any real photo is a photo (it must fill the cover)', async () => {
  for (const [label, svg] of [['selfie jpg', selfie()], ['landscape', landscape(2000, 1500)], ['landscape small', landscape(240, 180, 20)]]) {
    const pic = await analyse(svg, { jpeg: true });
    assert.equal(pic.kind, 'photo', label);
  }
});

test('unreadable / empty input → null', () => {
  assert.equal(brandPicture(new Uint8ClampedArray(0), 0, 0), null);
  assert.equal(brandPicture(new Uint8ClampedArray(4 * 4 * 4), 4, 5), null);
  // fully transparent: nothing to judge
  assert.equal(brandPicture(new Uint8ClampedArray(32 * 32 * 4), 32, 32), null);
});

// ---- the cover layout with the judged kind ----
const card = { width: 290, height: 290 };

test('a brand PHOTO fills the card like a chosen photo (point 10)', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'photo', natural: { width: 480, height: 640 }, box: card }), { mode: 'cover' });
  // a genuinely tiny photo is still shown whole (the small-picture rule), not stretched
  const tiny = campaignCoverLayout({ isFallback: true, brandKind: 'photo', natural: { width: 96, height: 128 }, box: card });
  assert.equal(tiny.mode, 'contain');
  assert.equal(tiny.shape, 'rect');
  // the Storeel preview's judge box applies to brand photos too
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'photo', natural: { width: 400, height: 300 }, box: { width: 393, height: 852 }, judgeBox: { width: 393, height: 393 } }), { mode: 'cover' });
});

test('a brand LOGO (or an unknown kind) keeps the 4 Nov rules: whole, ≤ 60%, round when square', () => {
  for (const brandKind of ['logo', null, undefined]) {
    assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind, natural: { width: 600, height: 420 }, box: card }),
      { mode: 'contain', shape: 'rect', width: 174, height: 122 }, String(brandKind));
    assert.equal(campaignCoverLayout({ isFallback: true, brandKind, natural: { width: 256, height: 256 }, box: card }).shape, 'circle');
  }
});
