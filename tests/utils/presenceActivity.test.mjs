// tests/utils/presenceActivity.test.mjs
// Chris 11 Nov 2026: a Studio tab left open (visible) overnight kept Brenna "online", so rule D never released her chat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESENCE_IDLE_MS, isPresenceActive } from '../../utils/presenceActivity.ts';

test('a visible tab in use keeps its person online', () => {
  assert.equal(isPresenceActive(true, 1_000, 1_000 + 60_000), true);
  assert.equal(isPresenceActive(true, 0, PRESENCE_IDLE_MS - 1), true);
});

test('a visible tab nobody has touched for the idle window does not', () => {
  assert.equal(PRESENCE_IDLE_MS, 10 * 60_000);
  assert.equal(isPresenceActive(true, 0, PRESENCE_IDLE_MS), false);
  assert.equal(isPresenceActive(true, 0, 8 * 60 * 60_000), false, 'left open overnight');
});

test('a hidden tab never does', () => {
  assert.equal(isPresenceActive(false, 1_000, 1_000), false);
});
