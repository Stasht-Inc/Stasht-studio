// tests/utils/propertyAccountSwitch.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { switchDataForPropertyAccount } from '../../utils/propertyAccountSwitch.ts';

const main = { id: 707, name: 'Main Dealer', email: 'main@x.com' };

test('first switch: the signed-in account becomes the account to switch back to', () => {
  const data = switchDataForPropertyAccount(null, { user: main, token: 'main-token' }, '901');
  assert.deepEqual(data, {
    has_admin_access: true,
    current_mode: 'admin',
    current_admin_owner_id: '901',
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
  const data = switchDataForPropertyAccount(existing, { user: main, token: 'main-token' }, '901');
  assert.equal(data.current_mode, 'admin');
  assert.equal(data.current_admin_owner_id, '901');
  assert.deepEqual(data.personal_account, existing.personal_account);
  assert.deepEqual(data.admin_accounts, existing.admin_accounts);
  assert.equal(existing.current_mode, 'personal', 'does not mutate the stored copy');
});

test('switch data without a personal token is replaced', () => {
  const broken = { has_admin_access: true, current_mode: 'admin', personal_account: { user: null, token: '' }, admin_accounts: [] };
  const data = switchDataForPropertyAccount(broken, { user: main, token: 'main-token' }, 901);
  assert.deepEqual(data.personal_account, { user: main, token: 'main-token' });
  assert.equal(data.current_admin_owner_id, '901');
});

test('switch data is stale only when it belongs to someone else', async () => {
  const { switchDataIsStale } = await import('../../utils/propertyAccountSwitch.ts');
  const data = {
    has_admin_access: true, current_mode: 'personal', personal_account: { user: main, token: 'main-token' }, admin_accounts: [],
  };
  assert.equal(switchDataIsStale(data, main), false, 'signed in as the personal account');
  assert.equal(switchDataIsStale(data, { id: 1, email: 'someone@else.com' }), true, 'left behind by another sign-in');
  // Switched into another account (admin account or external property): stasht_user is that account, whose
  // external_user_id is the owner id it was switched to. Clearing here dropped "Switch to …" after every switch.
  const switched = { ...data, current_mode: 'admin', current_admin_owner_id: '901' };
  assert.equal(switchDataIsStale(switched, { id: 90, external_user_id: 901, name: 'Bob Bozic' }), false);
  assert.equal(switchDataIsStale(switched, { id: 91, external_user_id: 999 }), true, 'a different account than the one switched to');
  assert.equal(switchDataIsStale({ ...data, current_mode: 'personal', current_admin_owner_id: '901' }, { id: 90, external_user_id: 901 }), true);
  // Unreadable / id-less values never clear (as before).
  assert.equal(switchDataIsStale(data, null), false);
  assert.equal(switchDataIsStale(data, {}), false);
});
