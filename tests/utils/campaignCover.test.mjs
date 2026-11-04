// tests/utils/campaignCover.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// The campaign cover (Chris, 4 Nov 2026): when a campaign has no cover of its own it shows the brand (the account /
// property avatar), and that small logo was blown up full-bleed — "hugely zoomed, pixelated". The shared cover now
// shows the brand as the round avatar, centred, at a limited size over a blurred copy of itself, and does the same
// kind of thing for any picture too small for its box. Real photos stay full-bleed, exactly as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignCoverLayout,
  BRAND_COVER_FRACTION,
  SMALL_COVER_FRACTION,
  COVER_MAX_UPSCALE,
  COVER_LOW_RES_UPSCALE,
  brandCoverColor,
  coverCenterTop,
  COVER_CENTER_Y,
} from '../../utils/campaignCover.ts';

const desktopHeader = { width: 394, height: 600 };
const phoneHeader = { width: 390, height: 760 };
const card = { width: 300, height: 400 };

test('the limits are the ones agreed', () => {
  assert.equal(BRAND_COVER_FRACTION, 0.6);
  assert.equal(COVER_MAX_UPSCALE, 1.5);
  assert.ok(SMALL_COVER_FRACTION >= BRAND_COVER_FRACTION && SMALL_COVER_FRACTION <= 0.85);
  assert.ok(COVER_LOW_RES_UPSCALE > 1 && COVER_LOW_RES_UPSCALE <= 1.3);
});

test('a real photo bigger than its box stays full-bleed (cover)', () => {
  assert.deepEqual(campaignCoverLayout({ natural: { width: 4032, height: 3024 }, box: desktopHeader }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({ natural: { width: 1170, height: 2532 }, box: phoneHeader }), { mode: 'cover' });
  // exactly the box: no upscaling at all
  assert.deepEqual(campaignCoverLayout({ natural: { width: 394, height: 600 }, box: desktopHeader }), { mode: 'cover' });
});

test('before the picture has loaded (or before the box is measured) a real photo is shown as now', () => {
  assert.deepEqual(campaignCoverLayout({ natural: null, box: desktopHeader }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({ natural: { width: 200, height: 200 }, box: null }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({ natural: { width: 200, height: 200 }, box: { width: 0, height: 0 } }), { mode: 'cover' });
  assert.deepEqual(campaignCoverLayout({}), { mode: 'cover' });
});

test('a photo that would only be enlarged a little stays full-bleed', () => {
  // full-bleed needs 600/520 = 1.15x: under the low-res limit
  assert.deepEqual(campaignCoverLayout({ natural: { width: 800, height: 520 }, box: desktopHeader }), { mode: 'cover' });
});

test('a picture smaller than its box is shown whole, centred, never enlarged past 1.5x', () => {
  // 200x150 in a 394x600 header: full-bleed would need 4x. Fits 80% of the width at most, and 1.5x at most → 1.5x.
  const l = campaignCoverLayout({ natural: { width: 200, height: 150 }, box: desktopHeader });
  assert.equal(l.mode, 'contain');
  assert.equal(l.shape, 'rect');
  assert.equal(l.width, 300);
  assert.equal(l.height, 225);
});

test('a small picture is limited by the box when 1.5x would be too big', () => {
  // 600x600 in a 390x760 phone header: full-bleed needs 1.27x → too small. 80% of 390 = 312 wide.
  const l = campaignCoverLayout({ natural: { width: 600, height: 600 }, box: phoneHeader });
  assert.equal(l.mode, 'contain');
  assert.equal(l.width, Math.round(390 * SMALL_COVER_FRACTION));
  assert.equal(l.height, Math.round(390 * SMALL_COVER_FRACTION));
  assert.ok(l.width <= phoneHeader.width && l.height <= phoneHeader.height);
});

test('the brand default is always the round avatar, at most 60% of the box and 1.5x its own size', () => {
  // The 8abfd1b2 case: a 256px logo as the cover of a 394x600 header → 236px circle (60% of 394), not full-bleed.
  const l = campaignCoverLayout({ isFallback: true, natural: { width: 256, height: 256 }, box: desktopHeader });
  assert.deepEqual(l, { mode: 'contain', shape: 'circle', width: 236, height: 236 });
  // A tiny 64px logo is never enlarged past 96px.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 64, height: 64 }, box: desktopHeader }),
    { mode: 'contain', shape: 'circle', width: 96, height: 96 });
  // A big logo still stays the avatar (60% of the card's short side), never full-bleed.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 2000, height: 2000 }, box: card }),
    { mode: 'contain', shape: 'circle', width: 180, height: 180 });
  // A wide logo: the circle uses its short side for the 1.5x limit.
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: { width: 400, height: 100 }, box: card }),
    { mode: 'contain', shape: 'circle', width: 150, height: 150 });
});

test('the brand default before it loads is already the circle, sized by CSS', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, natural: null, box: desktopHeader }),
    { mode: 'contain', shape: 'circle', width: null, height: null });
  assert.deepEqual(campaignCoverLayout({ isFallback: true }),
    { mode: 'contain', shape: 'circle', width: null, height: null });
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
});
