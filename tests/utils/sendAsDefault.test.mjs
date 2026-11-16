// tests/utils/sendAsDefault.test.mjs — Leads › "+ Send Message" › "Send as" starts on the right business (Chris /
// Deepak, 16 Nov 2026). Imports the TypeScript source directly (Node >= 22.18 type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSendAs, isOwnBusinessProperty } from '../../utils/sendAsDefault.ts';

// Royal Wood's main account: its own shop (created by it, internal), a team property it was added to, and the External
// account of a salesperson (Chris Becks) it manages.
const ownShop = { id: '10', row: { id: 10, is_creator: true, account_type: 'internal', name: 'TheRoyalWoodShop' } };
const teamProp = { id: '11', row: { id: 11, is_creator: false, account_type: 'internal', name: 'Other store' } };
const chrisBecks = { id: '12', row: { id: 12, is_creator: false, account_type: 'external', account_created_for_property: true, name: 'Chris Becks' } };

test('one business: that one', () => {
  assert.equal(defaultSendAs([teamProp]), '11');
});

test('main account: the business’s own internal property', () => {
  assert.equal(defaultSendAs([teamProp, chrisBecks, ownShop]), '10');
  assert.equal(defaultSendAs([teamProp, chrisBecks, ownShop], null), '10');
});

test('property view: the property being viewed, never the main business', () => {
  assert.equal(defaultSendAs([ownShop, teamProp, chrisBecks], 12), '12');
  assert.equal(defaultSendAs([ownShop, teamProp], '11'), '11');
  // Viewing a property that is not offered: nothing picked rather than a guess.
  assert.equal(defaultSendAs([ownShop, teamProp], 99), '');
});

test('no reliable answer: nothing picked', () => {
  // No property of its own (a team member's own login).
  assert.equal(defaultSendAs([teamProp, chrisBecks]), '');
  // Two of its own: ambiguous.
  const second = { id: '13', row: { ...ownShop.row, id: 13 } };
  assert.equal(defaultSendAs([ownShop, second, teamProp]), '');
  // Rows from an API without account_type.
  assert.equal(defaultSendAs([{ id: '1', row: { is_creator: true } }, { id: '2' }]), '');
  assert.equal(defaultSendAs([]), '');
});

test('own External account is not the business', () => {
  assert.equal(isOwnBusinessProperty({ is_creator: true, account_type: 'internal' }), true);
  assert.equal(isOwnBusinessProperty({ is_creator: true, account_type: 'external', is_own_external_account: true }), false);
  assert.equal(isOwnBusinessProperty({ is_creator: true, account_type: 'internal', is_own_external_account: true }), false);
  assert.equal(isOwnBusinessProperty({ is_creator: false, account_type: 'internal' }), false);
  assert.equal(isOwnBusinessProperty(null), false);
});
