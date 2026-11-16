// tests/products/c16-products-nav.test.mjs — the Campaigns sidebar's Products box lists manual products too (Chris 16 Nov point 6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productsNavItems } from '../../utils/products.ts';

const p = (over) => ({
  id: 1, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'Walnut Chair',
  price: '450.00', compare_at_price: null, currency: 'USD', price_label: '$450 USD', compare_at_label: '', price_on_request: false, show_price: true,
  main_image: 'https://cdn.test/a.jpg', images_count: 2, category: null, categories: [{ id: 3, name: 'Chairs' }], sku: null, brand: null, url: null,
  updated_at: null, ...over,
});

test('manual and website products are listed, Shopify ones are left to their own box', () => {
  const out = productsNavItems([
    p({ id: 1 }),
    p({ id: 2, origin: 'website', category: 'Sofas', categories: [], url: 'https://shop.test/sofa' }),
    p({ id: 3, origin: 'shopify', category: 'Tees', categories: [] }),
  ]);
  assert.deepEqual(out.map((i) => i.id), [1, 2]);
  assert.equal(out[0].category, 'Chairs'); // its first Products category
  assert.equal(out[0].url, null);
  assert.equal(out[1].category, 'Sofas'); // a website item without explicit links: its website category
  assert.equal(out[1].url, 'https://shop.test/sofa');
});

test('the price shown follows the product: hidden or on request', () => {
  assert.equal(productsNavItems([p({})])[0].price_label, '$450 USD');
  assert.equal(productsNavItems([p({ show_price: false })])[0].price_label, '');
  assert.equal(productsNavItems([p({ price_on_request: true })])[0].price_label, 'Price on request');
});

test('a main account product seen by its salesperson keeps read_only and its owner', () => {
  const owner = { id: 7, name: 'Main', profile_image: null, profile_color: null };
  const [item] = productsNavItems([p({ read_only: true, user_id: 7, owner })]);
  assert.equal(item.read_only, true);
  assert.deepEqual(item.owner, owner);
  assert.equal(productsNavItems([p({ categories: [], category: null })])[0].category, null); // grouped under "Other"
});
