// tests/utils/propertyAccountSwitch.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchDataForPropertyAccount } from '../../utils/propertyAccountSwitch.ts';

const main = { id: 707, name: 'Main Dealer', email: 'main@x.com' };

test('first switch: the signed-in account becomes the account to switch back to', () => {
  const data = switchDataForPropertyAccount(null, { user: main, token: 'main-token' }, '901', 'bob-token');
  assert.deepEqual(data, {
    has_admin_access: true,
    current_mode: 'admin',
    current_admin_owner_id: '901',
    switched_token: 'bob-token',
    personal_account: { user: main, token: 'main-token' },
    admin_accounts: [],
  });
});

test('existing switch data keeps its personal account and admin accounts', () => {
  const existing = {
    has_admin_access: true,
    current_mode: 'personal',
    personal_account: { user: main, token: 'main-token' },
    admin_accounts: [{ owner_id: '55', user: { name: 'Other' }, token: '' }],
  };
  const data = switchDataForPropertyAccount(existing, { user: main, token: 'main-token' }, '901', 'bob-token');
  assert.equal(data.current_mode, 'admin');
  assert.equal(data.current_admin_owner_id, '901');
  assert.deepEqual(data.personal_account, existing.personal_account);
  assert.deepEqual(data.admin_accounts, existing.admin_accounts);
  assert.equal(existing.current_mode, 'personal', 'does not mutate the stored copy');
});

test('switch data without a personal token is replaced', () => {
  const broken = { has_admin_access: true, current_mode: 'admin', personal_account: { user: null, token: '' }, admin_accounts: [] };
  const data = switchDataForPropertyAccount(broken, { user: main, token: 'main-token' }, 901, 'bob-token');
  assert.deepEqual(data.personal_account, { user: main, token: 'main-token' });
  assert.equal(data.current_admin_owner_id, '901');
});

test('switch data is stale only when it belongs to someone else', async () => {
  const { switchDataIsStale } = await import('../../utils/propertyAccountSwitch.ts');
  const data = {
    has_admin_access: true, current_mode: 'personal', personal_account: { user: main, token: 'main-token' }, admin_accounts: [],
  };
  assert.equal(switchDataIsStale(data, main, 'main-token'), false, 'signed in as the personal account');
  assert.equal(switchDataIsStale(data, { id: 1, email: 'someone@else.com' }, 'x'), true, 'left behind by another sign-in');

  // Switched into another account: kept only while the signed-in token is the one the switch minted
  // (switched_token for an external property, the cached admin_accounts token for an admin account).
  const bob = { id: 90, external_user_id: 901, name: 'Bob Bozic' };
  const switched = { ...data, current_mode: 'admin', current_admin_owner_id: '901', switched_token: 'bob-token' };
  assert.equal(switchDataIsStale(switched, bob, 'bob-token'), false);
  // Bob himself signing in on this browser later (new token): he must not get "Switch to Main Dealer".
  assert.equal(switchDataIsStale(switched, bob, 'bobs-own-login-token'), true);
  assert.equal(switchDataIsStale(switched, bob, null), true);
  const viaAdmin = {
    ...data, current_mode: 'admin', current_admin_owner_id: '55',
    admin_accounts: [{ owner_id: '55', user: { id: 91 }, token: 'owner-a-token' }, { owner_id: '56', user: null, token: '' }],
  };
  assert.equal(switchDataIsStale(viaAdmin, { id: 91, external_user_id: 55 }, 'owner-a-token'), false, 'regular admin switch keeps working');
  assert.equal(switchDataIsStale(viaAdmin, { id: 92 }, ''), true, 'an empty cached token never matches');
  assert.equal(switchDataIsStale({ ...switched, current_mode: 'personal' }, bob, 'bob-token'), true, 'not in admin mode');

  // Unreadable / id-less values never clear (as before).
  assert.equal(switchDataIsStale(data, null, 'x'), false);
  assert.equal(switchDataIsStale(data, {}, 'x'), false);
});
