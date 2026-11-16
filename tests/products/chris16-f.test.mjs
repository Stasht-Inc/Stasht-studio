// tests/products/chris16-f.test.mjs — Leads "+ Products" lists the account's manual products too (Deepak, 16 Nov F1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadShareManualItems, leadShareSources } from '../../utils/products.ts';

test('F1: an API from before F1 — products means the Website Catalogue, as before', () => {
  assert.deepEqual(leadShareSources({ vehicles: true, products: true }), { vehicles: true, products: true, website: true, manual: false });
  assert.deepEqual(leadShareSources({ vehicles: false, products: false }), { vehicles: false, products: false, website: false, manual: false });
  assert.equal(leadShareSources(null), null);
  assert.equal(leadShareSources({ products: true }), null); // no vehicles flag: not an answer
});

test('F1: with Products on the answer says which kinds there are', () => {
  assert.deepEqual(leadShareSources({ vehicles: false, products: true, website_products: false, manual_products: true }),
    { vehicles: false, products: true, website: false, manual: true });
  assert.deepEqual(leadShareSources({ vehicles: true, products: true, website_products: true, manual_products: true }),
    { vehicles: true, products: true, website: true, manual: true });
});

const p = (over) => ({
  id: 1, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'Walnut Chair',
  price: '450.00', compare_at_price: null, currency: 'USD', price_label: '$450 USD', compare_at_label: '', price_on_request: false, show_price: true,
  main_image: 'https://cdn.test/a.jpg', images_count: 2, category: null, categories: [{ id: 3, name: 'Chairs' }], sku: null, brand: null, url: null,
  updated_at: null, ...over,
});

test('F1: only active manual products with a photo, shaped for the picker (never a product URL)', () => {
  const out = leadShareManualItems([
    p({ id: 1 }),
    p({ id: 2, stock_status: 'out_of_stock', badge: 'out_of_stock', categories: [] }), // out of stock: still offered
    p({ id: 3, status: 'draft', badge: 'draft' }),
    p({ id: 4, status: 'archived', badge: 'archived' }),
    p({ id: 5, images_count: 0, main_image: null }), // no photo: left out
    p({ id: 6, origin: 'website', url: 'https://shop.test/p/6' }), // website ones come from the catalogue, as before
  ]);
  assert.deepEqual(out.map((i) => i.id), [1, 2]);
  assert.deepEqual(out[0], { id: 1, title: 'Walnut Chair', price: '450.00', currency: 'USD', price_label: '$450 USD', category: 'Chairs', url: null, main_image: 'https://cdn.test/a.jpg', images_count: 2 });
  assert.equal(out[1].category, null);
});
