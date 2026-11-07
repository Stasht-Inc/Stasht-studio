// Chris, 7 Nov 2026 (points 6, 7): the Storeel preview's "+" inserts a moment at a place, its ⋮ moves / deletes it,
// and Add a Moment adds catalogue products and vehicles. The order lives in Studio until Save as Draft (create), or
// on the campaign (edit). Vehicles and Shopify collections have no place in the campaign's order: they stay last.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOrderable, orderMoments, insertKeysAfter, moveKey, needsServerOrder, serverOrderAfterCreate, savedOrderPayload, momentMenu, savedRef, apiDefaultOrder, sentPostKeys,
} from '../../components/storeel/lib/momentOrder.ts';
import { pickPayload, catalogGate, pickedPreviewMoments } from '../../components/storeel/lib/momentPicks.ts';

const photo = (id) => ({ kind: 'photo', key: `photo-${id}`, index: id, image: `https://cdn.test/${id}.jpg`, video: false, title: '', caption: '', location: '', date: '' });
const product = (id) => ({ kind: 'product', key: `catalog-${id}`, sourceId: String(id), image: 'x', title: `P${id}`, price: '', cta: true, location: '', date: '' });
const car = (id) => ({ kind: 'vehicle', key: `car-${id}`, sourceId: String(id), image: 'x', title: `Car ${id}`, price: '', tags: [] });
const linked = (id) => ({ kind: 'campaign', key: `campaign-${id}`, sourceId: String(id), image: 'x', title: `C${id}`, meta: '' });
const shopify = (id) => ({ kind: 'campaign', key: `shopify-${id}`, sourceId: String(id), image: 'x', title: `S${id}`, meta: '' });
const keys = (list) => list.map((m) => m.key);

test('photos, products and linked campaigns have a place; vehicles and Shopify collections do not', () => {
  assert.equal(isOrderable(photo(1)), true);
  assert.equal(isOrderable(product(1)), true);
  assert.equal(isOrderable(linked(1)), true);
  assert.equal(isOrderable(car(1)), false);
  assert.equal(isOrderable(shopify(1)), false);
});

test('no order yet: the default order, with vehicles / collections last', () => {
  assert.deepEqual(keys(orderMoments([car(9), product(1), photo(0), shopify(4)], [])), ['catalog-1', 'photo-0', 'car-9', 'shopify-4']);
});

test('an order: listed keys first in that order, new ones after them, gone ones dropped', () => {
  const moments = [product(1), photo(0), photo(1), linked(5)];
  assert.deepEqual(keys(orderMoments(moments, ['photo-1', 'gone-3', 'catalog-1'])), ['photo-1', 'catalog-1', 'photo-0', 'campaign-5']);
});

test('insert after a moment, at the start (the + under the cover), or after a fixed card (end of the places)', () => {
  const shown = ['a', 'b', 'c'];
  assert.deepEqual(insertKeysAfter(shown, 'a', ['x', 'y']), ['a', 'x', 'y', 'b', 'c']);
  assert.deepEqual(insertKeysAfter(shown, null, ['x']), ['x', 'a', 'b', 'c']);
  assert.deepEqual(insertKeysAfter(shown, 'car-9', ['x']), ['a', 'b', 'c', 'x']);
  assert.deepEqual(insertKeysAfter(shown, 'c', ['x']), ['a', 'b', 'c', 'x']);
  assert.deepEqual(insertKeysAfter(['a', 'x'], 'a', ['x']), ['a', 'x'], 'a key already there is not doubled');
});

test('move up / down swaps with the neighbour; nothing past the ends', () => {
  assert.deepEqual(moveKey(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c']);
  assert.deepEqual(moveKey(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b']);
  assert.deepEqual(moveKey(['a', 'b', 'c'], 'a', 'up'), ['a', 'b', 'c']);
  assert.deepEqual(moveKey(['a', 'b', 'c'], 'c', 'down'), ['a', 'b', 'c']);
});

test("the order is sent after create only when it differs from the API's own (products, photos, then links)", () => {
  const def = [product(1), photo(0), linked(5)];
  assert.equal(needsServerOrder(orderMoments(def, []), def), false);
  assert.equal(needsServerOrder(orderMoments(def, ['photo-0']), def), true);
});

test('after create: the new campaign\'s moments matched to the form\'s (products then photos as sent, links by id)', () => {
  const shown = [photo(1), product(7), linked(5), photo(0), car(3)];
  const fresh = [
    { kind: 'photo', key: 'post-101', postId: 101 }, // product 7's moment (products are made first)
    { kind: 'photo', key: 'post-102', postId: 102 }, // photo 0
    { kind: 'photo', key: 'post-103', postId: 103 }, // photo 1
    { kind: 'campaign', key: 'campaign-5', sourceId: '5' },
    { kind: 'vehicle', key: 'car-3', sourceId: '3' },
  ];
  assert.deepEqual(serverOrderAfterCreate(shown, ['catalog-7', 'photo-0', 'photo-1'], fresh), [
    { type: 'post', id: 103 }, { type: 'post', id: 101 }, { type: 'linked_memory', id: 5 }, { type: 'post', id: 102 },
  ]);
  // A product the API skipped (no usable photo): the counts differ, so no guessing.
  assert.equal(serverOrderAfterCreate(shown, ['catalog-7', 'photo-0', 'photo-1'], fresh.slice(1)), null);
});

test("a saved campaign's order payload and each moment's API reference", () => {
  const shown = [{ kind: 'photo', key: 'post-5', postId: 5 }, linked(8), car(2)];
  assert.deepEqual(savedOrderPayload(shown), [{ type: 'post', id: 5 }, { type: 'linked_memory', id: 8 }]);
  assert.deepEqual(savedRef(shown[0]), { type: 'post', id: 5 });
  assert.deepEqual(savedRef(shown[1]), { type: 'linked_memory', id: 8 });
  assert.deepEqual(savedRef(shown[2]), { type: 'car', id: 2 });
});

test('the ⋮ menu: Edit for photos (and saved moments), Move only between places, Delete always (create)', () => {
  const shown = [product(1), photo(0), car(3)];
  assert.deepEqual(momentMenu(shown, 0, { saved: false }), { edit: false, up: false, down: true, remove: true });
  assert.deepEqual(momentMenu(shown, 1, { saved: false }), { edit: true, up: true, down: false, remove: true });
  assert.deepEqual(momentMenu(shown, 2, { saved: false }), { edit: false, up: false, down: false, remove: true });
  const saved = [{ kind: 'photo', key: 'post-1', postId: 1 }, { kind: 'photo', key: 'post-2', postId: 2 }, car(3)];
  assert.deepEqual(momentMenu(saved, 0, { saved: true }), { edit: true, up: false, down: true, remove: true });
  assert.deepEqual(momentMenu(saved, 2, { saved: true }), { edit: false, up: false, down: false, remove: true });
});

test('what Save as Draft sends for the picks: step 1 by category, Add a Moment products / vehicles beside them', () => {
  assert.deepEqual(pickPayload({ pick: 'catalog', selectedIds: ['1', '2'], extraCatalog: ['2', '3'], extraCars: ['9'] }),
    { catalog_item_ids: [1, 2, 3], linked_memory_ids: [9] });
  assert.deepEqual(pickPayload({ pick: 'cars', selectedIds: ['4'], extraCatalog: ['3'], extraCars: ['4', '5'] }),
    { car_ids: ['4', '5'], catalog_item_ids: [3] });
  assert.deepEqual(pickPayload({ pick: 'shopify', selectedIds: ['gid1'], extraCatalog: [], extraCars: ['5'] }),
    { shopify_collection_ids: ['gid1'], linked_memory_ids: [5] });
  assert.deepEqual(pickPayload({ pick: 'campaigns', selectedIds: ['12'], extraCatalog: ['3'], extraCars: ['5'] }),
    { linked_memory_ids: [12, 5], catalog_item_ids: [3] });
  assert.deepEqual(pickPayload({ pick: null, selectedIds: [], extraCatalog: [], extraCars: [] }), {});
});

test('the Products choice: hidden outside the pilot or with no products, the plan note off the Business plan', () => {
  assert.equal(catalogGate(null, false), 'hidden');
  assert.equal(catalogGate({ available: false, reason: 'not_available', item_count: 0 }, false), 'hidden');
  assert.equal(catalogGate({ available: false, reason: 'plan_required', item_count: 40 }, false), 'upgrade');
  assert.equal(catalogGate({ available: true, reason: null, item_count: 40 }, true), 'upgrade');
  assert.equal(catalogGate({ available: true, reason: null, item_count: 0 }, false), 'hidden');
  assert.equal(catalogGate({ available: true, reason: null, item_count: 40 }, false), 'ready');
});

test('Add a Moment picks shown as moments: products with their View on website card, vehicles as vehicle cards', () => {
  const [p] = pickedPreviewMoments('catalog', [{ id: 7, title: 'Oak Table', main_image: 'https://cdn.test/7.jpg', price_label: '$1,299 CAD', url: 'https://shop.test/7', images_count: 3 }], 'Toronto', '2026-11-07');
  assert.deepEqual(p, { kind: 'product', key: 'catalog-7', sourceId: '7', image: 'https://cdn.test/7.jpg', title: 'Oak Table', price: '$1,299 CAD', cta: true, location: 'Toronto', date: '2026-11-07' });
  const [v] = pickedPreviewMoments('cars', [{ id: 3, title: '2021 Jeep', main_image: 'https://cdn.test/3.jpg', price: '24995', mileage: 45000, stock_number: 'S1' }], '', '2026-11-07');
  assert.deepEqual(v, { kind: 'vehicle', key: 'car-3', sourceId: '3', image: 'https://cdn.test/3.jpg', title: '2021 Jeep', price: '$24,995', tags: ['45,000 mi', 'Stock #S1'] });
});

test("the API's own order for a new campaign: products, then photos, then linked campaigns; vehicles / collections last", () => {
  const list = [linked(5), photo(0), product(1), car(3), photo(1), product(2), shopify(4)];
  assert.deepEqual(keys(apiDefaultOrder(list)), ['catalog-1', 'catalog-2', 'photo-0', 'photo-1', 'campaign-5', 'car-3', 'shopify-4']);
  assert.deepEqual(sentPostKeys(list), ['catalog-1', 'catalog-2', 'photo-0', 'photo-1']);
});

test("a saved campaign's moments follow GET /memories/{id}'s unified_order and linked_memories (siblings of memory)", async () => {
  const { seedFromMemory } = await import('../../components/storeel/lib/storeelFlow.ts');
  const res = { success: true, data: { status: 'success', data: {
    memory: { id: 9, title: 'Mill', posts: [{ id: 1, parent_id: null, image_link: 'a' }, { id: 2, parent_id: null, image_link: 'b' }] },
    linked_memories: [{ id: 40, title: 'Linked', posts_count: 2 }],
    unified_order: [{ type: 'post', id: 2 }, { type: 'linked_memory', id: 40 }, { type: 'post', id: 1 }],
  } } };
  assert.deepEqual(seedFromMemory(res).previewMoments.map((m) => m.key), ['post-2', 'campaign-40', 'post-1']);
});
