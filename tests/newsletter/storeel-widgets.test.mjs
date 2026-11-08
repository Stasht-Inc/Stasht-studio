// Chris, 8 Nov 2026 (points 1, 2): the Storeel preview's "+" opens the campaign page's Add Widget chooser, widgets go
// where the "+" was (after a moment), the preview shows a saved campaign's widgets like the campaign page, and Add a
// Moment's "Campaigns (optional)" links existing campaigns (create: linked_memory_ids; saved: POST linked-memories).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADD_WIDGET_KINDS, addWidgetOptions } from '../../components/widgets/addWidgetOptions.ts';
import { widgetAnchorPostId, postIdsAfterCreate, widgetsByAnchor, previewWidgetsFrom, previewCardButtons, saveWidgetIntent, takeWidgetIntent, WIDGET_TOP, WIDGET_END, WIDGET_PINNED } from '../../components/storeel/lib/storeelWidgets.ts';
import { campaignsFromMemoriesResponse, linkedCampaignsMessage, campaignPreviewMoments, campaignsQuery, campaignsLastPage } from '../../components/storeel/lib/momentCampaigns.ts';
import { catalogGate, pickPayload } from '../../components/storeel/lib/momentPicks.ts';

const photo = (key, postId) => ({ kind: 'photo', key, ...(postId ? { postId } : {}), image: 'x', video: false, title: '', caption: '', location: '', date: '' });
const linked = (id) => ({ kind: 'campaign', key: `campaign-${id}`, sourceId: String(id), image: null, title: `C${id}`, meta: '1 photo' });

test('the chooser offers every campaign-page widget, in its order; DocuSign only when connected and the feature is on', () => {
  assert.deepEqual(addWidgetOptions({ docuSign: false }).map((o) => o.label),
    ['Moment', 'Call to Action', 'Share Request a Moment', 'Voice to Text', 'HTML', 'Youtube', 'Quote', 'AI Creator']);
  // DocuSign hidden everywhere (Deepak, 8 Nov 2026; FEATURES.docusign off): connected or not, never offered.
  assert.ok(!addWidgetOptions({ docuSign: true }).some((o) => o.kind === 'docusign'));
  assert.ok(!addWidgetOptions({ docuSign: true, shopifyProduct: true }).some((o) => o.kind === 'docusign'));
  // Feature back on: DocuSign when connected, last.
  assert.deepEqual(addWidgetOptions({ docuSign: true, docuSignFeature: true }).map((o) => o.label).slice(-1), ['DocuSign']);
  assert.ok(!addWidgetOptions({ docuSign: false, docuSignFeature: true }).some((o) => o.kind === 'docusign'));
  const withShop = addWidgetOptions({ docuSign: true, shopifyProduct: true, docuSignFeature: true }).map((o) => o.label);
  assert.deepEqual(withShop.slice(-2), ['Shopify Product', 'DocuSign']);
  assert.equal(addWidgetOptions({ docuSign: false })[0].desc, 'Add a special moment');
  assert.equal(addWidgetOptions({ docuSign: false })[1].desc, 'Add a button with a link');
  for (const o of addWidgetOptions({ docuSign: true, shopifyProduct: true, docuSignFeature: true })) assert.ok(ADD_WIDGET_KINDS.includes(o.kind));
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

test("the preview groups a moment's widgets like the campaign page; top ones first, unknown anchors last, pinned after all", () => {
  const moments = [photo('post-1', 1), photo('post-2', 2)];
  const widgets = [
    { id: 'a', type: 'quote', afterPostId: '2', order: 1, text: 'Q' },
    { id: 'b', type: 'html', afterPostId: null, order: 0, title: 'Top' },
    { id: 'c', type: 'cta', afterPostId: '2', order: 0, title: 'Book', buttonText: 'Book now' },
    { id: 'e', type: 'html', afterPostId: '2', order: 2, content: 'x' },
    { id: 'f', type: 'cta', afterPostId: '1', order: 0, buttonText: 'Share a Moment', mode: 'request_moment', pinned: true },
    { id: 'd', type: 'youtube', afterPostId: '99', order: 0, videoId: 'abc' },
  ];
  const by = widgetsByAnchor(moments, widgets);
  assert.deepEqual(by.get(WIDGET_TOP).map((w) => w.id), ['b']);
  // Added CTA, then Quote, then HTML: the campaign page shows HTML, Quote, CTA.
  assert.deepEqual(by.get('post-2').map((w) => w.id), ['e', 'a', 'c']);
  assert.deepEqual(by.get(WIDGET_END).map((w) => w.id), ['d']);
  assert.deepEqual(by.get(WIDGET_PINNED).map((w) => w.id), ['f']);
  assert.equal(by.get('post-1'), undefined);
});

test("the campaign page's widget lists become preview widgets; a product's in-card button (in_card) goes inside its card", () => {
  const cta = [
    { id: '4', title: 'Book', buttonText: 'Book now', buttonColor: '#111', textColor: '#fff', borderRadius: 8, mode: 'link', afterPostId: '5', widget_order: 3 },
    // An owner-made CTA that happens to say "View on website" stays a card (review M2: never filtered by its text).
    { id: '8', title: 'Shop', buttonText: 'View on website', afterPostId: '5', widget_order: 4, mode: 'link' },
    { id: '5', title: '$20', buttonText: 'View on website', afterPostId: '6', widget_order: 0, mode: 'link', inCard: true },
    { id: '9', title: '', buttonText: 'Share a Moment', afterPostId: '5', widget_order: 5, mode: 'request_moment', pinToBottom: true },
  ];
  const list = previewWidgetsFrom({
    html: [{ id: '1', title: 'T', content: '<b>x</b>', afterPostId: '5', widget_order: 0 }],
    youtube: [{ id: '2', title: 'Y', url: 'u', videoId: 'vid', afterPostId: null, widget_order: 1 }],
    quote: [{ id: '3', text: 'Q', author: 'A', afterPostId: '5', widget_order: 2 }],
    cta,
    aiCreator: [{ id: '6', text: '<span style="color: red">Hello</span>', background: 'red', imageUrl: null, isDark: null, afterPostId: '5', widget_order: 4 }],
    product: [{ id: '7', title: 'Mug', price: '9.00', image: 'i', afterPostId: '5', widget_order: 5 }],
  });
  assert.deepEqual(list.map((w) => `${w.type}:${w.id}`), ['html:1', 'youtube:2', 'quote:3', 'cta:4', 'cta:8', 'cta:9', 'ai_creator:6', 'product:7']);
  assert.equal(list.find((w) => w.id === '4').buttonText, 'Book now');
  assert.equal(list.find((w) => w.id === '9').pinned, true);
  assert.deepEqual([...previewCardButtons(cta).entries()].map(([k, v]) => [k, v.buttonText]), [['6', 'View on website']]);
});

test('the preview splits in-card buttons exactly as the campaign page (productButtonsByPost): a second marked button on the same moment stays a card', () => {
  const cta = [
    { id: '5', title: '$20', buttonText: 'View on website', afterPostId: '6', widget_order: 0, mode: 'link', inCard: true },
    { id: '15', title: '$20', buttonText: 'Buy it', afterPostId: '6', widget_order: 1, mode: 'link', inCard: true },
    { id: '16', title: '', buttonText: 'Top', afterPostId: null, widget_order: 0, mode: 'link', inCard: true },
  ];
  const list = previewWidgetsFrom({ cta });
  assert.deepEqual(list.map((w) => `${w.type}:${w.id}`), ['cta:15', 'cta:16'], 'only the first per moment goes in the card; nothing dropped');
  assert.deepEqual([...previewCardButtons(cta).entries()].map(([k, v]) => [k, v.buttonText]), [['6', 'View on website']]);
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

test('Campaigns (optional) lists only campaigns the account can link: pending invites (is_invite) are left out', () => {
  // GET /memories merges the account's pending invites into all_memories (is_invite: true, invite_id); linking one of
  // those is refused by the web API (422 "do not belong to you"), so they are never offered.
  const res = { success: true, data: { all_memories: { data: [
    { id: 1, title: 'Mine', posts_count: 2 },
    { id: 4, title: 'Invited A', is_invite: true, invite_id: 77 },
    { id: 5, title: 'Invited B', is_invite: 1 },
    { id: 6, title: 'Invited C', invite_id: 78 },
    { id: 7, title: 'Mine too', is_invite: false },
  ] } } };
  assert.deepEqual(campaignsFromMemoriesResponse(res, null).map((c) => c.id), ['1', '7']);
});

test('Campaigns (optional) asks the server: search, page by page (all of an account\'s campaigns, not the first 50)', () => {
  assert.equal(campaignsQuery({ search: '', page: 1 }), '/memories?per_page=50&page=1');
  assert.equal(campaignsQuery({ search: ' Fall open ', page: 3 }), '/memories?per_page=50&page=3&search=Fall%20open');
  assert.equal(campaignsLastPage({ data: { all_memories: { data: [], pagination: { last_page: 3 } } } }), 3);
  assert.equal(campaignsLastPage({ success: true, data: { data: { all_memories: { pagination: { last_page: '2' } } } } }), 2);
  assert.equal(campaignsLastPage({}), 1);
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
  // Review M3: on the Business plan only what can be listed (item_count) counts — no empty Products tab.
  assert.equal(catalogGate({ available: true, reason: null, item_count: 0, source: { item_count: 7 } }, false), 'hidden');
});
