// Deepak, 9 Nov 2026: "Select from Existing Campaigns" back on Edit (hidden by 2c44261). Ticks = the campaign's saved
// linked campaigns + the changes made here; Save Changes links the newly ticked (POST /memories/{id}/linked-memories)
// and unlinks the unticked (DELETE /memories/{id}/linked-memories/{linked_id}). Links made with Add a Moment's
// "Campaigns (optional)" are saved links, so they show ticked here too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_LINKS, savedLinkedCampaignIds, tickedLinks, toggleLink, selectVisible, deselectVisible, linkChanges, editPickerCampaigns, LINKS_SAVE_NOTE, LINKS_FAILED } from '../../components/storeel/lib/editLinks.ts';

test('saved linked campaigns: the campaign cards of its moments (not vehicles, photos or Shopify collections)', () => {
  const moments = [
    { kind: 'campaign', key: 'campaign-12', sourceId: '12' },
    { kind: 'vehicle', key: 'car-5', sourceId: '5' },
    { kind: 'photo', key: 'post-1' },
    { kind: 'campaign', key: 'shopify-9', sourceId: '9' },
    { kind: 'campaign', key: 'campaign-14', sourceId: '14' },
  ];
  assert.deepEqual(savedLinkedCampaignIds(moments), ['12', '14']);
  assert.deepEqual(savedLinkedCampaignIds(null), []);
});

test('ticks = saved + added − removed; toggling is relative to what is shown', () => {
  const saved = ['12', '14'];
  assert.deepEqual(tickedLinks(saved, EMPTY_LINKS), ['12', '14']);
  let d = toggleLink(saved, EMPTY_LINKS, '20'); // tick a new one
  assert.deepEqual(d, { add: ['20'], remove: [] });
  d = toggleLink(saved, d, '12'); // untick a saved one
  assert.deepEqual(d, { add: ['20'], remove: ['12'] });
  assert.deepEqual(tickedLinks(saved, d), ['14', '20']);
  d = toggleLink(saved, d, '12'); // tick it again: no change left
  d = toggleLink(saved, d, '20'); // untick the new one: no change left
  assert.deepEqual(d, EMPTY_LINKS);
});

test('a campaign linked meanwhile with Add a Moment shows ticked; one unlinked from step 2 shows unticked', () => {
  const d = { add: ['20'], remove: ['12'] };
  assert.deepEqual(tickedLinks(['12', '14', '30'], d), ['14', '30', '20']);
  assert.deepEqual(tickedLinks(['14'], d), ['14', '20']);
  assert.deepEqual(linkChanges(['14', '20'], d), { link: [], unlink: [] }, 'already as wanted: nothing to send');
});

test('Select All adds the visible campaigns to the ticks; Deselect All removes only the visible ones (review)', () => {
  const saved = ['12', '14'];
  assert.deepEqual(tickedLinks(saved, selectVisible(saved, EMPTY_LINKS, ['20', '21'])), ['12', '14', '20', '21'], 'search shows 20, 21: 12, 14 stay');
  assert.deepEqual(linkChanges(saved, selectVisible(saved, EMPTY_LINKS, ['20', '21'])), { link: ['20', '21'], unlink: [] });
  const d = deselectVisible(saved, EMPTY_LINKS, ['14', '20']); // filtered list shows 14 and 20
  assert.deepEqual(tickedLinks(saved, d), ['12'], '12 (hidden by the search) stays ticked');
  assert.deepEqual(linkChanges(saved, d), { link: [], unlink: ['14'] });
  // undoing: deselect then select the same visible ids → no change left
  assert.deepEqual(linkChanges(saved, selectVisible(saved, d, ['14', '20'])), { link: ['20'], unlink: [] });
});

test('a saved link that is not in the list at all is never unlinked by Select All / Deselect All', () => {
  const saved = ['12', '99']; // 99: linked, but not in the list (another page / not returned)
  const listed = ['12', '14', '20'];
  let d = deselectVisible(saved, EMPTY_LINKS, listed);
  assert.deepEqual(linkChanges(saved, d), { link: [], unlink: ['12'] });
  d = selectVisible(saved, d, listed);
  assert.deepEqual(linkChanges(saved, d), { link: ['14', '20'], unlink: [] });
  assert.ok(tickedLinks(saved, d).includes('99'));
});

test('Save Changes: link the newly ticked, unlink the unticked saved ones', () => {
  assert.deepEqual(linkChanges(['12', '14'], { add: ['20', '14'], remove: ['12', '99'] }), { link: ['20'], unlink: ['12'] });
  assert.deepEqual(linkChanges([], EMPTY_LINKS), { link: [], unlink: [] });
});

test('the Edit list: the account\'s campaigns, never the campaign itself or a pending invite', () => {
  const list = [{ id: 901, title: 'Self' }, { id: 12, title: 'A' }, { id: 13, title: 'Invite', is_invite: true }, { id: 14, title: 'B', invite_id: null }, { id: 15, invite_id: 7 }, null];
  assert.deepEqual(editPickerCampaigns(list, 901).map((m) => m.id), [12, 14]);
});

test('the words', () => {
  assert.equal(LINKS_SAVE_NOTE, 'Linked and removed when you press Save Changes.');
  assert.equal(LINKS_FAILED, "Your changes were saved, but the linked campaigns couldn't be updated. Try again.");
});
