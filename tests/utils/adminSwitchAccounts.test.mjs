// tests/utils/adminSwitchAccounts.test.mjs — node --test (Node >= 22.18, imports the TypeScript source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAccountsAfterChoice, sameOwner } from '../../utils/adminSwitchAccounts.ts';
import { switchDataIsStale } from '../../utils/propertyAccountSwitch.ts';

// The sign-in response's collaborators: owner_id is a NUMBER (memory_collaborators.owner_id bigint).
const royal = { owner_id: 959, user_id: 1201, role: 'admin', owner: { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royal.test', location: 'Ontario' } };
const other = { owner_id: 958, role: 'admin', owner: { name: 'Stasht', email: 'dev@stasht.test' } };
const personal = { id: 1300, email: 'brenna@royal.test', name: 'Brenna' };
const royalUser = { id: 708, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royal.test' };

test('the clicked account (numeric owner_id, clicked as a string) keeps its user and token', () => {
  const rows = adminAccountsAfterChoice([royal, other], { owner_id: '959' }, royalUser, 'tok-royal');
  assert.equal(rows[0].owner_id, '959');
  assert.equal(rows[0].token, 'tok-royal');
  assert.deepEqual(rows[0].user, royalUser);
  assert.equal(rows[1].token, '');
  assert.equal(rows[1].user.name, 'Stasht');
});

test('the switch data built from it is NOT discarded as stale on the next render (the "Switch to" back stays)', () => {
  const data = {
    has_admin_access: true, current_mode: 'admin', current_admin_owner_id: '959',
    personal_account: { user: personal, token: 'tok-personal' },
    admin_accounts: adminAccountsAfterChoice([royal], { owner_id: '959' }, royalUser, 'tok-royal'),
  };
  assert.equal(switchDataIsStale(data, royalUser, 'tok-royal'), false);
});

test('an owner listed as Admin and as Partial Admin: only the clicked kind gets the token', () => {
  const partial = { owner_id: '959', isPartialAdmin: true, owner: royal.owner };
  const rows = adminAccountsAfterChoice([royal, partial], { owner_id: '959', isPartialAdmin: false }, royalUser, 'tok');
  assert.equal(rows[0].token, 'tok');
  assert.equal(rows[1].token, '');
  assert.equal(rows[1].isPartialAdmin, true);
});

test('missing owner details and junk rows never throw', () => {
  const rows = adminAccountsAfterChoice([{ owner_id: 5 }, null, undefined], { owner_id: '7' }, {}, 't');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user, null);
  assert.equal(sameOwner(undefined, ''), false);
  assert.equal(sameOwner(959, '959'), true);
});
