// tests/products/chris16.test.mjs — Chris's 16 Nov Products feedback: currency dropdown + USD default (C7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCIES, DEFAULT_CURRENCY, currencyOptions, emptyProductForm } from '../../utils/products.ts';

test('C7: a new product defaults to USD when the API gives no currency', () => {
  assert.equal(DEFAULT_CURRENCY, 'USD');
  assert.equal(emptyProductForm('').currency, 'USD');
  assert.equal(emptyProductForm('INR').currency, 'INR'); // the API's default still wins when given
});

test('C7: the dropdown lists the common currencies, USD first', () => {
  const codes = currencyOptions('USD').map((o) => o.value);
  assert.equal(codes[0], 'USD');
  for (const c of ['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD', 'INR']) assert.ok(codes.includes(c), c);
  assert.equal(codes.length, CURRENCIES.length);
  assert.equal(currencyOptions('CAD').find((o) => o.value === 'CAD').label, 'CAD – Canadian dollar');
});

test('C7: a product whose currency is not listed keeps it selectable', () => {
  const opts = currencyOptions('thb');
  assert.deepEqual(opts[0], { value: 'THB', label: 'THB' });
  assert.equal(opts.length, CURRENCIES.length + 1);
  assert.equal(currencyOptions('').length, CURRENCIES.length);
});

test('C6: the card shows the first category and "+N" for the rest', async () => {
  const { cardCategories } = await import('../../utils/products.ts');
  assert.deepEqual(cardCategories({ categories: [] }), { first: null, more: 0 });
  assert.deepEqual(cardCategories({ categories: [{ id: 1, name: 'Intimate' }] }), { first: 'Intimate', more: 0 });
  assert.deepEqual(cardCategories({ categories: [{ id: 1, name: 'Intimate' }, { id: 2, name: 'Sale' }, { id: 3, name: ' ' }] }), { first: 'Intimate', more: 1 });
  assert.deepEqual(cardCategories({}), { first: null, more: 0 });
});
