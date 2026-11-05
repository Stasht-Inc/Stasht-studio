// Storeel flow v2 (Deepak, 4 Nov 2026): the live preview shows every moment Create Campaign will make — each picked
// Website Catalogue product, vehicle, Shopify collection or linked campaign, and each uploaded photo or video — in
// the order the web API creates them, with the right "N moments" count. Edit shows the campaign's own moments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewMoments, savedPreviewMoments, vehiclePrice, vehicleTags } from '../../components/storeel/lib/previewMoments.ts';

const TODAY = '2026-11-04';
const product = (id, extra = {}) => ({ id, title: `Product ${id}`, price_label: '599 INR', last_update_img: `https://cdn.test/p${id}.jpg`, posts_count: 1, url: `https://shop.test/p/${id}`, ...extra });

test('nothing picked and nothing uploaded: no moments', () => {
  assert.deepEqual(createPreviewMoments({ pick: null, picked: [], selectedIds: [], photos: [], location: '', today: TODAY }), []);
});

test('a picked catalogue product is a product moment: its photo, title, price and the "View on website" button', () => {
  const moments = createPreviewMoments({ pick: 'catalog', picked: [product(61), product(62)], selectedIds: ['62'], photos: [], location: 'Kharar Tahsil, India', today: TODAY });
  assert.deepEqual(moments, [{
    kind: 'product', key: 'catalog-62', sourceId: '62', image: 'https://cdn.test/p62.jpg', title: 'Product 62', price: '599 INR', cta: true, location: 'Kharar Tahsil, India', date: TODAY,
  }]);
});

test('catalogue products keep the order they were picked in (the API makes them in the order sent)', () => {
  const moments = createPreviewMoments({ pick: 'catalog', picked: [product(61), product(62), product(63)], selectedIds: ['63', '61'], photos: [], location: '', today: TODAY });
  assert.deepEqual(moments.map((m) => m.key), ['catalog-63', 'catalog-61']);
});

test('a product with no price or no page on the website: the button card shows the title, or no button at all', () => {
  const [noPrice, noPage] = createPreviewMoments({
    pick: 'catalog', picked: [product(1, { price_label: '' }), product(2, { url: null })], selectedIds: ['1', '2'], photos: [], location: '', today: TODAY,
  });
  assert.equal(noPrice.price, '');
  assert.equal(noPrice.cta, true);
  assert.equal(noPage.cta, false);
});

test('a product with no photo at all makes no moment (the API skips it)', () => {
  const moments = createPreviewMoments({
    pick: 'catalog', picked: [product(1, { last_update_img: '', posts_count: 0 }), product(2, { last_update_img: '', posts_count: 3 })], selectedIds: ['1', '2'], photos: [], location: '', today: TODAY,
  });
  assert.deepEqual(moments.map((m) => m.key), ['catalog-2'], 'no main photo but other photos: still a moment');
});

test('a picked vehicle is a vehicle moment, as car moments show on the campaign page: photo, title, price, mileage and stock', () => {
  const [car] = createPreviewMoments({
    pick: 'cars', picked: [{ id: 5, title: '2024 Jeep Wrangler', last_update_img: 'https://cdn.test/car.jpg', price: '34995', mileage: 45000, stock_number: 'S2300' }],
    selectedIds: ['5'], photos: [], location: '', today: TODAY,
  });
  assert.deepEqual(car, { kind: 'vehicle', key: 'car-5', sourceId: '5', image: 'https://cdn.test/car.jpg', title: '2024 Jeep Wrangler', price: '$34,995', tags: ['45,000 mi', 'Stock #S2300'] });
  assert.equal(vehiclePrice({ price: null }), '');
  assert.deepEqual(vehicleTags({}), []);
});

test('a Shopify collection or an existing campaign picked to link is a campaign card', () => {
  const [col] = createPreviewMoments({ pick: 'shopify', picked: [{ id: 'gid-1', title: 'Summer', last_update_img: 'https://cdn.test/c.jpg', posts_count: 12 }], selectedIds: ['gid-1'], photos: [], location: '', today: TODAY });
  assert.deepEqual(col, { kind: 'campaign', key: 'shopify-gid-1', sourceId: 'gid-1', image: 'https://cdn.test/c.jpg', title: 'Summer', meta: '12 products' });
  const [linked] = createPreviewMoments({ pick: 'campaigns', picked: [{ id: 9, title: 'Fall event', image_link: 'https://cdn.test/f.jpg', posts_count: 1 }], selectedIds: ['9'], photos: [], location: '', today: TODAY });
  assert.deepEqual(linked, { kind: 'campaign', key: 'campaign-9', sourceId: '9', image: 'https://cdn.test/f.jpg', title: 'Fall event', meta: '1 photo' });
});

test('a vehicle linked from "All Categories" in a regular campaign shows as a vehicle', () => {
  const moments = createPreviewMoments({
    pick: 'campaigns', picked: [{ id: 9, title: 'Fall event', posts_count: 2 }, { id: 5, kind: 'cars', title: 'Jeep', price: 1000 }], selectedIds: ['5', '9'], photos: [], location: '', today: TODAY,
  });
  assert.deepEqual(moments.map((m) => m.kind), ['vehicle', 'campaign']);
});

test('uploaded photos and videos are photo moments with their own title, place and date (today when none)', () => {
  const moments = createPreviewMoments({
    pick: null, picked: [], selectedIds: [], location: 'Toronto, ON', today: TODAY,
    photos: [
      { fileUrl: 'https://s3.test/a.jpg', title: 'Front door', description: 'Solid oak', location: 'Brampton, ON', capture_date: '2026-10-01' },
      { fileUrl: 'https://s3.test/clip.MP4', title: '', description: 'Walkthrough', location: '', capture_date: '' },
      { fileUrl: '', title: 'not uploaded yet' },
    ],
  });
  assert.deepEqual(moments, [
    { kind: 'photo', key: 'photo-0', index: 0, image: 'https://s3.test/a.jpg', video: false, title: 'Front door', caption: 'Solid oak', location: 'Brampton, ON', date: '2026-10-01' },
    { kind: 'photo', key: 'photo-1', index: 1, image: 'https://s3.test/clip.MP4', video: true, title: '', caption: 'Walkthrough', location: '', date: TODAY },
  ], 'a photo with no uploaded link is not sent, so it is not a moment');
});

test('a photo keeps its own key when an earlier one is removed (an open caption editor stays on it)', () => {
  const photos = [{ id: 'u1', fileUrl: 'https://s3.test/a.jpg' }, { id: 'u2', fileUrl: 'https://s3.test/b.jpg' }];
  const before = createPreviewMoments({ pick: null, picked: [], selectedIds: [], photos, location: '', today: TODAY });
  const after = createPreviewMoments({ pick: null, picked: [], selectedIds: [], photos: photos.slice(1), location: '', today: TODAY });
  assert.equal(before[1].key, 'photo-u2');
  assert.equal(after[0].key, 'photo-u2');
  assert.equal(after[0].index, 0, 'its place in the list moved, its key did not');
});

test('a catalogue product and an uploaded photo: two moments, picked items first (the order the API creates them)', () => {
  const moments = createPreviewMoments({
    pick: 'catalog', picked: [product(61)], selectedIds: ['61'], location: '', today: TODAY,
    photos: [{ fileUrl: 'https://s3.test/a.jpg', title: '', capture_date: '2026-11-04' }],
  });
  assert.deepEqual(moments.map((m) => m.kind), ['product', 'photo']);
});

test('ids picked from another source (the category changed) are left out', () => {
  assert.deepEqual(createPreviewMoments({ pick: 'catalog', picked: [product(61)], selectedIds: ['5'], photos: [], location: '', today: TODAY }), []);
});

// Edit: the campaign page's data (GET /memories/{id}): linked campaigns / vehicles first, then its moments.
test('Edit: the campaign\'s own moments — linked vehicles and campaigns, then its top-level photos (not sub-photos)', () => {
  const moments = savedPreviewMoments({
    linked_memories: [{ id: 5, is_car: 1, title: '2024 Jeep Wrangler', cover_image: 'https://cdn.test/car.jpg', price: 34995, mileage: '45000', stock_number: 'S1' }, { id: 9, title: 'Fall event', last_update_img: 'https://cdn.test/f.jpg', posts_count: 3 }],
    posts: [
      { id: 1, parent_id: null, image_link: 'https://cdn.test/1.jpg', title: 'Handmade dress', description: 'Purple\nPrice: 599 INR', location: 'Kharar', capture_date: '2026-11-04 00:00:00' },
      { id: 2, parent_id: 1, image_link: 'https://cdn.test/2.jpg' },
      { id: 3, parent_id: null, image_link: 'https://cdn.test/3.mov', title: null, description: 'Tour', location: null, capture_date: null },
    ],
  });
  assert.deepEqual(moments, [
    { kind: 'vehicle', key: 'car-5', sourceId: '5', image: 'https://cdn.test/car.jpg', title: '2024 Jeep Wrangler', price: '$34,995', tags: ['45,000 mi', 'Stock #S1'] },
    { kind: 'campaign', key: 'campaign-9', sourceId: '9', image: 'https://cdn.test/f.jpg', title: 'Fall event', meta: '3 photos' },
    { kind: 'photo', key: 'post-1', postId: 1, image: 'https://cdn.test/1.jpg', video: false, title: 'Handmade dress', caption: 'Purple\nPrice: 599 INR', location: 'Kharar', date: '2026-11-04' },
    { kind: 'photo', key: 'post-3', postId: 3, image: 'https://cdn.test/3.mov', video: true, title: '', caption: 'Tour', location: '', date: '' },
  ]);
});

test('Edit follows the campaign\'s own order when it has one (unified_order)', () => {
  const moments = savedPreviewMoments({
    linked_memories: [{ id: 5, is_car: 1, title: 'Car' }],
    posts: [{ id: 1, parent_id: null, image_link: 'https://cdn.test/1.jpg' }],
    unified_order: [{ type: 'post', id: 1 }, { type: 'linked_memory', id: 5 }],
  });
  assert.deepEqual(moments.map((m) => m.key), ['post-1', 'car-5']);
  assert.deepEqual(savedPreviewMoments(null), []);
  assert.deepEqual(savedPreviewMoments({}), []);
});
