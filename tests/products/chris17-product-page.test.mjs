// tests/products/chris17-product-page.test.mjs — Chris 17 Nov 2026 (workstream D): a product opens the Serpa-style page
// (MemoryDetailsPage `product:<id>`). These are the pure helpers that turn a product into that page's header and details.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_PAGE_MARKER, SHOPIFY_SYNC_NOTE, WEBSITE_SYNC_NOTE, productPageDescription, productPageId, productPageIdOf, productPageLinks, productPageNotes,
  productPagePhotos, productPagePills, productPageSpecs, productPhotosShown, productSpecSummary,
} from '../../utils/products.ts';

const detail = (over = {}) => ({
  id: 601, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'Walnut Chair',
  price: '450.00', compare_at_price: null, currency: 'CAD', price_label: '$450 CAD', compare_at_label: '', price_on_request: false, show_price: true,
  main_image: 'https://x.test/1.jpg', images_count: 1, category: null, categories: [], sku: 'SKU-601', brand: null, url: null, updated_at: null,
  short_description: null, description: null, description_html: null, product_type: null, barcode: null, quantity: null, availability: 'available',
  options: [], variants: [], attributes: [], weight: null, weight_unit: null, dimensions: null, tags: [], collections: [],
  seo: { slug: null, title: null, description: null, share_image: null }, buy_url: null, show_enquire: true, media: [], editable_fields: [],
  ...over,
});

test('the page marker round-trips; anything else is not a product page', () => {
  assert.equal(PRODUCT_PAGE_MARKER, 'product:');
  assert.equal(productPageId(601), 'product:601');
  assert.equal(productPageIdOf('product:601'), 601);
  for (const other of ['601', 'catalog_item:601', 'cars_detail:5', 'shopify_product:9', 'product:', 'product:abc', 'product:-1', null, undefined, 601]) {
    assert.equal(productPageIdOf(other), null, String(other));
  }
});

test('"Show photos" off hides every photo; missing (older web API) shows them; videos are never page photos', () => {
  const media = [{ id: 2, url: 'b.jpg', type: 'photo', sort_order: 1 }, { id: 3, url: 'v.mp4', type: 'video', sort_order: 0 }, { id: 1, url: 'a.jpg', type: 'photo', sort_order: 0 }];
  assert.deepEqual(productPagePhotos(detail({ media })), [{ id: 1, url: 'a.jpg' }, { id: 2, url: 'b.jpg' }]);
  assert.deepEqual(productPagePhotos(detail({ media, show_photos: false })), []);
  assert.deepEqual(productPagePhotos(detail({ media: [] })), [{ url: 'https://x.test/1.jpg' }], 'the main image when there are no media rows');
  assert.equal(productPhotosShown(detail()), true);
  assert.equal(productPhotosShown(detail({ show_photos: false })), false);
});

test('links: the website / store page for imported products; http(s) only (the Buy link is a button since 20 Nov)', () => {
  assert.deepEqual(productPageLinks(detail({ origin: 'website', url: 'https://shop.test/a', buy_url: 'https://buy.test/a' })),
    [{ label: 'View on website', href: 'https://shop.test/a' }]);
  assert.deepEqual(productPageLinks(detail({ origin: 'shopify', url: 'https://s.myshopify.com/products/a' })), [{ label: 'View in your store', href: 'https://s.myshopify.com/products/a' }]);
  assert.deepEqual(productPageLinks(detail({ origin: 'manual', url: 'https://shop.test/a', buy_url: 'javascript:alert(1)' })), []);
});

test('notes: where an imported product comes from; who shared a read-only one', () => {
  assert.deepEqual(productPageNotes(detail({ origin: 'website' })), [WEBSITE_SYNC_NOTE]);
  assert.deepEqual(productPageNotes(detail({ origin: 'shopify' })), [SHOPIFY_SYNC_NOTE]);
  assert.deepEqual(productPageNotes(detail({ read_only: true, owner: { id: 1, name: 'Serpa Chrysler' } })), ['Shared by Serpa Chrysler. You can view it here.']);
  assert.deepEqual(productPageNotes(detail()), []);
});

test('pills: status (plus Out of stock), then the source', () => {
  assert.deepEqual(productPagePills(detail()).map((p) => p.label), ['Active', 'Manual']);
  assert.deepEqual(productPagePills(detail({ stock_status: 'out_of_stock', origin: 'website' })).map((p) => p.label), ['Active', 'Out of stock', 'Website']);
  assert.deepEqual(productPagePills(detail({ badge: 'out_of_stock', stock_status: 'out_of_stock', origin: 'shopify' })).map((p) => p.label), ['Out of stock', 'Shopify']);
});

test('the spec line is up to three attribute values, as the catalogue page shows it', () => {
  const attributes = [{ label: 'Category', value: 'Chairs' }, { label: 'Wood', value: 'Oak' }, { label: 'Tags', value: 'x' }, { label: 'Seats', value: '6' }, { label: 'Kind', value: 'chairs' }, { label: 'Finish', value: 'Natural' }, { label: 'More', value: 'y' }];
  assert.equal(productSpecSummary(detail({ attributes, categories: [{ id: 1, name: 'Chairs' }] })), 'Oak / 6 / Natural');
  assert.equal(productSpecSummary(detail()), '');
});

test('description: the short description, then the description', () => {
  assert.equal(productPageDescription(detail({ short_description: 'Short.', description: 'Long.' })), 'Short.\n\nLong.');
  assert.equal(productPageDescription(detail({ description: 'Long.' })), 'Long.');
  assert.equal(productPageDescription(detail()), '');
});

test('the details grid keeps everything a viewer may see, never the owner\'s own settings (Chris 20 Nov)', () => {
  const specs = productPageSpecs(detail({
    brand: 'Royal Wood', weight: '7.5', weight_unit: 'kg', compare_at_label: '$500 CAD', can_hide_photos: true, show_photos: false, show_enquire: false,
    categories: [{ id: 1, name: 'Chairs' }, { id: 2, name: 'Dining' }], attributes: [{ label: 'Finish', value: 'Oil' }],
    variants: [
      { id: 1, title: 'Small', options: { Size: 'Small' }, sku: 'WC-S', price: '450.00', price_label: '$450 CAD', stock_status: 'in_stock', quantity: 4 },
      { id: 2, title: 'Large', options: { Size: 'Large' }, sku: null, price: '520.00', price_label: '$520 CAD', stock_status: 'out_of_stock', quantity: null },
    ],
  }));
  assert.deepEqual(specs, [
    { label: 'Price', value: '$450 CAD' }, { label: 'Compare-at price', value: '$500 CAD' },
    { label: 'SKU', value: 'SKU-601' }, { label: 'Brand', value: 'Royal Wood' }, { label: 'Weight', value: '7.5 kg' },
    { label: 'Categories', value: 'Chairs, Dining' }, { label: 'Finish', value: 'Oil' },
    { label: 'Small', value: '$450 CAD · SKU WC-S · In stock · Qty 4' }, { label: 'Large', value: '$520 CAD · Out of stock' },
  ]);
});

test('a hidden price stays hidden (no "Price hidden" line either); price on request says so', () => {
  const variants = [{ id: 1, title: 'Small', options: { Size: 'Small' }, sku: null, price: '450.00', price_label: '$450 CAD', stock_status: 'in_stock', quantity: null }];
  const hidden = productPageSpecs(detail({ show_price: false, variants }));
  assert.equal(hidden.at(-1).value, 'In stock');
  assert.ok(!hidden.some((s) => s.label === 'Price' || /hidden/i.test(s.value)));
  assert.equal(productPageSpecs(detail({ price_on_request: true, variants })).at(-1).value, 'Price on request · In stock');
});
