// tests/products/shopify-origin.test.mjs — Shopify products on the Products page (Deepak, 16 Nov): a third source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOPIFY_PRODUCT_COLOR, leadShareManualItems, productCategoryColor, sourceColor, sourceLabel } from '../../utils/products.ts';

test('source pill: Website / Shopify / Manual, each in its own colour', () => {
  assert.equal(sourceLabel({ origin: 'website' }), 'Website');
  assert.equal(sourceLabel({ origin: 'shopify' }), 'Shopify');
  assert.equal(sourceLabel({ origin: 'manual' }), 'Manual');
  assert.equal(sourceColor({ origin: 'shopify' }), SHOPIFY_PRODUCT_COLOR);
  assert.notEqual(sourceColor({ origin: 'website' }), SHOPIFY_PRODUCT_COLOR);
  assert.equal(sourceColor({ origin: 'manual' }), '#6C60FF');
});

test('a category from the Shopify store is Shopify green, ahead of the website teal', () => {
  assert.equal(productCategoryColor(4, true, true), SHOPIFY_PRODUCT_COLOR);
  assert.notEqual(productCategoryColor(4, true), SHOPIFY_PRODUCT_COLOR);
});

test('Leads "+ Products" manual list never takes a Shopify copy (its Shopify rows already list it)', () => {
  const items = [
    { id: 1, origin: 'manual', status: 'active', images_count: 1, title: 'Mug' },
    { id: 2, origin: 'shopify', status: 'active', images_count: 2, title: 'Tee' },
  ];
  assert.deepEqual(leadShareManualItems(items).map((i) => i.id ?? i.catalog_item_id ?? i), leadShareManualItems([items[0]]).map((i) => i.id ?? i.catalog_item_id ?? i));
});
