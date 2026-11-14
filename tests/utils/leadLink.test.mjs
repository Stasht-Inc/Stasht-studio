// tests/utils/leadLink.test.mjs — node --test (Node >= 22.18, imports the TypeScript source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadLinkAction, NO_ACCESS, NOT_AVAILABLE } from '../../utils/leadLink.ts';

const owner = { external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royal.test' };

// Chris 14 Nov 2026: Admins / Partial Admins work the business's leads from inside it, so a lead link switches them in.
test('an admin or partial admin in their own account is switched into the business', () => {
  assert.deepEqual(leadLinkAction({ access: 'admin', is_here: false, switched_in: false, visible_in_own_account: false, owner }),
    { kind: 'switch', ownerId: '959', partial: false, ownerEmail: 'owner@royal.test', ownerName: 'TheRoyalWoodShop' });
  assert.deepEqual(leadLinkAction({ access: 'partial_admin', is_here: false, owner }, 'accepted by Lindsay'),
    { kind: 'switch', ownerId: '959', partial: true, ownerEmail: 'owner@royal.test', ownerName: 'TheRoyalWoodShop' });
  // No owner details: nothing to switch to.
  assert.deepEqual(leadLinkAction({ access: 'admin', is_here: false }, 'accepted by Lindsay'), { kind: 'message', text: 'This lead was accepted by Lindsay.' });
});

test('switched into some account, they go back to their own account when the lead is listed there', () => {
  assert.deepEqual(leadLinkAction({ access: 'partial_admin', is_here: false, switched_in: true, visible_in_own_account: true, owner }), { kind: 'personal' });
  // Switched into ANOTHER business: into the lead's business instead.
  assert.equal(leadLinkAction({ access: 'admin', is_here: false, switched_in: true, visible_in_own_account: false, owner }).kind, 'switch');
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
  assert.equal(leadLinkAction(null).kind, 'message');
  assert.equal(leadLinkAction(undefined).kind, 'message');
});
