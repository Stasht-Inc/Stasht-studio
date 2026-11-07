// tests/utils/campaignCoverBrandKind.test.mjs — Chris, 7 Nov 2026 (+ review): the brand cover's layout once the web API
// has judged the brand picture (utils/brandPictures): a PHOTO avatar fills the cover like a chosen photo (a genuinely
// tiny one is still shown whole); a LOGO is drawn whole — never cut to a circle — on its solid colour; not known yet:
// the 4 Nov rules exactly (square → round avatar).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignCoverLayout } from '../../utils/campaignCover.ts';

const card = { width: 290, height: 290 };

test('a brand PHOTO fills the card like a chosen photo (point 10)', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'photo', natural: { width: 480, height: 640 }, box: card }), { mode: 'cover' });
  const tiny = campaignCoverLayout({ isFallback: true, brandKind: 'photo', natural: { width: 96, height: 128 }, box: card });
  assert.equal(tiny.mode, 'contain');
  assert.equal(tiny.shape, 'rect');
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'photo', natural: { width: 400, height: 300 }, box: { width: 393, height: 852 }, judgeBox: { width: 393, height: 393 } }), { mode: 'cover' });
});

test('a brand LOGO is drawn whole, never cut to a circle, even when square (review M1)', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 600, height: 420 }, box: card }),
    { mode: 'contain', shape: 'rect', width: 174, height: 122 });
  const square = campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 512, height: 512 }, box: card });
  assert.deepEqual(square, { mode: 'contain', shape: 'rect', width: 174, height: 174 });
  // never enlarged past 1.5x
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 64, height: 64 }, box: card }),
    { mode: 'contain', shape: 'rect', width: 96, height: 96 });
});

test('not judged (yet): the 4 Nov rules — a square brand is the round avatar', () => {
  for (const brandKind of [null, undefined]) {
    assert.equal(campaignCoverLayout({ isFallback: true, brandKind, natural: { width: 256, height: 256 }, box: card }).shape, 'circle');
    assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind, natural: { width: 600, height: 420 }, box: card }),
      { mode: 'contain', shape: 'rect', width: 174, height: 122 });
  }
});

test('a card can draw the brand smaller (brandFraction), never past 1.5x its own size', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 600, height: 420 }, box: card, brandFraction: 0.45 }),
    { mode: 'contain', shape: 'rect', width: 131, height: 91 });
  assert.equal(campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 64, height: 64 }, box: card, brandFraction: 0.45 }).width, 96);
});
