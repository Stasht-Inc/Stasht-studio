// tests/widget/widget-hit.test.mjs — click-through around the widget (wdy2xh1tjc): the hit rects the
// embed reports and the clip-path the loader builds from them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as core from '../../public/widget-core.js';

const { HIT_PAD, HIT_RECTS_MAX, hitRectFor } = core;

// widget-loader.js is a classic script and carries its own copies of the two helpers between
// <hit-area> markers. Load that copy too, and run every case against both.
const loaderSrc = readFileSync(new URL('../../public/widget-loader.js', import.meta.url), 'utf8');
const block = loaderSrc.match(/\/\/ <hit-area>[^\n]*\n([\s\S]*?)\n\s*\/\/ <\/hit-area>/);
assert.ok(block, 'widget-loader.js has a <hit-area> block');
const loader = new Function(`${block[1]}\nreturn { sanitizeHitRects, hitClipPath };`)();
const impls = [['core', core], ['loader', loader]];
const squash = (s) => s.replace(/\s+/g, ' ').trim();

test('the loader copies of the hit-area helpers match widget-core.js', () => {
  for (const name of ['sanitizeHitRects', 'hitClipPath']) {
    assert.equal(squash(loader[name].toString()), squash(core[name].toString()), name);
  }
});

test('hitRectFor pads a box (more below, for the shadow) and rounds outward', () => {
  assert.deepEqual(HIT_PAD, { top: 6, x: 8, bottom: 16 });
  assert.deepEqual(hitRectFor({ left: 270.4, top: 196.6, width: 62, height: 62 }, 31),
    { x: 262, y: 190, w: 79, h: 85, r: 37 });
  assert.deepEqual(hitRectFor({ left: 16, top: 12, width: 316, height: 120 }, 16, { top: 0, x: 0, bottom: 0 }),
    { x: 16, y: 12, w: 316, h: 120, r: 16 });
  assert.equal(hitRectFor({ left: 0, top: 0, width: 10, height: 10 }).r, 6); // no radius: just the pad's corner
});

for (const [label, { sanitizeHitRects }] of impls) {
  test(`sanitizeHitRects (${label}) keeps valid rects and clamps them to the frame`, () => {
    assert.deepEqual(sanitizeHitRects([{ x: 8, y: 6, w: 332, h: 150, r: 22 }], 348, 250),
      [{ x: 8, y: 6, w: 332, h: 150, r: 22 }]);
    // Hanging off the frame: clamped; the radius is capped at half the smaller side.
    assert.deepEqual(sanitizeHitRects([{ x: -5, y: 200, w: 400, h: 100, r: 60 }], 348, 250),
      [{ x: 0, y: 200, w: 348, h: 50, r: 25 }]);
    // r is optional.
    assert.deepEqual(sanitizeHitRects([{ x: 1.234, y: 2, w: 3.456, h: 4 }], 10, 10),
      [{ x: 1.23, y: 2, w: 3.46, h: 4, r: 0 }]);
    // A rect wholly outside the frame is dropped; if that leaves none, no clip.
    assert.deepEqual(sanitizeHitRects([{ x: 0, y: 0, w: 5, h: 5 }, { x: 500, y: 0, w: 5, h: 5 }], 100, 100),
      [{ x: 0, y: 0, w: 5, h: 5, r: 0 }]);
    assert.equal(sanitizeHitRects([{ x: 500, y: 0, w: 5, h: 5 }], 100, 100), null);
  });

  test(`sanitizeHitRects (${label}) means "no clip" for anything unexpected`, () => {
    const ok = { x: 0, y: 0, w: 10, h: 10 };
    for (const raw of [undefined, null, 'x', {}, [], [null], ['rect'], [{ ...ok, x: '0' }], [{ ...ok, w: NaN }],
      [{ ...ok, h: Infinity }], [{ ...ok, r: '4' }], [{ ...ok, w: -1 }], [{ y: 0, w: 1, h: 1 }],
      Array.from({ length: HIT_RECTS_MAX + 1 }, () => ok)]) {
      assert.equal(sanitizeHitRects(raw, 100, 100), null, JSON.stringify(raw));
    }
    for (const [w, h] of [[0, 100], [100, 0], [NaN, 100], ['100', 100], [Infinity, 100]]) {
      assert.equal(sanitizeHitRects([ok], w, h), null, `${w}x${h}`);
    }
    assert.equal(sanitizeHitRects(Array.from({ length: HIT_RECTS_MAX }, () => ok), 100, 100).length, HIT_RECTS_MAX);
  });

  test(`sanitizeHitRects (${label}) never lets markup or CSS through`, () => {
    const evil = [{ x: 0, y: 0, w: 10, h: 10, r: 2, extra: "'); background:url(x)" }];
    const out = sanitizeHitRects(evil, 100, 100);
    assert.deepEqual(out, [{ x: 0, y: 0, w: 10, h: 10, r: 2 }]);
  });
}

for (const [label, { hitClipPath }] of impls) {
  test(`hitClipPath (${label}) builds one clockwise subpath per rect`, () => {
    assert.equal(hitClipPath([{ x: 0, y: 0, w: 10, h: 20, r: 0 }]), "path('M0 0H10V20H0Z')");
    assert.equal(hitClipPath([{ x: 10, y: 20, w: 30, h: 40, r: 5 }]),
      "path('M15 20H35A5 5 0 0 1 40 25V55A5 5 0 0 1 35 60H15A5 5 0 0 1 10 55V25A5 5 0 0 1 15 20Z')");
    assert.equal(hitClipPath([{ x: 0, y: 0, w: 10, h: 10 }, { x: 1.257, y: 2.5, w: 3, h: 4, r: 0 }]),
      "path('M0 0H10V10H0Z M1.26 2.5H4.26V6.5H1.26Z')");
  });

  test(`hitClipPath (${label}) output contains only path syntax`, () => {
    const d = hitClipPath([{ x: 8.25, y: 6, w: 332, h: 150, r: 22 }, { x: 262, y: 190, w: 79, h: 85, r: 37 }]);
    assert.match(d, /^path\('[MHVAZ0-9. -]+'\)$/);
  });
}
