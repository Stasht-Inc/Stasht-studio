// tests/utils/campaignCover.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// The campaign cover (Chris, 4 Nov 2026): when a campaign has no cover of its own it shows the brand (the account /
// property avatar), and that small logo was blown up full-bleed — "hugely zoomed, pixelated". The shared cover now
// shows the brand centred at a limited size over a backdrop (round when the logo is square, whole when it isn't),
// and does the same for a picture far too small for its box. Real photos stay full-bleed, exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignCoverLayout,
  BRAND_COVER_FRACTION,
  SMALL_COVER_FRACTION,
  COVER_MAX_UPSCALE,
  COVER_SMALL_SIDE,
  BRAND_CIRCLE_ASPECT,
  brandCoverColor,
  coverCenterTop,
  COVER_CENTER_Y,
  isVectorImage,
} from '../../utils/campaignCover.ts';

const desktopHeader = { width: 394, height: 600 };
const phoneHeader = { width: 390, height: 760 };
const card = { width: 300, height: 400 };

test('the limits are the ones agreed', () => {
  assert.equal(BRAND_COVER_FRACTION, 0.6);
  assert.equal(COVER_MAX_UPSCALE, 1.5);
  assert.ok(SMALL_COVER_FRACTION >= BRAND_COVER_FRACTION && SMALL_COVER_FRACTION <= 0.85);
  // Review (4 Nov): a photo only counts as too small when it is under half the box on a side.
  assert.equal(COVER_SMALL_SIDE, 0.5);
  // Review (4 Nov): the brand is cut to a circle only when it is about square — a wordmark is never cut.
  assert.deepEqual(BRAND_CIRCLE_ASPECT, [0.85, 1.18]);
});

test('a real photo bigger than its box stays full-bleed (cover)', () => {
  assert.deepEqual(campaignCoverLayout({ natural: { width: 4032, height: 3024 }, box: desktopHeader }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({ natural: { width: 1170, height: 2532 }, box: phoneHeader }), { mode: 'cover' });
  // exactly the box: no upscaling at all
  assert.deepEqual(campaignCoverLayout({ natural: { width: 394, height: 600 }, box: desktopHeader }), { mode: 'cover' });
});

test('typical dealer photos still fill the header (review: real photos must not shrink unexpectedly)', () => {
  for (const natural of [{ width: 1024, height: 576 }, { width: 640, height: 480 }, { width: 800, height: 520 }]) {
    assert.deepEqual(campaignCoverLayout({ natural, box: desktopHeader }), { mode: 'cover' }, JSON.stringify(natural));
    assert.deepEqual(campaignCoverLayout({ natural, box: phoneHeader }), { mode: 'cover' }, JSON.stringify(natural));
    assert.deepEqual(campaignCoverLayout({ natural, box: card }), { mode: 'cover' }, JSON.stringify(natural));
  }
  // 600x600 in a 390x760 phone header: needs 1.27x, but not under half the box → still full-bleed.
  assert.deepEqual(campaignCoverLayout({ natural: { width: 600, height: 600 }, box: phoneHeader }), { mode: 'cover' });
});

test('until a chosen picture has loaded it waits hidden (no stretched first frame)', () => {
  assert.deepEqual(campaignCoverLayout({ natural: null, box: desktopHeader }), { mode: 'pending' });
  assert.deepEqual(campaignCoverLayout({}), { mode: 'pending' });
  // loaded but the box isn't measured (hidden layout): as now
  assert.deepEqual(campaignCoverLayout({ natural: { width: 200, height: 200 }, box: null }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({ natural: { width: 200, height: 200 }, box: { width: 0, height: 0 } }), { mode: 'cover' });
});

test('a picture under half its box on a side is shown whole, centred, never enlarged past 1.5x', () => {
  // 200x150 in a 394x600 header (150 < 300). Fits 80% of the box at most, and 1.5x at most → 1.5x.
  const l = campaignCoverLayout({ natural: { width: 200, height: 150 }, box: desktopHeader });
  assert.deepEqual(l, { mode: 'contain', shape: 'rect', width: 300, height: 225 });
  // 256 logo-sized picture chosen as a cover in a 394x600 header: 256 < 300 → contained, 384px wide max 315 (80%).
  const k = campaignCoverLayout({ natural: { width: 256, height: 256 }, box: desktopHeader });
  assert.equal(k.mode, 'contain');
  assert.equal(k.width, Math.round(Math.min(0.8 * 394, 1.5 * 256)));
});

test('the brand default: a square logo is the round avatar, at most 60% of the box and 1.5x its own size', () => {
  // The 8abfd1b2 case: a 256px logo as the cover of a 394x600 header → 236px circle (60% of 394), not full-bleed.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 256, height: 256 }, box: desktopHeader }),
    { mode: 'contain', shape: 'circle', width: 236, height: 236 });
  // A tiny 64px logo is never enlarged past 96px.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 64, height: 64 }, box: desktopHeader }),
    { mode: 'contain', shape: 'circle', width: 96, height: 96 });
  // A big logo still stays the avatar (60% of the card's short side), never full-bleed.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 2000, height: 2000 }, box: card }),
    { mode: 'contain', shape: 'circle', width: 180, height: 180 });
  // Nearly square (0.85–1.18) still counts as square.
  assert.equal(campaignCoverLayout({ isFallback: true, natural: { width: 590, height: 500 }, box: card }).shape, 'circle');
});

test('the brand default: a wide or tall logo is never cut — shown whole (rect), 60% of the box, 1.5x at most', () => {
  // A 3:1 wordmark, 600x200, in a 394x600 header → 236x79 (60% of the width), uncut.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 600, height: 200 }, box: desktopHeader }),
    { mode: 'contain', shape: 'rect', width: 236, height: 79 });
  // A small 3:1 logo, 120x40 → 1.5x = 180x60.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 120, height: 40 }, box: desktopHeader }),
    { mode: 'contain', shape: 'rect', width: 180, height: 60 });
  // A tall logo in a card.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 200, height: 400 }, box: card }),
    { mode: 'contain', shape: 'rect', width: 120, height: 240 });
});

test('the brand default waits (hidden) until it has loaded and the box is measured', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: null, box: desktopHeader }), { mode: 'pending' });
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 256, height: 256 }, box: null }), { mode: 'pending' });
  assert.deepEqual(campaignCoverLayout({ isFallback: true }), { mode: 'pending' });
});

test('an SVG: a chosen cover fills the box at once; the brand is sized by the box alone, uncut, never waiting', () => {
  assert.deepEqual(campaignCoverLayout({ vector: true, natural: null, box: desktopHeader }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({ vector: true, natural: { width: 300, height: 150 }, box: card }), { mode: 'cover' });
  // brand SVG (its natural size may be 0 or 300x150): 60% x 60% of the box, object-contain, whatever loaded
  for (const natural of [null, { width: 0, height: 0 }, { width: 300, height: 150 }]) {
    assert.deepEqual(campaignCoverLayout({ isFallback: true, vector: true, natural, box: desktopHeader }),
      { mode: 'contain', shape: 'rect', width: 236, height: 360 });
  }
  assert.deepEqual(campaignCoverLayout({ isFallback: true, vector: true, box: null }), { mode: 'pending' });
});

test('the backdrop colour is the profile colour, with or without #, else Studio purple', () => {
  assert.equal(brandCoverColor('#1E40AF'), '#1E40AF');
  assert.equal(brandCoverColor('1e40af'), '#1e40af');
  assert.equal(brandCoverColor(''), '#6C60FF');
  assert.equal(brandCoverColor(null), '#6C60FF');
  assert.equal(brandCoverColor('not a colour'), '#6C60FF');
});

test('a contained picture sits a little above the middle (the title is at the bottom), never off the box', () => {
  assert.ok(COVER_CENTER_Y < 0.5 && COVER_CENTER_Y > 0.3);
  // phone campaign page 390x760, 232px avatar: centre at 38% → 289; spans 173–405, clear of the title block (~420)
  assert.equal(coverCenterTop(760, 232), 289);
  // a short box: pushed down so the top stays inside (12px gap)
  assert.equal(coverCenterTop(300, 230), 127);
  // a picture as tall as the box: just centred
  assert.equal(coverCenterTop(200, 200), 100);
  // a layout whose title sits higher (the phone shared view) asks for a higher spot; still kept inside the box
  assert.equal(coverCenterTop(535, 79, 0.2), 107);
  assert.equal(coverCenterTop(535, 300, 0.2), 162);
});

test('a vector picture (SVG) never counts as too small — it can be enlarged without going blurry', () => {
  assert.equal(isVectorImage('data:image/svg+xml;utf8,%3Csvg...'), true);
  assert.equal(isVectorImage('https://cdn.test/logo.svg'), true);
  assert.equal(isVectorImage('https://cdn.test/logo.SVG?v=2'), true);
  assert.equal(isVectorImage('https://cdn.test/photo.jpg'), false);
  assert.equal(isVectorImage('https://cdn.test/svg-photos/a.png'), false);
  assert.equal(isVectorImage(null), false);
});
