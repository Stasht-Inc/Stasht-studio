// tests/utils/accountState.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 5 Nov 2026 (point 1): he signed out of Pedalheads and created a new account. The new account opened in
// Pedalheads' "Point Grey" property view (header "Point Grey · Property") behind a plan picker without Starter: the
// property view (localStorage view_type / selected_property) and the new-account flag (is_new_user) outlived the
// sign-out. Everything that belongs to the signed-in account goes when it signs out or another account signs in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNT_LOCAL_KEYS, ACCOUNT_SESSION_KEYS, clearAccountState, propertyViewIsStale } from '../../utils/accountState.ts';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    keys: () => [...map.keys()].sort(),
  };
}

test('the previous account\'s property view, new-account flag and per-account caches are cleared', () => {
  const local = memoryStorage({
    view_type: 'property',
    selected_property: JSON.stringify({ id: 41, name: 'Point Grey' }),
    is_new_user: 'true',
    stasht_campaigns_view: 'newsletters',
    stash_invited_memories: '[]',
    stasht_recent_searches: '["pedalheads"]',
    hiddenServices: '[]',
    imageCropSettings: '{}',
    stasht_watched_videos: '[1]',
    stasht_category_colors: '{}',
    moderation_preference_updated: '1',
  });
  const session = memoryStorage({ users_open_tab: 'properties', billing_open_upgrade: 'true', openPurchaseCreditsModal: 'true', restorePublishedEntry: '{}' });
  clearAccountState(local, session);
  assert.deepEqual(local.keys(), []);
  assert.deepEqual(session.keys(), []);
});

test('device preferences and sign-in flows in progress are kept', () => {
  const keep = {
    'pwa-install-dismissed': '1',
    'stasht_login_method_a@b.com': 'email',
    pending_property_switch: '41', // a property invite / registration link: opened right after this sign-in
    pendingInvite: '{}',
    pendingRedirectAfterLogin: '{}',
    google_photos_dont_ask: 'true',
  };
  const local = memoryStorage({ ...keep, view_type: 'property' });
  const session = memoryStorage({ just_logged_out_for_invite: 'true', pending_magic_link_email: 'a@b.com' });
  clearAccountState(local, session);
  assert.deepEqual(local.keys(), Object.keys(keep).sort());
  assert.deepEqual(session.keys(), ['just_logged_out_for_invite', 'pending_magic_link_email']);
});

test('the key lists name the property view and the new-account flag', () => {
  for (const key of ['view_type', 'selected_property', 'is_new_user']) assert.ok(ACCOUNT_LOCAL_KEYS.includes(key), key);
  assert.ok(!ACCOUNT_LOCAL_KEYS.includes('pending_property_switch'));
  assert.ok(!ACCOUNT_LOCAL_KEYS.includes('stasht_token'), 'auth keys stay with userUtils.clearAuthData');
  assert.ok(ACCOUNT_SESSION_KEYS.includes('users_open_tab'));
});

test('no storage (private mode) never throws', () => {
  assert.doesNotThrow(() => clearAccountState(null, null));
  const broken = { removeItem() { throw new Error('denied'); } };
  assert.doesNotThrow(() => clearAccountState(broken, broken));
});

// A property view restored from storage must be one of the signed-in account's properties (owned or shared); a
// view left behind by another sign-in (before this fix, or any path that wrote a new sign-in directly) is dropped.
test('a stored property view that is not one of this account\'s properties is stale', () => {
  const rows = [{ id: 7, name: 'Kitsilano' }, { id: '12', name: 'Shared One' }];
  assert.equal(propertyViewIsStale('property', { id: 41, name: 'Point Grey' }, rows), true);
  assert.equal(propertyViewIsStale('property', { id: 7 }, rows), false);
  assert.equal(propertyViewIsStale('property', { id: 12 }, rows), false, 'ids compare as strings');
  assert.equal(propertyViewIsStale('property', { id: 41 }, []), true, 'an account with no properties has no property view');
});

test('the personal view, or no answer from the server, is never "stale"', () => {
  assert.equal(propertyViewIsStale('personal', null, []), false);
  assert.equal(propertyViewIsStale('personal', { id: 41 }, []), false);
  assert.equal(propertyViewIsStale('property', null, []), false);
  assert.equal(propertyViewIsStale('property', { id: 41 }, null), false, 'unknown (request failed) keeps the view');
});
