// [wdy2xh2t3w] The "Campaigns" section: the owner's own Storeels in the newsletter (shared contract 2026-10-28).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_TYPES, createBlock, blockProblem, normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';
import { changedFields, draftToInput, emptyDraft, savableChanges } from '../../components/newsletters/lib/draft.ts';
import {
  CAMPAIGNS_MAX, itemFromOption, resolveCampaignItems, toggleCampaign, campaignsPickerSummary,
} from '../../components/newsletters/lib/campaignsBlock.ts';

const item = (id, over = {}) => ({ id, title: `Campaign ${id}`, description: 'About it', cover_url: 'https://x.ca/c.jpg', url: `https://studio.x/published-memory/c${id}`, date: '2026-10-27', ...over });

test('campaigns is a block type; a new one has no campaigns yet', () => {
  assert.ok(BLOCK_TYPES.includes('campaigns'));
  assert.deepEqual(createBlock('campaigns', 'c1'), { id: 'c1', type: 'campaigns', data: { selections: [], campaign_ids: [] } });
  assert.equal(CAMPAIGNS_MAX, 6);
});

test('a campaigns section needs at least one campaign', () => {
  assert.equal(blockProblem(createBlock('campaigns', 'c')), 'Pick at least one campaign, product or vehicle, or remove this section.');
  assert.equal(blockProblem({ id: 'c', type: 'campaigns', data: { campaign_ids: [12] } }), null);
});

test('normaliseBlocks keeps ids (order, unique, max 6) and the server snapshot', () => {
  const raw = [{ id: 'c', type: 'campaigns', data: { campaign_ids: [12, '34', 12, -1, 'x', 5, 6, 7, 8, 9, 10], items: [item(12), { id: 'bad' }, item(34, { cover_url: null })] } }];
  const [b] = normaliseBlocks(raw);
  assert.deepEqual(b.data.campaign_ids, [12, 34, 5, 6, 7, 8]);
  assert.deepEqual(b.data.items.map((i) => i.id), [12, 34]);
  assert.equal(b.data.items[1].cover_url, null);
  assert.deepEqual(normaliseBlocks([{ id: 'c', type: 'campaigns', data: null }])[0].data, { selections: [], campaign_ids: [], items: [] });
});

test('Studio sends selections (and campaign_ids), never items: the API builds the snapshot itself', () => {
  const d = { ...emptyDraft(), blocks: [{ id: 'c', type: 'campaigns', data: { campaign_ids: [12, 34], items: [item(12), item(34)] } }] };
  assert.deepEqual(draftToInput(d).blocks, [{ id: 'c', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 12 }, { kind: 'campaign', id: 34 }], campaign_ids: [12, 34] } }]);
  // A new snapshot from the server is not a change to save.
  const fresher = { ...d, blocks: [{ id: 'c', type: 'campaigns', data: { campaign_ids: [12, 34], items: [item(12, { title: 'New' })] } }] };
  assert.deepEqual(changedFields(d, fresher), {});
  // The over-long-text path sends blocks too, still without items.
  const long = { id: 't', type: 'text', data: { html: `<p>${'x'.repeat(20001)}</p>` } };
  const withLong = { ...d, blocks: [...d.blocks.map((b) => ({ ...b, data: { ...b.data, selections: [{ kind: 'campaign', id: 12 }], campaign_ids: [12] } })), long] };
  const { patch } = savableChanges(d, withLong);
  assert.deepEqual(patch.blocks, [{ id: 'c', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 12 }], campaign_ids: [12] } }]);
});

test('toggleCampaign keeps the picking order and stops at 6', () => {
  assert.deepEqual(toggleCampaign([3, 1], 2), [3, 1, 2]);
  assert.deepEqual(toggleCampaign([3, 1, 2], 1), [3, 2]);
  const full = [1, 2, 3, 4, 5, 6];
  assert.equal(toggleCampaign(full, 7), full);
  assert.deepEqual(toggleCampaign(full, 6), [1, 2, 3, 4, 5]);
});

test('resolveCampaignItems: server snapshot first, then what was picked, in the section order', () => {
  const server = [item(12, { title: 'Server 12' })];
  const local = [item(12, { title: 'Local 12' }), item(34)];
  const picks = (...ids) => ids.map((id) => ({ kind: 'campaign', id }));
  assert.deepEqual(resolveCampaignItems(picks(34, 12, 99), server, local).map((i) => i.title), ['Campaign 34', 'Server 12']);
  assert.deepEqual(resolveCampaignItems([], server, local), []);
  assert.deepEqual(resolveCampaignItems(picks(1), undefined, undefined), []);
});

test('itemFromOption turns a campaign option into a card', () => {
  const option = { id: 7, title: 'Fall event', description: 'x'.repeat(300), cover_url: 'https://x.ca/a.jpg', date: '2026-10-01', public_url: 'https://studio.x/published-memory/fall', shareable: true, reason: null };
  const card = itemFromOption(option);
  assert.equal(card.url, 'https://studio.x/published-memory/fall');
  assert.equal(card.description.length, 160);
  assert.equal(itemFromOption({ ...option, cover_url: 'http://x.ca/a.jpg' }).cover_url, null);
});

test('campaignsPickerSummary says how many are picked', () => {
  assert.equal(campaignsPickerSummary(0), 'Pick up to 6 campaigns.');
  assert.equal(campaignsPickerSummary(1), '1 of 6 picked');
  assert.equal(campaignsPickerSummary(6), '6 of 6 picked. That’s the most one section can show.');
});

// NewsletterRenderer::blockView: the header colour, unless it is too light for a button on the white card.
test('campaignButtonColor follows the email: header colour, or purple when that is too light', async () => {
  const { campaignButtonColor } = await import('../../components/newsletters/lib/campaignsBlock.ts');
  assert.equal(campaignButtonColor('#111827'), '#111827');
  assert.equal(campaignButtonColor('#FFFFFF'), '#6C60FF');
  assert.equal(campaignButtonColor('#DC2626'), '#DC2626');
  assert.equal(campaignButtonColor('#F59E0B'), '#6C60FF', 'orange is too light for white text (the renderer’s 0.6 rule)');
  assert.equal(campaignButtonColor('#FDE68A'), '#6C60FF');
  assert.equal(campaignButtonColor(null), '#6C60FF');
});

// The API refreshes the snapshot on every PUT and drops campaigns that can no longer be shared.
test('adoptCampaignSnapshots takes the server’s campaigns unless the section changed while saving', async () => {
  const { adoptCampaignSnapshots } = await import('../../components/newsletters/lib/draft.ts');
  const title = { id: 't', type: 'title', data: { text: 'Hi', size: 'large' } };
  const sent = { ...emptyDraft(), blocks: [title, { id: 'c', type: 'campaigns', data: { campaign_ids: [12, 34], items: [item(12), item(34)] } }] };
  const server = [{ id: 't', type: 'title', data: { text: 'Hi', size: 'large' } }, { id: 'c', type: 'campaigns', data: { campaign_ids: [34], items: [item(34, { title: 'Fresh' })] } }];
  // Nothing changed meanwhile: both the draft and the saved copy take the server's campaigns.
  const a = adoptCampaignSnapshots(sent, sent, server);
  assert.deepEqual(a.draft.blocks[1].data, { selections: [{ kind: 'campaign', id: 34 }], campaign_ids: [34], items: [item(34, { title: 'Fresh' })] });
  assert.deepEqual(a.saved.blocks[1].data.campaign_ids, [34]);
  assert.equal(a.draft.blocks[0], title, 'other sections are untouched');
  // Picked again while the save was on its way: the new pick stays and saves next.
  const current = { ...sent, blocks: [title, { id: 'c', type: 'campaigns', data: { campaign_ids: [12, 34, 56], items: [] } }] };
  const b = adoptCampaignSnapshots(current, sent, server);
  assert.deepEqual(b.draft.blocks[1].data.campaign_ids, [12, 34, 56]);
  assert.deepEqual(b.saved.blocks[1].data.campaign_ids, [34]);
  // No campaigns sections: the same objects come back.
  const plain = { ...emptyDraft(), blocks: [title] };
  const c = adoptCampaignSnapshots(plain, plain, [title]);
  assert.equal(c.draft, plain);
  assert.equal(c.saved, plain);
});

// Review fix: a ticked campaign that stopped being shareable can still be unticked.
test('campaignOptionDisabled lets a picked campaign be unticked, whatever happens', async () => {
  const { campaignOptionDisabled } = await import('../../components/newsletters/lib/campaignsBlock.ts');
  assert.equal(campaignOptionDisabled({ shareable: false }, true, false), false, 'ticked but no longer shareable: can untick');
  assert.equal(campaignOptionDisabled({ shareable: false }, false, false), true);
  assert.equal(campaignOptionDisabled({ shareable: true }, false, true), true, 'a seventh');
  assert.equal(campaignOptionDisabled({ shareable: true }, true, true), false);
  assert.equal(campaignOptionDisabled({ shareable: true }, false, false), false);
});
