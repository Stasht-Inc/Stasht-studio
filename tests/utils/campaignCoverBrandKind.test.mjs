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

test('not judged (yet): whole, 60% at most — never cut round any more (Chris point 11)', () => {
  for (const brandKind of [null, undefined]) {
    assert.equal(campaignCoverLayout({ isFallback: true, brandKind, natural: { width: 256, height: 256 }, box: card }).shape, 'rect');
    assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind, natural: { width: 600, height: 420 }, box: card }),
      { mode: 'contain', shape: 'rect', width: 174, height: 122 });
  }
});

test('a card can draw the brand smaller (brandFraction), never past 1.5x its own size', () => {
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 600, height: 420 }, box: card, brandFraction: 0.45 }),
    { mode: 'contain', shape: 'rect', width: 131, height: 91 });
  assert.equal(campaignCoverLayout({ isFallback: true, brandKind: 'logo', natural: { width: 64, height: 64 }, box: card, brandFraction: 0.45 }).width, 96);
});

test('an unsure ("whole") brand is drawn whole at the full cover height, at most 90% wide (re-review 2, option C)', () => {
  // a square headshot on a white wall in a tall header: full height, sides on the wall colour
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'whole', natural: { width: 400, height: 400 }, box: { width: 600, height: 300 } }),
    { mode: 'contain', shape: 'rect', width: 300, height: 300 });
  // a wide JPEG logo: capped at 90% of the width
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'whole', natural: { width: 600, height: 200 }, box: { width: 290, height: 290 } }),
    { mode: 'contain', shape: 'rect', width: 261, height: 87 });
  // a small picture still goes full height (never the small circle), even square ones never cut round
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'whole', natural: { width: 96, height: 96 }, box: card }),
    { mode: 'contain', shape: 'rect', width: 261, height: 261 });
  assert.deepEqual(campaignCoverLayout({ isFallback: true, brandKind: 'whole', natural: null, box: card }), { mode: 'pending' });
});

test('a light brand fill gets a stronger bottom scrim so the white title reads (4.5:1)', async () => {
  const { lightCoverFill } = await import('../../utils/campaignCover.ts');
  for (const light of ['#FFFFFF', '#F5F5F2', '#E5E2FF', '#D6DFF8', '#FCD6D8', '#F29D0D']) assert.equal(lightCoverFill(light), true, light);
  for (const dark of ['#0062A8', '#0B1442', '#16803E', '#111827', null, 'nonsense']) assert.equal(lightCoverFill(dark), false, String(dark));
});

test('a logo\'s gradient background: the cover fill runs top colour → bottom colour around the logo (seamless)', async () => {
  const { seamlessFill } = await import('../../utils/campaignCover.ts');
  // flat: one colour
  assert.equal(seamlessFill({ color: '#FFFFFF', gradient: null }, null), '#FFFFFF');
  // a 200px-tall logo whose top sits at 100px in a 600px box: top colour down to 100px, bottom colour from 300px
  assert.equal(seamlessFill({ color: '#BBBBBB', gradient: ['#DCDCDC', '#9A9A9A'] }, { top: 100, height: 200 }),
    'linear-gradient(to bottom, #DCDCDC 0px, #DCDCDC 100px, #9A9A9A 300px, #9A9A9A 100%)');
  // not laid out yet: the flat colour
  assert.equal(seamlessFill({ color: '#BBBBBB', gradient: ['#DCDCDC', '#9A9A9A'] }, null), '#BBBBBB');
});

test('on a card the brand fits the free area between the top pills and the title, centred in it (never behind the title)', async () => {
  const { fitInArea } = await import('../../utils/campaignCover.ts');
  // a 600x420 logo, card 212 wide, free band 44..110 → height ≤ 90% of 66 = 59, centred at y 77
  const a = fitInArea({ width: 600, height: 420 }, { width: 212, height: 212 }, { top: 44, bottom: 110 }, 1.5);
  assert.deepEqual(a, { width: 85, height: 59, centerTop: 77, centerLeft: 106 });
  assert.ok(a.centerTop + a.height / 2 <= 110 && a.centerTop - a.height / 2 >= 44);
  // a wide wordmark is limited by 80% of the width
  assert.deepEqual(fitInArea({ width: 800, height: 100 }, { width: 212, height: 212 }, { top: 44, bottom: 110 }, 1.5), { width: 170, height: 21, centerTop: 77, centerLeft: 106 });
  // never enlarged past the cap (a tiny logo)
  assert.deepEqual(fitInArea({ width: 24, height: 24 }, { width: 212, height: 212 }, { top: 44, bottom: 110 }, 1.5), { width: 36, height: 36, centerTop: 77, centerLeft: 106 });
  // beside a pills column on the right: centred in the span left of it
  assert.deepEqual(fitInArea({ width: 600, height: 420 }, { width: 212, height: 212 }, { top: 46, bottom: 72, left: 8, right: 124 }, 1.5), { width: 33, height: 23, centerTop: 59, centerLeft: 66 });
  // no room (title runs into the pills): null — the caller uses the area from the top of the card instead
  assert.equal(fitInArea({ width: 600, height: 420 }, { width: 132, height: 132 }, { top: 44, bottom: 50 }, 1.5), null);
});
