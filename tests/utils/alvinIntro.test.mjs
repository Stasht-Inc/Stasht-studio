// tests/utils/alvinIntro.test.mjs — Node >= 22.18 (imports the TypeScript source).
// Chris, 10 Nov 2026: "Meet Alvin" kept coming back after "Got it" whenever he signed back in. A dismissal now holds for
// the person under any of their ids, and survives sign-out (clearAuthData / clearAccountState never remove it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { introKeys, introSeen, markIntroSeen } from '../../utils/alvinIntro.ts';
import { clearAccountState } from '../../utils/accountState.ts';

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('dismissed once = dismissed for the same person whichever id the next sign-in carries', () => {
  const s = memory();
  // Dismissed while the stored user had only the login id and email.
  markIntroSeen({ id: 708, email: 'Chris@Example.com' }, s);
  assert.equal(introSeen({ id: 708 }, s), true);
  // Next sign-in: the user carries external_user_id first (the old single key would differ).
  assert.equal(introSeen({ external_user_id: 959, id: 1234, email: 'chris@example.com' }, s), true);
  // Someone else in the same browser still sees it.
  assert.equal(introSeen({ external_user_id: 5, id: 6, email: 'other@example.com' }, s), false);
});

test('keys written by older builds (stasht_alvin_intro_seen_<id>) still count', () => {
  const s = memory();
  s.setItem('stasht_alvin_intro_seen_959', '1');
  assert.equal(introSeen({ external_user_id: 959, id: 708 }, s), true);
});

test('no user loaded yet: never shown (no "anon" key)', () => {
  const s = memory();
  assert.deepEqual(introKeys(undefined), []);
  assert.equal(introSeen(undefined, s), true);
  markIntroSeen(undefined, s);
  assert.equal(s.m.size, 0);
});

test('sign-out clearing leaves the dismissal in place', () => {
  const s = memory();
  markIntroSeen({ external_user_id: 959, id: 708, email: 'a@b.co', phone_number: '+1 (604) 555-0100' }, s);
  clearAccountState(s, memory());
  assert.equal(introSeen({ phone_number: '+16045550100' }, s), true);
  assert.equal(introSeen({ external_user_id: 959 }, s), true);
});
