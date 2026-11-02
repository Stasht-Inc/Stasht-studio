// tests/utils/appVersion.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFRESH_ATTEMPT_TTL_MS,
  FOCUS_CHECK_MIN_GAP_MS,
  parseBuildTime,
  readRemoteBuild,
  isNewerBuild,
  isSameBuild,
  shouldOfferForWorkerUpdate,
  activeAttempt,
  refreshAction,
  nextAttempt,
  canOfferUpdate,
  shouldCheckNow,
  parseAttempt,
  USER_DISMISS_WINDOW_MS,
  RELOAD_CANCEL_GRACE_MS,
  isUserDismiss,
  attemptAfterCancelledReload,
} from '../../utils/appVersion.ts';

const A = '2026-11-02T10:00:00.000Z';
const B = '2026-11-02T10:05:30.123Z';
const NOW = Date.parse('2026-11-02T12:00:00.000Z');

test('parseBuildTime: ISO stamps parse, junk does not', () => {
  assert.equal(parseBuildTime(A), Date.parse(A));
  assert.equal(parseBuildTime(''), null);
  assert.equal(parseBuildTime('   '), null);
  assert.equal(parseBuildTime('not a date'), null);
  assert.equal(parseBuildTime(undefined), null);
  assert.equal(parseBuildTime(null), null);
  assert.equal(parseBuildTime(1730000000000), null);
});

test('readRemoteBuild: takes buildTime from the version.json body only when valid', () => {
  assert.equal(readRemoteBuild({ buildTime: B }), B);
  assert.equal(readRemoteBuild({ buildTime: 'nope' }), null);
  assert.equal(readRemoteBuild({}), null);
  assert.equal(readRemoteBuild(null), null);
  assert.equal(readRemoteBuild('<!doctype html>'), null); // an SPA fallback answering with index.html
  assert.equal(readRemoteBuild([B]), null);
});

test('isNewerBuild: only a strictly later, valid deployed build counts', () => {
  assert.equal(isNewerBuild(B, A), true);
  assert.equal(isNewerBuild(A, A), false);
  assert.equal(isNewerBuild(A, B), false); // older deployed build (rollback) is not "newer"
  assert.equal(isNewerBuild(null, A), false);
  assert.equal(isNewerBuild(B, 'Build unknown'), false);
  // Same instant written differently is the same build, not a newer one.
  assert.equal(isNewerBuild('2026-11-02T10:00:00Z', A), false);
});

test('isSameBuild: same instant, both valid', () => {
  assert.equal(isSameBuild(A, A), true);
  assert.equal(isSameBuild('2026-11-02T10:00:00Z', A), true);
  assert.equal(isSameBuild(A, B), false);
  assert.equal(isSameBuild(null, null), false);
});

test('worker update: offered unless version.json says this page is already that build', () => {
  assert.equal(shouldOfferForWorkerUpdate(B, A), true);
  assert.equal(shouldOfferForWorkerUpdate(null, A), true); // version.json unavailable
  assert.equal(shouldOfferForWorkerUpdate(A, B), true); // rollback: the worker now serves the older build
  assert.equal(shouldOfferForWorkerUpdate(A, A), false);
});

test('first Refresh is a plain reload; a second for the same old build resets the worker', () => {
  assert.equal(refreshAction(null, A, NOW), 'reload');
  const first = nextAttempt(null, A, NOW);
  assert.deepEqual(first, { fromBuild: A, count: 1, at: NOW });
  // Page came back on the same build A: the next click escalates.
  assert.equal(refreshAction(first, A, NOW + 5000), 'reset-and-reload');
  const second = nextAttempt(first, A, NOW + 5000);
  assert.equal(second.count, 2);
});

test('a Refresh that worked clears the attempt (page is on a different build now)', () => {
  const first = nextAttempt(null, A, NOW);
  assert.equal(activeAttempt(first, B, NOW + 1000), null);
  assert.equal(refreshAction(first, B, NOW + 1000), 'reload');
  assert.equal(canOfferUpdate(first, B, NOW + 1000), true);
  assert.deepEqual(nextAttempt(first, B, NOW + 1000), { fromBuild: B, count: 1, at: NOW + 1000 });
});

test('no loop: after a reload and a reset both fail, the prompt stays away until the attempt expires', () => {
  const first = nextAttempt(null, A, NOW);
  assert.equal(canOfferUpdate(first, A, NOW + 1000), true); // one failed reload: still offered (next click resets)
  const second = nextAttempt(first, A, NOW + 2000);
  assert.equal(canOfferUpdate(second, A, NOW + 3000), false);
  assert.equal(canOfferUpdate(second, A, NOW + 2000 + REFRESH_ATTEMPT_TTL_MS + 1), true);
  // An expired attempt starts over at a plain reload.
  assert.equal(refreshAction(second, A, NOW + 2000 + REFRESH_ATTEMPT_TTL_MS + 1), 'reload');
});

test('activeAttempt ignores malformed and future-dated attempts', () => {
  assert.equal(activeAttempt(null, A, NOW), null);
  assert.equal(activeAttempt({ fromBuild: A, count: 'x', at: NOW }, A, NOW), null);
  assert.equal(activeAttempt({ fromBuild: A, count: 1, at: NOW + 60000 }, A, NOW), null); // clock went back
});

test('parseAttempt: stored JSON, defensively', () => {
  assert.deepEqual(parseAttempt(JSON.stringify({ fromBuild: A, count: 1, at: NOW })), { fromBuild: A, count: 1, at: NOW });
  assert.equal(parseAttempt(null), null);
  assert.equal(parseAttempt(''), null);
  assert.equal(parseAttempt('{bad json'), null);
  assert.equal(parseAttempt('null'), null);
  assert.equal(parseAttempt(JSON.stringify({ fromBuild: A })), null);
});

test('shouldCheckNow: first check always, then at most once per gap', () => {
  assert.equal(shouldCheckNow(null, NOW), true);
  assert.equal(shouldCheckNow(NOW, NOW + FOCUS_CHECK_MIN_GAP_MS - 1), false);
  assert.equal(shouldCheckNow(NOW, NOW + FOCUS_CHECK_MIN_GAP_MS), true);
  assert.equal(shouldCheckNow(NOW, NOW - 1000), true); // clock went back
  assert.equal(shouldCheckNow(NOW, NOW + 10, 5), true);
});

test('isUserDismiss: only a close right after the user touched the banner counts as their dismissal', () => {
  assert.equal(isUserDismiss(NOW - 100, NOW), true); // tapped the X / swiped it away
  assert.equal(isUserDismiss(NOW - USER_DISMISS_WINDOW_MS, NOW), true);
  assert.equal(isUserDismiss(NOW - USER_DISMISS_WINDOW_MS - 1, NOW), false); // touched long ago, closed by code now
  assert.equal(isUserDismiss(null, NOW), false); // never touched: another screen's toast.dismiss() closed it
  assert.equal(isUserDismiss(NOW + 5000, NOW), false); // clock went back
});

test('a reload the user cancelled (beforeunload "Stay") does not count as a Refresh attempt', () => {
  const before = nextAttempt(null, A, NOW); // one earlier, real failed Refresh
  // The cancelled click had stored count 2; the attempt goes back to what it was before that click.
  assert.deepEqual(attemptAfterCancelledReload(before), before);
  assert.equal(attemptAfterCancelledReload(null), null);
  assert.equal(refreshAction(attemptAfterCancelledReload(null), A, NOW), 'reload');
  assert.ok(RELOAD_CANCEL_GRACE_MS >= 2000 && RELOAD_CANCEL_GRACE_MS <= 10000);
});
