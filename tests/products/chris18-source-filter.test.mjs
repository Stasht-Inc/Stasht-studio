// Chris 18 Nov 2026: "we shouldn't show shopify if it isn't connected" — the Products page's Source filter choices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceOptionsFor } from '../../utils/products.ts';

test('no Shopify products → no Shopify choice; no website products → no Website choice', () => {
  assert.deepEqual(sourceOptionsFor({ counts: { total: 3, manual: 3, website: 0 } }), ['manual']);
  assert.deepEqual(sourceOptionsFor({ counts: { total: 9, manual: 3, website: 6, shopify: 0 } }), ['website', 'manual']);
});

test('a connected store with products shows Shopify', () => {
  assert.deepEqual(sourceOptionsFor({ counts: { total: 9, manual: 0, website: 4, shopify: 5 } }), ['website', 'shopify', 'manual']);
});

test('an unknown status keeps every choice', () => {
  assert.deepEqual(sourceOptionsFor(null), ['website', 'shopify', 'manual']);
});
