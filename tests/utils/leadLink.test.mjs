// tests/utils/leadLink.test.mjs — node --test (Node >= 22.18, imports the TypeScript source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadLinkAction, NO_ACCESS, NOT_AVAILABLE } from '../../utils/leadLink.ts';

const owner = { external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royal.test' };

test('an admin signed in as themselves is switched into the lead account (not told someone took it)', () => {
  assert.deepEqual(leadLinkAction({ access: 'admin', is_here: false, owner }), { kind: 'switch', ownerId: '959', partial: false, ownerEmail: 'owner@royal.test', ownerName: 'TheRoyalWoodShop' });
});

test('a partial admin switches in as a partial admin', () => {
  const a = leadLinkAction({ access: 'partial_admin', is_here: false, owner });
  assert.equal(a.kind, 'switch');
  assert.equal(a.partial, true);
});

test('the owner switched into another account goes back to their own', () => {
  assert.deepEqual(leadLinkAction({ access: 'owner', is_here: false }), { kind: 'personal' });
});

test('in the lead account but hidden from the list: taken / closed, with the server hint when there is one', () => {
  assert.deepEqual(leadLinkAction({ access: 'admin', is_here: true, owner }), { kind: 'message', text: NOT_AVAILABLE });
  assert.deepEqual(leadLinkAction({ access: 'owner', is_here: true }, 'accepted by Aiden'), { kind: 'message', text: 'This lead was accepted by Aiden.' });
});

test('no access: says so instead of blaming a teammate; junk answers never throw', () => {
  assert.deepEqual(leadLinkAction({ access: 'none', is_here: false }), { kind: 'message', text: NO_ACCESS });
  assert.deepEqual(leadLinkAction({ access: 'admin', is_here: false, owner: null }), { kind: 'message', text: NO_ACCESS });
  assert.equal(leadLinkAction(null).kind, 'message');
  assert.equal(leadLinkAction(undefined).kind, 'message');
});
