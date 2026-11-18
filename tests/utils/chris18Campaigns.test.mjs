// Chris 18 Nov 2026: default category shown as "Campaigns", no empty "Product campaigns" section, pending invites first
// and openable from the sidebar (utils/products, utils/campaignInvites).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryDisplayName, categoryCampaignsPhrase, noCampaignsTitle, campaignsWillAppear, isEmptyCatalogueCategory } from '../../utils/products.ts';
import { invitesFirst, inviteRevealMarker, isPendingInvite, parseInviteRevealMarker } from '../../utils/campaignInvites.ts';

test('the stored default category "Personal" reads "Campaigns"; other names unchanged', () => {
  assert.equal(categoryDisplayName('Personal'), 'Campaigns');
  assert.equal(categoryDisplayName(' personal '), 'Campaigns');
  assert.equal(categoryDisplayName('Travel'), 'Travel');
  assert.equal(categoryDisplayName('Website Catalogue'), 'Product campaigns');
  assert.equal(categoryDisplayName(null), null);
  assert.equal(categoryCampaignsPhrase('Personal'), 'Campaigns');
  assert.equal(noCampaignsTitle('Personal'), 'No campaigns yet');
  assert.equal(campaignsWillAppear('Personal', 'your'), 'Your campaigns will appear here.');
});

test('an empty leftover "Website Catalogue" category is hidden; one with campaigns still shows', () => {
  assert.equal(isEmptyCatalogueCategory('Website Catalogue', 0), true);
  assert.equal(isEmptyCatalogueCategory('Website Catalogue', undefined), true);
  assert.equal(isEmptyCatalogueCategory('Website Catalogue', 3), false);
  assert.equal(isEmptyCatalogueCategory('Personal', 0), false);
});

test('invite markers round-trip; other ids are not invites', () => {
  assert.equal(parseInviteRevealMarker(inviteRevealMarker(42)), '42');
  assert.equal(parseInviteRevealMarker('42'), null);
  assert.equal(parseInviteRevealMarker('pa-1'), null);
  assert.equal(parseInviteRevealMarker('invite:'), null);
});

test('pending invites sort first, keeping each group in its order / column sort', () => {
  const cards = [
    { id: 1, category: { name: 'Personal' }, t: 'b' },
    { id: 2, category: { name: 'Invites' }, t: 'z' },
    { id: 3, category: 'Travel', t: 'a' },
    { id: 4, category: 'Invites', t: 'y' },
  ];
  assert.deepEqual(invitesFirst(cards).map((c) => c.id), [2, 4, 1, 3]);
  assert.deepEqual(invitesFirst(cards, (a, b) => a.t.localeCompare(b.t)).map((c) => c.id), [4, 2, 3, 1]);
  assert.equal(isPendingInvite({ category: { name: 'Invites' } }), true);
  assert.equal(isPendingInvite({ category: { name: 'Shared With' } }), false);
});
