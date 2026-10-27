// tests/utils/pullToRefresh.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PULL_THRESHOLD, pullDistanceFor, shouldTriggerRefresh, pullIndicatorStyle, pullAxis } from '../../utils/pullToRefresh.ts';

test('threshold matches the campaign details page (80px)', () => {
  assert.equal(PULL_THRESHOLD, 80);
});

test('distance: zero when not tracking, or dragging up', () => {
  assert.equal(pullDistanceFor(null, 300), 0);
  assert.equal(pullDistanceFor(200, 200), 0);
  assert.equal(pullDistanceFor(200, 150), 0);
  assert.equal(pullDistanceFor(200, NaN), 0);
});

test('distance: follows the finger, capped at 1.5x the threshold', () => {
  assert.equal(pullDistanceFor(100, 150), 50);
  assert.equal(pullDistanceFor(100, 220), 120);
  assert.equal(pullDistanceFor(100, 400), 120);
  assert.equal(pullDistanceFor(0, 400, 40), 60);
});

test('trigger only at or past the threshold', () => {
  assert.equal(shouldTriggerRefresh(79), false);
  assert.equal(shouldTriggerRefresh(80), true);
  assert.equal(shouldTriggerRefresh(120), true);
  assert.equal(shouldTriggerRefresh(30, 30), true);
});

test('indicator: travels at most 60px, fades in over the threshold, spins with the pull', () => {
  assert.deepEqual(pullIndicatorStyle(40, true, false), { translateY: 40, opacity: 0.5, rotate: 80 });
  assert.deepEqual(pullIndicatorStyle(120, true, false), { translateY: 60, opacity: 1, rotate: 240 });
});

test('indicator: resting / refreshing state is fully visible at the top, CSS spin only', () => {
  assert.deepEqual(pullIndicatorStyle(0, false, true), { translateY: 0, opacity: 1, rotate: null });
  assert.deepEqual(pullIndicatorStyle(90, true, true), { translateY: 60, opacity: 1, rotate: null });
});

test('axis: undecided until the finger moves past the slop', () => {
  assert.equal(pullAxis(0, 0), null);
  assert.equal(pullAxis(3, 5), null);
  assert.equal(pullAxis(-5, -5), null);
});

test('axis: vertical only when vertical movement beats horizontal', () => {
  assert.equal(pullAxis(2, 12), 'y');
  assert.equal(pullAxis(-4, -9), 'y');
  assert.equal(pullAxis(12, 3), 'x');
  assert.equal(pullAxis(-10, 10), 'x'); // a tie is not a pull
  assert.equal(pullAxis(1, 3, 2), 'y');
});
