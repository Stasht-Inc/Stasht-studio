// tests/utils/timelineAddSlots.test.mjs
// Chris, 9 Nov 2026 (point 5): the desktop campaign page's "+" (Add Widget) moved from the left timeline list to the
// right-hand timeline of cards: one under the "Timeline • N moments" header (the top) and one after every moment card,
// including the last. Each "+" inserts after that moment (after_post_id).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSlotAfter, applyInsertPlace, collaboratorAddWidgetOptions, slotWidgetRanks } from '../../utils/timelineAddSlots.ts';
import { addWidgetOptions } from '../../components/widgets/addWidgetOptions.ts';

const post = (id) => ({ type: 'post', id });
const linked = (id) => ({ type: 'linked', id: String(id) });

test('a "+" follows every moment card (its id, as a string); none follows a linked campaign', () => {
  assert.equal(addSlotAfter(post('11')), '11');
  assert.equal(addSlotAfter(post(42)), '42');
  assert.equal(addSlotAfter(linked(90)), undefined);
  assert.equal(addSlotAfter(post('')), undefined);
  assert.equal(addSlotAfter(post(null)), undefined);
  assert.equal(addSlotAfter(null), undefined);
});

test('the collaborator view offers what its own left "+" offered: no Share Request a Moment, no AI Creator', () => {
  const owner = addWidgetOptions({ docuSign: false });
  assert.deepEqual(collaboratorAddWidgetOptions(owner).map((o) => o.label),
    ['Moment', 'Call to Action', 'Voice to Text', 'HTML', 'Youtube', 'Quote']);
  // With Shopify Product (Deepak, 10 Nov 2026: the desktop "+" offers it like the phone's), it stays.
  assert.deepEqual(collaboratorAddWidgetOptions(addWidgetOptions({ docuSign: false, shopifyProduct: true })).map((o) => o.label),
    ['Moment', 'Call to Action', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'Shopify Product']);
  const withDocuSign = addWidgetOptions({ docuSign: true, docuSignFeature: true });
  assert.deepEqual(collaboratorAddWidgetOptions(withDocuSign).map((o) => o.kind).slice(-1), ['docusign']);
});

// Chris, 12 Nov 2026: a "+" after every widget card too.
const W = (id, type, afterPostId, widget_order) => ({ id, type, afterPostId, widget_order });

test('slot ranks: each slot on its own, by widget_order then the older id, across widget types', () => {
  const ranks = slotWidgetRanks([
    W('5', 'quote', null, 0), W('3', 'html', '11', 1), W('4', 'cta', '11', 0), W('9', 'youtube', '11', 1), W('2', 'html', null, 0),
  ]);
  assert.deepEqual(Object.fromEntries(ranks), { '2': 0, '5': 1, '4': 0, '3': 1, '9': 2 });
});

test('insert after a saved widget sends after_widget_id; only for that same slot', () => {
  const widgets = [W('7', 'quote', null, 0)];
  const body = { widget_type: 'html', after_post_id: null, widget_order: 1 };
  assert.deepEqual(applyInsertPlace(body, { afterWidgetId: '7', afterPostId: null }, widgets),
    { body: { ...body, after_widget_id: 7 }, placed: true });
  // Another slot (stale place) or an unsaved widget: unchanged.
  assert.deepEqual(applyInsertPlace({ ...body, after_post_id: '11' }, { afterWidgetId: '7', afterPostId: null }, widgets).placed, false);
  assert.deepEqual(applyInsertPlace(body, { afterWidgetId: 'html_123', afterPostId: null }, widgets).placed, false);
  assert.deepEqual(applyInsertPlace(body, null, widgets), { body, placed: false });
});

test('the "+" under a moment (or the header) puts the new widget first in its slot', () => {
  const widgets = [W('7', 'quote', '11', 2), W('8', 'cta', '11', 0), W('9', 'html', null, 0)];
  const body = { widget_type: 'html', after_post_id: '11', widget_order: 3 };
  assert.deepEqual(applyInsertPlace(body, { atStart: true, afterPostId: '11' }, widgets),
    { body: { ...body, widget_order: -1 }, placed: true });
  // An empty slot: nothing to go before, unchanged.
  assert.equal(applyInsertPlace({ ...body, after_post_id: '12' }, { atStart: true, afterPostId: '12' }, widgets).placed, false);
});
