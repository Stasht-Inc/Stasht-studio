// Chris's feedback, 29 Oct (round 2): each card in a Campaign section can be edited for this newsletter only (image,
// title, description, button text), never the catalogue or the campaign; the link stays the item's own page. Shared
// brief "Data contract": data.overrides keyed "<kind>:<id>", every field optional, empty = the item's own value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksToInput, normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';
import { adoptCampaignSnapshots, changedFields, emptyDraft } from '../../components/newsletters/lib/draft.ts';
import {
  CARD_LIMITS, cardHasEdits, displayCard, normaliseOverrides, overridesForInput, pruneOverrides, resetCardOverride, setCardOverride,
} from '../../components/newsletters/lib/campaignsBlock.ts';

const p = (id) => ({ kind: 'product', id });
const c = (id) => ({ kind: 'campaign', id });
const item = (kind, id, over = {}) => ({ kind, id, title: `${kind} ${id}`, description: `About ${id}`, cover_url: `https://x.ca/${id}.jpg`, url: `https://shop.ca/${id}`, date: null, price_text: '$29.00', meta: null, ...over });
const block = (data) => ({ id: 's', type: 'campaigns', data: { selections: [p(881), c(12)], campaign_ids: [12], columns: 2, items: [item('product', 881), item('campaign', 12)], ...data } });

test('limits from the contract', () => {
  assert.deepEqual(CARD_LIMITS, { title: 120, description: 300, button_text: 30 });
});

test('displayCard: an edit wins, an empty or missing one shows the item’s own value; the link never changes', () => {
  const it = item('product', 881);
  assert.deepEqual(displayCard(it, undefined), { image: 'https://x.ca/881.jpg', title: 'product 881', description: 'About 881', button: 'View product', url: 'https://shop.ca/881' });
  const edited = displayCard(it, { image_url: 'https://cdn.x.ca/mine.jpg', title: 'Brass handle, 20% off', description: 'This week only.', button_text: 'Shop now', url: 'https://evil.example' });
  assert.deepEqual(edited, { image: 'https://cdn.x.ca/mine.jpg', title: 'Brass handle, 20% off', description: 'This week only.', button: 'Shop now', url: 'https://shop.ca/881' });
  assert.deepEqual(displayCard(it, { title: '   ', description: '', button_text: null, image_url: 'http://not-https.ca/a.jpg' }), displayCard(it, undefined));
  assert.equal(displayCard(item('vehicle', 45), {}).button, 'View vehicle');
  assert.equal(displayCard(item('campaign', 12, { cover_url: null }), {}).image, null);
});

test('setCardOverride: one field at a time; clearing every field drops the card; reset drops it too', () => {
  let o = setCardOverride(undefined, 'product:881', { title: 'New title' });
  assert.deepEqual(o, { 'product:881': { title: 'New title' } });
  o = setCardOverride(o, 'product:881', { button_text: 'Shop now' });
  assert.deepEqual(o, { 'product:881': { title: 'New title', button_text: 'Shop now' } });
  o = setCardOverride(o, 'campaign:12', { image_url: 'https://cdn.x.ca/a.jpg' });
  o = setCardOverride(o, 'product:881', { title: '' });
  assert.deepEqual(o, { 'product:881': { button_text: 'Shop now' }, 'campaign:12': { image_url: 'https://cdn.x.ca/a.jpg' } });
  o = setCardOverride(o, 'product:881', { button_text: null });
  assert.deepEqual(o, { 'campaign:12': { image_url: 'https://cdn.x.ca/a.jpg' } });
  assert.deepEqual(resetCardOverride(o, 'campaign:12'), {});
  // Typing keeps spaces as typed (they are trimmed only when saved).
  assert.equal(setCardOverride({}, 'product:881', { title: 'Two ' })['product:881'].title, 'Two ');
  assert.equal(cardHasEdits({ title: '  ' }), false);
  assert.equal(cardHasEdits({ button_text: 'Go' }), true);
  assert.equal(cardHasEdits(undefined), false);
});

test('overridesForInput: only picked cards, known fields, trimmed, within limits, https images, in the picks’ order', () => {
  const raw = {
    'campaign:12': { title: '  Fall event  ', junk: 'x' },
    'product:881': { description: 'Line one\nline two', button_text: 'b'.repeat(40), image_url: 'https://cdn.x.ca/a.jpg' },
    'product:999': { title: 'Not picked any more' },
    'vehicle:45': { title: '   ' },
    'campaign:7': { image_url: 'http://plain.ca/a.jpg' },
  };
  const out = overridesForInput(raw, [p(881), c(12), { kind: 'vehicle', id: 45 }, c(7)]);
  assert.deepEqual(Object.keys(out), ['product:881', 'campaign:12']);
  assert.deepEqual(out['campaign:12'], { title: 'Fall event' });
  assert.deepEqual(out['product:881'], { image_url: 'https://cdn.x.ca/a.jpg', description: 'Line one line two', button_text: 'b'.repeat(30) });
  assert.equal(overridesForInput({ 'campaign:12': { title: 't'.repeat(130), description: 'd'.repeat(310) } }, [c(12)])['campaign:12'].title.length, 120);
  assert.equal(overridesForInput({ 'campaign:12': { description: 'd'.repeat(310) } }, [c(12)])['campaign:12'].description.length, 300);
  assert.deepEqual(overridesForInput(undefined, [c(12)]), {});
});

test('normaliseOverrides reads what the API sends (an empty PHP array too); nothing at all stays undefined', () => {
  assert.equal(normaliseOverrides(undefined), undefined);
  assert.equal(normaliseOverrides(null), undefined);
  assert.deepEqual(normaliseOverrides([]), {});
  assert.deepEqual(normaliseOverrides({ 'product:881': { title: 'A', url: 'https://x' }, 'boat:1': { title: 'B' }, 'campaign:2': 'x', 'campaign:3': { title: '' } }), { 'product:881': { title: 'A' } });
  const [b] = normaliseBlocks([{ id: 's', type: 'campaigns', data: { selections: [p(881)], campaign_ids: [], overrides: { 'product:881': { button_text: 'Shop' } } } }]);
  assert.deepEqual(b.data.overrides, { 'product:881': { button_text: 'Shop' } });
  const [old] = normaliseBlocks([{ id: 's', type: 'campaigns', data: { campaign_ids: [12] } }]);
  assert.equal('overrides' in old.data, false, 'an older section has none');
});

test('PUT sends overrides only when there are some; a cleaned-up copy (never the url)', () => {
  assert.equal('overrides' in blocksToInput([block({})])[0].data, false);
  assert.equal('overrides' in blocksToInput([block({ overrides: { 'product:881': { title: '  ' } } })])[0].data, false);
  const sent = blocksToInput([block({ overrides: { 'product:881': { title: 'Shop this ', url: 'https://evil' } } })])[0].data;
  assert.deepEqual(sent, { selections: [p(881), c(12)], campaign_ids: [12], columns: 2, overrides: { 'product:881': { title: 'Shop this' } } });
});

test('typing a trailing space is not a change to save; a real edit is', () => {
  const saved = { ...emptyDraft(), blocks: [block({ overrides: { 'product:881': { title: 'Two' } } })] };
  const spaced = { ...saved, blocks: [block({ overrides: { 'product:881': { title: 'Two ' } } })] };
  assert.deepEqual(changedFields(saved, spaced), {});
  const edited = { ...saved, blocks: [block({ overrides: { 'product:881': { title: 'Two words' } } })] };
  assert.deepEqual(changedFields(saved, edited).blocks[0].data.overrides, { 'product:881': { title: 'Two words' } });
});

test('after a save: the server’s overrides are taken (it drops cards it dropped); what is being typed is kept', () => {
  const sent = { ...emptyDraft(), blocks: [block({ overrides: { 'product:881': { title: 'Two' }, 'campaign:12': { button_text: 'Go' } } })] };
  // The campaign stopped being shareable: the server drops it and its edit.
  const server = [{ id: 's', type: 'campaigns', data: { selections: [p(881)], campaign_ids: [], columns: 2, items: [item('product', 881)], overrides: { 'product:881': { title: 'Two' } } } }];
  const a = adoptCampaignSnapshots(sent, sent, server);
  assert.deepEqual(a.draft.blocks[0].data.overrides, { 'product:881': { title: 'Two' } });
  assert.deepEqual(a.saved.blocks[0].data.overrides, { 'product:881': { title: 'Two' } });
  assert.deepEqual(changedFields(a.saved, a.draft), {}, 'nothing more to save');
  // A trailing space typed while saving: the draft keeps it (the server's trimmed copy is the same edit).
  const typing = { ...sent, blocks: [block({ overrides: { 'product:881': { title: 'Two ' }, 'campaign:12': { button_text: 'Go' } } })] };
  const b = adoptCampaignSnapshots(typing, sent, server);
  assert.equal(b.draft.blocks[0].data.overrides['product:881'].title, 'Two ');
  // A new edit while saving: kept in the draft, saves next.
  const more = { ...sent, blocks: [block({ overrides: { 'product:881': { title: 'Two words' } } })] };
  const d = adoptCampaignSnapshots(more, sent, server);
  assert.equal(d.draft.blocks[0].data.overrides['product:881'].title, 'Two words');
  assert.equal(Object.keys(changedFields(d.saved, d.draft)).length, 1);
  // An API that doesn't answer with overrides yet: the section keeps its own (for the cards still picked), no loop.
  const older = [{ id: 's', type: 'campaigns', data: { selections: [p(881), c(12)], campaign_ids: [12], items: [item('product', 881), item('campaign', 12)] } }];
  const e = adoptCampaignSnapshots(sent, sent, normaliseBlocks(older));
  assert.deepEqual(e.draft.blocks[0].data.overrides, sent.blocks[0].data.overrides);
  assert.deepEqual(changedFields(e.saved, e.draft), {});
});

test('pruneOverrides: a card taken out in the picker loses its edits', () => {
  assert.deepEqual(pruneOverrides({ 'product:881': { title: 'A' }, 'campaign:12': { title: 'B' } }, [c(12)]), { 'campaign:12': { title: 'B' } });
  assert.deepEqual(pruneOverrides(undefined, [c(12)]), undefined);
});
