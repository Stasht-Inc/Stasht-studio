// Products and vehicles in the Campaigns section (shared brief 2026-10-29): selections of three kinds, up to 6 in
// all, cards that link to the item's own page on the business's website.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBlock, blockProblem, blocksToInput, normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';
import { adoptCampaignSnapshots, emptyDraft } from '../../components/newsletters/lib/draft.ts';
import {
  CAMPAIGNS_MAX, EDIT_ITEMS_LABEL, campaignIdsOf, categoryLabel, missingItemsNote, itemButtonLabel, itemFromOption, normaliseCampaignItems, normaliseSelections, optionLine,
  pickerDefaultKind, pickerKinds, pickerSummary, pickerTitle, resolveCampaignItems, selectionKey, toggleSelection,
} from '../../components/newsletters/lib/campaignsBlock.ts';

const c = (id) => ({ kind: 'campaign', id });
const p = (id) => ({ kind: 'product', id });
const v = (id) => ({ kind: 'vehicle', id });

test('normaliseSelections: kinds kept in order, each once, at most 6; old blocks read campaign_ids as campaigns', () => {
  assert.deepEqual(normaliseSelections([c(12), p(881), v(45)], [12]), [c(12), p(881), v(45)]);
  // The same id in two kinds is two different things.
  assert.deepEqual(normaliseSelections([c(12), p(12), c(12)], []), [c(12), p(12)]);
  assert.deepEqual(normaliseSelections([{ kind: 'boat', id: 1 }, { kind: 'product', id: -3 }, { kind: 'product', id: '7' }, null, 'x'], []), [p(7)]);
  assert.deepEqual(normaliseSelections([p(1), p(2), p(3), c(4), c(5), v(6), v(7)], []).length, CAMPAIGNS_MAX);
  // No selections at all: an older block, its campaign_ids are campaigns.
  assert.deepEqual(normaliseSelections(undefined, [12, '34', 12]), [c(12), c(34)]);
  // selections present (even empty) wins over campaign_ids.
  assert.deepEqual(normaliseSelections([], [12]), []);
});

test('campaignIdsOf: the campaign-kind ids, in order (kept for older readers)', () => {
  assert.deepEqual(campaignIdsOf([p(1), c(12), v(2), c(3)]), [12, 3]);
  assert.deepEqual(campaignIdsOf([]), []);
});

test('toggleSelection: picking order kept across kinds, 6 in all is the most', () => {
  assert.deepEqual(toggleSelection([c(1)], p(1)), [c(1), p(1)]);
  assert.deepEqual(toggleSelection([c(1), p(1)], c(1)), [p(1)]);
  const full = [c(1), c(2), p(3), p(4), v(5), v(6)];
  assert.equal(toggleSelection(full, p(9)), full, 'a seventh is refused');
  assert.deepEqual(toggleSelection(full, p(4)), [c(1), c(2), p(3), v(5), v(6)]);
  assert.equal(selectionKey(p(4)), 'product:4');
});

test('a new section has no selections; blocks read old and new data; PUT sends selections and campaign_ids', () => {
  assert.deepEqual(createBlock('campaigns', 'c1').data, { selections: [], campaign_ids: [], columns: 2 });
  const [old] = normaliseBlocks([{ id: 'c', type: 'campaigns', data: { campaign_ids: [12, 34] } }]);
  assert.deepEqual(old.data.selections, [c(12), c(34)]);
  const [mixed] = normaliseBlocks([{ id: 'c', type: 'campaigns', data: { selections: [p(881), c(12), v(45)], campaign_ids: [12], items: [] } }]);
  assert.deepEqual(mixed.data.selections, [p(881), c(12), v(45)]);
  assert.deepEqual(mixed.data.campaign_ids, [12]);
  assert.deepEqual(blocksToInput([mixed]), [{ id: 'c', type: 'campaigns', data: { selections: [p(881), c(12), v(45)], campaign_ids: [12], columns: 1 } }]);
});

test('a section with only products or vehicles is finished; an empty one names all three kinds', () => {
  assert.equal(blockProblem({ id: 'c', type: 'campaigns', data: { selections: [p(1)], campaign_ids: [] } }), null);
  assert.equal(blockProblem(createBlock('campaigns', 'c')), 'Pick at least one campaign, product or vehicle, or remove this section.');
});

test('normaliseCampaignItems: kind (campaign when missing), price and meta; links must be http(s)', () => {
  const items = normaliseCampaignItems([
    { id: 12, title: 'Fall event', description: 'd', cover_url: 'https://x.ca/a.jpg', url: 'https://studio.x/p/fall', date: '2026-10-01' },
    { kind: 'product', id: 881, title: 'Oak door', description: '', cover_url: 'http://x.ca/b.jpg', url: 'http://royalwood.ca/oak', date: null, price_text: '$129.99', meta: 'Royalwood · Doors' },
    { kind: 'vehicle', id: 45, title: '2021 Jeep', url: 'javascript:alert(1)', price_text: '', meta: null },
    { kind: 'boat', id: 2, title: 'No' },
  ]);
  assert.deepEqual(items.map((i) => `${i.kind}:${i.id}`), ['campaign:12', 'product:881', 'vehicle:45']);
  assert.equal(items[0].price_text, null);
  assert.equal(items[1].price_text, '$129.99');
  assert.equal(items[1].meta, 'Royalwood · Doors');
  assert.equal(items[1].cover_url, null, 'covers are https only');
  assert.equal(items[1].url, 'http://royalwood.ca/oak', 'a product page may be http');
  assert.equal(items[2].url, '', 'a javascript: link is never kept');
  assert.equal(items[2].price_text, null);
});

test('resolveCampaignItems keys by kind: campaign 12 and product 12 are different cards', () => {
  const server = [{ kind: 'campaign', id: 12, title: 'Campaign 12', description: '', cover_url: null, url: 'https://s/12', date: null, price_text: null, meta: null }];
  const local = [{ kind: 'product', id: 12, title: 'Product 12', description: '', cover_url: null, url: 'https://r/12', date: null, price_text: '$5', meta: null }];
  assert.deepEqual(resolveCampaignItems([p(12), c(12), v(1)], server, local).map((i) => i.title), ['Product 12', 'Campaign 12']);
  // Items from before kinds existed are campaigns.
  assert.deepEqual(resolveCampaignItems([c(7)], [{ id: 7, title: 'Old', description: '', cover_url: null, url: 'https://s/7', date: null }], []).map((i) => i.title), ['Old']);
});

test('itemFromOption carries the kind, price and meta; the link is the option’s own page', () => {
  const option = { kind: 'product', id: 881, title: 'Oak door', description: 'x'.repeat(300), cover_url: 'https://r.ca/a.jpg', date: '2026-10-01', public_url: 'https://royalwood.ca/oak', shareable: true, reason: null, price_text: '$129.99', meta: 'Royalwood · Doors', category: 'Doors' };
  const card = itemFromOption(option);
  assert.equal(card.kind, 'product');
  assert.equal(card.url, 'https://royalwood.ca/oak');
  assert.equal(card.price_text, '$129.99');
  assert.equal(card.meta, 'Royalwood · Doors');
  assert.equal(card.description.length, 160);
  // An option without a kind (older API) is a campaign; the picker can say which kind it asked for.
  const { kind, ...noKind } = option;
  assert.equal(itemFromOption(noKind).kind, 'campaign');
  assert.equal(itemFromOption(noKind, 'vehicle').kind, 'vehicle');
});

test('which tabs show, and which one the picker opens on', () => {
  assert.deepEqual(pickerKinds(undefined), ['campaign'], 'an older API with no counts: campaigns only');
  assert.deepEqual(pickerKinds({ campaign: 4, product: 0, vehicle: 0 }), ['campaign']);
  assert.deepEqual(pickerKinds({ campaign: 0, product: 454, vehicle: 0 }), ['campaign', 'product'], 'Campaigns always shows');
  assert.deepEqual(pickerKinds({ campaign: 3, product: 0, vehicle: 12 }), ['campaign', 'vehicle']);
  assert.deepEqual(pickerKinds({ campaign: 3, product: 2, vehicle: 12 }), ['campaign', 'product', 'vehicle']);
  assert.equal(pickerDefaultKind(undefined), 'campaign');
  assert.equal(pickerDefaultKind({ campaign: 0, product: 454, vehicle: 0 }), 'product', 'Royalwood opens on Products');
  assert.equal(pickerDefaultKind({ campaign: 0, product: 0, vehicle: 7 }), 'vehicle');
  assert.equal(pickerDefaultKind({ campaign: 2, product: 454, vehicle: 0 }), 'campaign');
  assert.equal(pickerDefaultKind({ campaign: 0, product: 0, vehicle: 0 }), 'campaign', 'nothing at all: today’s empty Campaigns list');
});

test('title and summary: today’s words for campaigns only, all three kinds otherwise', () => {
  assert.equal(pickerTitle(false), 'Choose campaigns');
  assert.equal(pickerTitle(true), 'Choose campaigns, products or vehicles');
  assert.equal(pickerSummary(0, false), 'Pick up to 6 campaigns.');
  assert.equal(pickerSummary(2, false), '2 of 6 picked');
  assert.equal(pickerSummary(0, true), 'Pick up to 6.');
  assert.equal(pickerSummary(3, true), '3 of 6 chosen');
  assert.equal(pickerSummary(6, true), '6 of 6 chosen. That’s the most one section can show.');
});

test('the card button says what it opens', () => {
  assert.equal(itemButtonLabel('campaign'), 'View campaign');
  assert.equal(itemButtonLabel('product'), 'View product');
  assert.equal(itemButtonLabel('vehicle'), 'View vehicle');
  assert.equal(itemButtonLabel(undefined), 'View campaign');
});

test('optionLine: price and meta for products and vehicles, the date for campaigns', () => {
  assert.deepEqual(optionLine({ kind: 'product', price_text: '$129.99', meta: 'Royalwood · Doors', date: '2026-10-01' }, 'en-US'), { price: '$129.99', detail: 'Royalwood · Doors' });
  assert.deepEqual(optionLine({ kind: 'vehicle', price_text: null, meta: '2021 · 45,000 km · Automatic', date: '2026-10-01' }, 'en-US'), { price: null, detail: '2021 · 45,000 km · Automatic' });
  assert.deepEqual(optionLine({ kind: 'product', price_text: ' ', meta: '', date: null }, 'en-US'), { price: null, detail: null });
  assert.deepEqual(optionLine({ kind: 'campaign', date: '2026-10-01', price_text: null, meta: null }, 'en-US'), { price: null, detail: 'Oct 1, 2026' });
  assert.deepEqual(optionLine({ date: '2026-10-01' }, 'en-US'), { price: null, detail: 'Oct 1, 2026' }, 'no kind: a campaign');
});

test('adoptCampaignSnapshots follows selections: a product pick made while saving stays', () => {
  const item = (kind, id) => ({ kind, id, title: `${kind} ${id}`, description: '', cover_url: null, url: `https://x.ca/${id}`, date: null, price_text: null, meta: null });
  const block = (selections, items = []) => ({ id: 'c', type: 'campaigns', data: { selections, campaign_ids: campaignIdsOf(selections), items } });
  const sent = { ...emptyDraft(), blocks: [block([c(12), p(881)])] };
  const server = [block([p(881)], [item('product', 881)])];
  const a = adoptCampaignSnapshots(sent, sent, server);
  assert.deepEqual(a.draft.blocks[0].data.selections, [p(881)]);
  assert.deepEqual(a.draft.blocks[0].data.campaign_ids, []);
  const current = { ...sent, blocks: [block([c(12), p(881), v(45)])] };
  const b = adoptCampaignSnapshots(current, sent, server);
  assert.deepEqual(b.draft.blocks[0].data.selections, [c(12), p(881), v(45)], 'changed while saving: the new pick stays');
  assert.deepEqual(b.saved.blocks[0].data.selections, [p(881)]);
});

test('missingItemsNote says what was left out, in the words of its kind', () => {
  const card = (kind, id) => ({ kind, id });
  assert.equal(missingItemsNote([c(1), c(2)], [card('campaign', 1)]), 'A campaign picked here can’t be shown any more (it may no longer be published), so it’s left out of the email.');
  assert.equal(missingItemsNote([c(1), p(2)], [card('campaign', 1)]), 'A product picked here can’t be shown any more (it may no longer be available), so it’s left out of the email.');
  assert.equal(missingItemsNote([v(3), c(1)], [card('campaign', 1)]), 'A vehicle picked here can’t be shown any more (it may have sold), so it’s left out of the email.');
  assert.equal(missingItemsNote([v(3), p(2), c(1)], [card('campaign', 1)]), 'Some picks here can’t be shown any more, so they’re left out of the email.');
  assert.equal(missingItemsNote([c(1)], [card('campaign', 1)]), '');
  assert.equal(EDIT_ITEMS_LABEL, 'Edit campaigns, products or vehicles');
});

// The API sends vehicle categories as cars.category has them ("preowned"); they read as Studio's cars cards do.
test('categoryLabel: vehicle categories as the cars cards label them, product categories as they are', () => {
  assert.equal(categoryLabel('vehicle', 'preowned'), 'Preowned');
  assert.equal(categoryLabel('vehicle', 'hybrid'), 'Hybrid');
  assert.equal(categoryLabel('vehicle', 'certified_pre-owned'), 'Certified Pre Owned');
  assert.equal(categoryLabel('product', 'Door Hardware'), 'Door Hardware');
  assert.equal(categoryLabel('product', 'doors'), 'doors');
});
