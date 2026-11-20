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

// "Send as" the business itself (Chris, 20 Nov 2026: "Where is Royal Woodshop? Shouldn't it say Choose a Sender?").
test('the business is offered in the main view when there is a choice, and starts picked when nothing else fits', async () => {
  const { offersBusiness, SEND_AS_BUSINESS } = await import('../../utils/sendAsDefault.ts');
  const andrew = { id: '14', row: { id: 14, is_creator: true, account_type: 'external', name: 'Andrew S.' } };
  const lindsay = { id: '15', row: { id: 15, is_creator: true, account_type: 'external', name: 'Lindsay H.' } };
  const business = { id: SEND_AS_BUSINESS };

  // Royal Wood: only staff External accounts — the business is offered and is the default.
  assert.equal(offersBusiness([chrisBecks, andrew, lindsay], false), true);
  assert.equal(defaultSendAs([business, chrisBecks, andrew, lindsay]), SEND_AS_BUSINESS);
  // One External account only: still a choice (filing under someone's own account is not "the business").
  assert.equal(offersBusiness([chrisBecks], false), true);
  assert.equal(defaultSendAs([business, chrisBecks]), SEND_AS_BUSINESS);
  // The business's own internal property stands for the business (16 Nov rule): no second "TheRoyalWoodShop".
  assert.equal(offersBusiness([teamProp, chrisBecks, ownShop], false), false);
  assert.equal(defaultSendAs([teamProp, chrisBecks, ownShop]), '10');
  // A salesperson on one dealership: no picker, as before.
  assert.equal(offersBusiness([teamProp], false), false);
  // Property view: not offered; no properties: nothing to choose.
  assert.equal(offersBusiness([chrisBecks, andrew], true), false);
  assert.equal(offersBusiness([], false), false);
});
