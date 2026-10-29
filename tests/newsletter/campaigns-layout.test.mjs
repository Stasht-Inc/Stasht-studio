// Chris's feedback, 29 Oct (round 2): a Campaign section shows its cards in 1 or 2 columns (shared brief
// "Data contract": data.columns 1 | 2, absent = 1; Studio sets 2 on a NEW section). Phones always show 1 column.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToInput, createBlock, normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';
import { adoptCampaignSnapshots, changedFields, emptyDraft, savableChanges } from '../../components/newsletters/lib/draft.ts';
import { EDIT_ITEMS_LABEL, campaignColumns, previewColumns } from '../../components/newsletters/lib/campaignsBlock.ts';

const c = (id) => ({ kind: 'campaign', id });
const item = (kind, id) => ({ kind, id, title: `${kind} ${id}`, description: '', cover_url: null, url: `https://x.ca/${id}`, date: null, price_text: null, meta: null });
const block = (data, id = 's') => ({ id, type: 'campaigns', data: { selections: [c(1)], campaign_ids: [1], items: [item('campaign', 1)], ...data } });

test('a new Campaign section starts with 2 columns', () => {
  assert.deepEqual(createBlock('campaigns', 'c1').data, { selections: [], campaign_ids: [], columns: 2 });
});

test('columns as the API sends them: 1 or 2 kept, anything else (or none: an older section) left out and read as 1', () => {
  const read = (columns) => normaliseBlocks([{ id: 's', type: 'campaigns', data: { campaign_ids: [1], columns } }])[0].data;
  assert.equal(read(2).columns, 2);
  assert.equal(read(1).columns, 1);
  assert.equal(read('2').columns, 2);
  for (const bad of [undefined, null, 3, 0, 'two', 1.5]) assert.equal('columns' in read(bad), false, `${bad} is left out`);
  assert.equal(campaignColumns(read(undefined)), 1, 'an older section reads as 1 column');
  assert.equal(campaignColumns({ columns: 2 }), 2);
  assert.equal(campaignColumns({}), 1);
});

test('the preview shows 2 columns only for a 2-column section outside the phone view', () => {
  assert.equal(previewColumns({ columns: 2 }, false), 2);
  assert.equal(previewColumns({ columns: 2 }, true), 1, 'phones: one column, as the email');
  assert.equal(previewColumns({ columns: 1 }, false), 1);
  assert.equal(previewColumns({}, false), 1);
});

test('PUT sends columns: 1 for an older section, the chosen number otherwise', () => {
  assert.deepEqual(blocksToInput([block({})])[0].data, { selections: [c(1)], campaign_ids: [1], columns: 1 });
  assert.deepEqual(blocksToInput([block({ columns: 2 })])[0].data, { selections: [c(1)], campaign_ids: [1], columns: 2 });
});

test('an older section opened and left alone is not a change (no save); changing its columns is', () => {
  const [old] = normaliseBlocks([{ id: 's', type: 'campaigns', data: { campaign_ids: [1], items: [item('campaign', 1)] } }]);
  const saved = { ...emptyDraft(), blocks: [old] };
  assert.deepEqual(changedFields(saved, { ...saved }), {});
  assert.deepEqual(savableChanges(saved, { ...saved }).patch, {});
  const two = { ...saved, blocks: [{ ...old, data: { ...old.data, columns: 2 } }] };
  assert.deepEqual(changedFields(saved, two).blocks[0].data.columns, 2);
  // Back to 1: the same as the saved copy (absent = 1), so nothing to save.
  const one = { ...saved, blocks: [{ ...old, data: { ...old.data, columns: 1 } }] };
  assert.deepEqual(changedFields(saved, one), {});
});

test('after a save: the server’s columns are taken; a section whose columns changed meanwhile keeps the new choice', () => {
  const sent = { ...emptyDraft(), blocks: [block({ columns: 2 })] };
  const server = [block({ columns: 2 })];
  const a = adoptCampaignSnapshots(sent, sent, server);
  assert.equal(a.draft.blocks[0].data.columns, 2);
  assert.equal(a.saved.blocks[0].data.columns, 2);
  // Changed to 1 while the save was on its way: the draft keeps 1 (it saves next), the saved copy has 2.
  const current = { ...sent, blocks: [block({ columns: 1 })] };
  const b = adoptCampaignSnapshots(current, sent, server);
  assert.equal(b.draft.blocks[0].data.columns, 1);
  assert.equal(b.saved.blocks[0].data.columns, 2);
  assert.equal(Object.keys(changedFields(b.saved, b.draft)).length, 1, 'one more save, for the new choice');
  // An API that doesn't answer with columns yet: the section keeps what it sent (no flip back, no save loop).
  const older = [{ id: 's', type: 'campaigns', data: { selections: [c(1)], campaign_ids: [1], items: [item('campaign', 1)] } }];
  const d = adoptCampaignSnapshots(sent, sent, normaliseBlocks(older));
  assert.equal(d.draft.blocks[0].data.columns, 2);
  assert.deepEqual(changedFields(d.saved, d.draft), {});
});

test('the section’s picker button reads "Edit"', () => {
  assert.equal(EDIT_ITEMS_LABEL, 'Edit campaigns, products or vehicles');
});
