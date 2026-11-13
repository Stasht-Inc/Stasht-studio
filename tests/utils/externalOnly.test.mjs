// tests/utils/externalOnly.test.mjs
// External-only accounts (Chris/Deepak 13 Nov 2026): an account CREATED for an external property has no Personal
// account. Joined / linked accounts keep theirs. Imports the TypeScript source directly (Node >= 22.18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { externalOnlyPropertyRow, isExternalOnlyRow, landsStraightInExternal } from '../../utils/salespersonLanding.ts';

const bon = { id: 120, external_user_id: 966, name: 'Bon Sun' };
const serpa = { id: 708, external_user_id: 889, name: 'Serpa Chrysler' };
const bonsOwn = { id: 96, name: 'Bon Sun', account_type: 'external', account_created_for_property: true, user_id: 966, is_own_external_account: true, is_active: true };
const joined = { id: 97, name: 'Olga', account_type: 'external', account_created_for_property: false, user_id: 966, is_own_external_account: false };
const internalRow = { id: 12, name: 'Downtown', account_type: 'internal', user_id: 889, is_creator: true };

test('only an active created-for own external row is external-only', () => {
  assert.equal(isExternalOnlyRow(bonsOwn, bon), true);
  assert.equal(isExternalOnlyRow({ ...bonsOwn, is_own_external_account: undefined }, bon), true, 'explicit created_for flag');
  assert.equal(isExternalOnlyRow(joined, bon), false, 'joined / linked keeps Personal');
  assert.equal(isExternalOnlyRow({ ...bonsOwn, is_own_external_account: undefined, account_created_for_property: undefined }, bon), false, 'older API: no flag');
  assert.equal(isExternalOnlyRow({ ...bonsOwn, is_active: false }, bon), false, 'deactivated');
  assert.equal(isExternalOnlyRow({ ...bonsOwn, is_own_external_account: false }, serpa), false, 'the main account seeing its salesperson');
  assert.equal(isExternalOnlyRow(internalRow, serpa), false);
  assert.equal(isExternalOnlyRow(null, bon), false);
});

test('externalOnlyPropertyRow finds it in any list', () => {
  assert.equal(externalOnlyPropertyRow([internalRow, bonsOwn], bon), bonsOwn);
  assert.equal(externalOnlyPropertyRow([internalRow, joined], bon), null);
  assert.equal(externalOnlyPropertyRow(null, bon), null);
});

test('sign-in skips the chooser only when the External account is the one choice', () => {
  assert.equal(landsStraightInExternal([bonsOwn], 0, bon), '96');
  assert.equal(landsStraightInExternal([bonsOwn], 1, bon), null, 'an admin account to choose too');
  assert.equal(landsStraightInExternal([bonsOwn, internalRow], 0, bon), null, 'another property to choose too');
  assert.equal(landsStraightInExternal([joined], 0, bon), null, 'a joined account still chooses (Personal stays)');
  assert.equal(landsStraightInExternal([], 0, bon), null);
});
