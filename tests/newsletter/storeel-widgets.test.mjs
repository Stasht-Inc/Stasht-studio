// Chris, 8 Nov 2026 (points 1, 2): the Storeel preview's "+" opens the campaign page's Add Widget chooser, widgets go
// where the "+" was (after a moment), the preview shows a saved campaign's widgets like the campaign page, and Add a
// Moment's "Campaigns (optional)" links existing campaigns (create: linked_memory_ids; saved: POST linked-memories).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_WIDGET_KINDS, addWidgetOptions } from '../../components/widgets/addWidgetOptions.ts';
import { widgetAnchorPostId, postIdsAfterCreate, widgetsByAnchor, previewWidgetsFrom, saveWidgetIntent, takeWidgetIntent, WIDGET_TOP, WIDGET_END } from '../../components/storeel/lib/storeelWidgets.ts';
import { campaignsFromMemoriesResponse, linkedCampaignsMessage, campaignPreviewMoments } from '../../components/storeel/lib/momentCampaigns.ts';
import { catalogGate, pickPayload } from '../../components/storeel/lib/momentPicks.ts';

const photo = (key, postId) => ({ kind: 'photo', key, ...(postId ? { postId } : {}), image: 'x', video: false, title: '', caption: '', location: '', date: '' });
const linked = (id) => ({ kind: 'campaign', key: `campaign-${id}`, sourceId: String(id), image: null, title: `C${id}`, meta: '1 photo' });

test('the chooser offers every campaign-page widget, in its order; DocuSign only when connected', () => {
  assert.deepEqual(addWidgetOptions({ docuSign: false }).map((o) => o.label),
    ['Moment', 'Call to Action', 'Share Request a Moment', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'AI Creator']);
  assert.deepEqual(addWidgetOptions({ docuSign: true }).map((o) => o.label).slice(-1), ['DocuSign']);
  const withShop = addWidgetOptions({ docuSign: true, shopifyProduct: true }).map((o) => o.label);
  assert.deepEqual(withShop.slice(-2), ['Shopify Product', 'DocuSign']);
  assert.equal(addWidgetOptions({ docuSign: false })[0].desc, 'Add a special moment');
  assert.equal(addWidgetOptions({ docuSign: false })[1].desc, 'Add a button with a link');
  for (const o of addWidgetOptions({ docuSign: true, shopifyProduct: true })) assert.ok(ADD_WIDGET_KINDS.includes(o.kind));
});

test('a widget goes after the moment of the tapped "+"; under the cover = top; after a linked campaign = the moment above it', () => {
  const shown = [photo('post-1', 1), linked(7), photo('post-2', 2), linked(8)];
  const of = (m) => (m.kind === 'photo' ? m.postId : undefined);
  assert.equal(widgetAnchorPostId(shown, null, of), null);
  assert.equal(widgetAnchorPostId(shown, 'post-2', of), 2);
  assert.equal(widgetAnchorPostId(shown, 'campaign-7', of), 1);
  assert.equal(widgetAnchorPostId(shown, 'campaign-8', of), 2);
  assert.equal(widgetAnchorPostId([linked(7), photo('post-1', 1)], 'campaign-7', of), null, 'no moment above: top');
  assert.equal(widgetAnchorPostId(shown, 'gone', of), 2, 'an unknown "+" (the card button): after the last moment');
  assert.equal(widgetAnchorPostId(shown, undefined, of), 2, 'the Moments card: at the end');
  assert.equal(widgetAnchorPostId([], undefined, of), null);
});

test('just created: each sent moment key gets its new id (ids rise in the order the API made them)', () => {
  const fresh = [photo('post-12', 12), photo('post-10', 10), linked(5), photo('post-11', 11)];
  const map = postIdsAfterCreate(['catalog-61', 'photo-a', 'photo-b'], fresh);
  assert.deepEqual([...map.entries()], [['catalog-61', 10], ['photo-a', 11], ['photo-b', 12]]);
  assert.equal(postIdsAfterCreate(['photo-a'], fresh).size, 0, 'counts differ: no guessing');
});

test("the preview shows a saved campaign's widgets after their moment, top ones first, unknown anchors last", () => {
  const moments = [photo('post-1', 1), photo('post-2', 2)];
  const widgets = [
    { id: 'a', type: 'quote', afterPostId: '2', order: 1, text: 'Q' },
    { id: 'b', type: 'html', afterPostId: null, order: 0, title: 'Top' },
    { id: 'c', type: 'cta', afterPostId: '2', order: 0, title: 'Book', buttonText: 'Book now' },
    { id: 'd', type: 'youtube', afterPostId: '99', order: 0, videoId: 'abc' },
  ];
  const by = widgetsByAnchor(moments, widgets);
  assert.deepEqual(by.get(WIDGET_TOP).map((w) => w.id), ['b']);
  assert.deepEqual(by.get('post-2').map((w) => w.id), ['c', 'a']);
  assert.deepEqual(by.get(WIDGET_END).map((w) => w.id), ['d']);
  assert.equal(by.get('post-1'), undefined);
});

test("the campaign page's widget lists become preview widgets; a product's auto \"View on website\" card is left to the product", () => {
  const list = previewWidgetsFrom({
    html: [{ id: '1', title: 'T', content: '<b>x</b>', afterPostId: '5', widget_order: 0 }],
    youtube: [{ id: '2', title: 'Y', url: 'u', videoId: 'vid', afterPostId: null, widget_order: 1 }],
    quote: [{ id: '3', text: 'Q', author: 'A', afterPostId: '5', widget_order: 2 }],
    cta: [
      { id: '4', title: 'Book', buttonText: 'Book now', buttonColor: '#111', textColor: '#fff', borderRadius: 8, mode: 'link', afterPostId: '5', widget_order: 3 },
      { id: '5', title: '$20', buttonText: 'View on website', afterPostId: '6', widget_order: 0, mode: 'link' },
    ],
    aiCreator: [{ id: '6', text: 'Hello', background: 'red', imageUrl: null, afterPostId: '5', widget_order: 4 }],
    product: [{ id: '7', title: 'Mug', price: '9.00', image: 'i', afterPostId: '5', widget_order: 5 }],
    productPostIds: ['6'],
  });
  assert.deepEqual(list.map((w) => `${w.type}:${w.id}`), ['html:1', 'youtube:2', 'quote:3', 'cta:4', 'ai_creator:6', 'product:7']);
  assert.equal(list.find((w) => w.id === '4').buttonText, 'Book now');
});

test('a create-mode widget is handed to the campaign page once, for that campaign only, and goes stale', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  saveWidgetIntent({ memoryId: 42, kind: 'cta', afterPostId: 7 }, storage, 1000);
  assert.equal(takeWidgetIntent(41, storage, 1000), null, 'another campaign leaves it');
  assert.deepEqual(takeWidgetIntent(42, storage, 2000), { memoryId: 42, kind: 'cta', afterPostId: 7 });
  assert.equal(takeWidgetIntent(42, storage, 2000), null, 'only once');
  saveWidgetIntent({ memoryId: 42, kind: 'html', afterPostId: null }, storage, 1000);
  assert.equal(takeWidgetIntent(42, storage, 1000 + 10 * 60 * 1000), null, 'stale after a few minutes');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
  assert.doesNotThrow(() => saveWidgetIntent({ memoryId: 1, kind: 'cta', afterPostId: null }, broken));
  assert.equal(takeWidgetIntent(1, broken), null);
});

test("Campaigns (optional): the account's campaigns from GET /memories, without the campaign itself", () => {
  const res = { success: true, data: { data: { all_memories: { data: [
    { id: 1, title: 'Fall', last_update_img: 'a.jpg', posts_count: 3, category: { name: 'Personal' } },
    { id: 2, title: '', cover_image: 'b.jpg', photos: { count: 1 } },
    { id: 3, title: 'Me' },
  ] } } } };
  assert.deepEqual(campaignsFromMemoriesResponse(res, 3), [
    { id: '1', title: 'Fall', image: 'a.jpg', count: 3 },
    { id: '2', title: 'Untitled campaign', image: 'b.jpg', count: 1 },
  ]);
  assert.deepEqual(campaignsFromMemoriesResponse({ success: false }, null), []);
  assert.deepEqual(campaignsFromMemoriesResponse({ success: true, data: { memories: [{ id: 9, title: 'X' }] } }, null).map((c) => c.id), ['9']);
});

test('linked campaigns show in the preview as campaign cards and are sent as linked_memory_ids with step 1 picks', () => {
  assert.deepEqual(campaignPreviewMoments([{ id: '1', title: 'Fall', image: 'a.jpg', count: 3 }]), [
    { kind: 'campaign', key: 'campaign-1', sourceId: '1', image: 'a.jpg', title: 'Fall', meta: '3 photos' },
  ]);
  assert.deepEqual(pickPayload({ pick: null, selectedIds: [], extraCatalog: [], extraCars: [], extraCampaigns: ['4', '5'] }), { linked_memory_ids: [4, 5] });
  assert.deepEqual(pickPayload({ pick: 'campaigns', selectedIds: ['3', '4'], extraCatalog: [], extraCars: [], extraCampaigns: ['4', '5'] }), { linked_memory_ids: [3, 4, 5] });
  assert.deepEqual(pickPayload({ pick: 'catalog', selectedIds: ['61'], extraCatalog: [], extraCars: [], extraCampaigns: ['5'] }), { catalog_item_ids: [61], linked_memory_ids: [5] });
  assert.deepEqual(pickPayload({ pick: null, selectedIds: [], extraCatalog: [], extraCars: [] }), {}, 'unchanged without campaigns');
});

test('the toast after linking campaigns to a saved campaign', () => {
  assert.equal(linkedCampaignsMessage(2, 0), '2 campaigns linked to your campaign.');
  assert.equal(linkedCampaignsMessage(1, 1), '1 campaign linked to your campaign. 1 was already in it.');
  assert.equal(linkedCampaignsMessage(0, 2), 'Those campaigns are already in this campaign.');
});

test('Products tab only when the account has products (no plan-note tab for an empty catalogue)', () => {
  assert.equal(catalogGate({ available: false, reason: 'plan_required', item_count: 0 }, false), 'hidden');
  assert.equal(catalogGate({ available: false, reason: 'plan_required', item_count: 12 }, false), 'upgrade');
  // Off the Business plan the API counts the website's items on its source, not item_count.
  assert.equal(catalogGate({ available: false, reason: 'plan_required', item_count: 0, source: { item_count: 12 } }, false), 'upgrade');
  assert.equal(catalogGate({ available: false, reason: 'plan_required', item_count: 0, source: { item_count: 0 } }, false), 'hidden');
  assert.equal(catalogGate({ available: true, reason: null, item_count: 0 }, true), 'hidden');
  assert.equal(catalogGate({ available: true, reason: null, item_count: 5 }, true), 'upgrade');
  assert.equal(catalogGate({ available: true, reason: null, item_count: 5 }, false), 'ready');
  assert.equal(catalogGate(null, false), 'hidden');
});
