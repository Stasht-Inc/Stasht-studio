// Chris, 3 Nov 2026: the preview showed 4+ empty "Show campaigns, products or vehicles in this email. Choose"
// sections stacked. Root cause: "+ → Campaign" added the empty section before its picker opened, and closing the picker
// without picking left it there (saved with the draft) — one more each try. Now the section is added on Done with
// something picked (campaignsBlockWith), and opening a draft keeps only the first of a run of empty ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToInput, campaignsBlockWith, dedupeEmptyCampaigns, isEmptyCampaignsBlock, normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';

const empty = (id) => ({ id, type: 'campaigns', data: { selections: [], campaign_ids: [], columns: 2 } });
const picked = (id, cid = 601) => ({ id, type: 'campaigns', data: { selections: [{ kind: 'campaign', id: cid }], campaign_ids: [cid], items: [] } });
const text = (id) => ({ id, type: 'text', data: { html: '<p>Hi</p>' } });
const ids = (blocks) => blocks.map((b) => b.id);

test('isEmptyCampaignsBlock: a Campaigns section with nothing picked (also an older campaign_ids-only one)', () => {
  assert.equal(isEmptyCampaignsBlock(empty('c1')), true);
  assert.equal(isEmptyCampaignsBlock(picked('c1')), false);
  assert.equal(isEmptyCampaignsBlock({ id: 'c1', type: 'campaigns', data: { campaign_ids: [601] } }), false);
  assert.equal(isEmptyCampaignsBlock({ id: 'c1', type: 'campaigns', data: { campaign_ids: [] } }), true);
  assert.equal(isEmptyCampaignsBlock(text('t1')), false);
});

test('a run of empty Campaigns sections keeps only its first', () => {
  const blocks = [text('nl-message'), empty('c1'), empty('c2'), empty('c3'), empty('c4'), text('t2')];
  assert.deepEqual(ids(dedupeEmptyCampaigns(blocks)), ['nl-message', 'c1', 't2']);
});

test('never drops a section with anything picked, or anything else', () => {
  const blocks = [empty('c1'), picked('c2'), empty('c3'), text('t1'), empty('c4'), picked('c5', 602), picked('c6', 603)];
  assert.equal(dedupeEmptyCampaigns(blocks), blocks, 'no two empty ones side by side: the same array (nothing to save)');
  const mixed = [picked('c0'), empty('c1'), empty('c2'), picked('c3', 602), empty('c4'), empty('c5')];
  assert.deepEqual(ids(dedupeEmptyCampaigns(mixed)), ['c0', 'c1', 'c3', 'c4']);
});

test('the same array back when nothing changes', () => {
  const blocks = [text('t1'), picked('c1')];
  assert.equal(dedupeEmptyCampaigns(blocks), blocks);
  assert.deepEqual(dedupeEmptyCampaigns([]), []);
});

test('a draft as the API returns it (normaliseBlocks) is de-duplicated the same way', () => {
  const raw = [
    { id: 'nl-message', type: 'text', data: { html: '<p>Hi</p>' } },
    { id: 'ba', type: 'campaigns', data: { selections: [], campaign_ids: [], items: [], columns: 2 } },
    { id: 'bb', type: 'campaigns', data: { selections: [], campaign_ids: [], items: [], columns: 2 } },
    { id: 'bc', type: 'campaigns', data: { selections: [], campaign_ids: [], items: [] } },
    { id: 'bd', type: 'campaigns', data: { selections: [{ kind: 'vehicle', id: 45 }], campaign_ids: [], items: [] } },
  ];
  assert.deepEqual(ids(dedupeEmptyCampaigns(normaliseBlocks(raw))), ['nl-message', 'ba', 'bd']);
});

test('campaignsBlockWith: the new section holds the picks and saves like any Campaigns section (2 columns)', () => {
  const items = [{ kind: 'vehicle', id: 45, title: 'Jeep', description: null, cover_url: null, url: 'https://dealer.example.ca/45', date: null }];
  const block = campaignsBlockWith('bnew1', [{ kind: 'vehicle', id: 45 }], items);
  assert.equal(isEmptyCampaignsBlock(block), false);
  assert.deepEqual(block.data.items, items);
  assert.deepEqual(blocksToInput([block]), [{ id: 'bnew1', type: 'campaigns', data: { selections: [{ kind: 'vehicle', id: 45 }], campaign_ids: [], columns: 2 } }]);
});
