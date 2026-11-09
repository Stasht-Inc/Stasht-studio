// tests/products/products.test.mjs
// Products M2 pure helpers (plan docs/superpowers/plans/2026-11-09-products-m1-m2.md, web API repo). Node >= 22.18.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_LABEL, sourceLabel, priceLine, productQueryString, productsGate, campaignGridHidesCatalogue, showsProductsNav,
  variantCombinations, mergeVariants, moveItem, emptyProductForm, formFromDetail, payloadFromForm, validateProductForm,
  fieldErrorsFrom, slugFromTitle,
} from '../../utils/products.ts';

const status = (over = {}) => ({ pilot: true, available: true, reason: null, can_create: true, counts: { total: 3, manual: 2, website: 1 }, default_currency: 'CAD', ...over });

test('badge and source copy is the spec\'s', () => {
  assert.deepEqual(BADGE_LABEL, { active: 'Active', draft: 'Draft', out_of_stock: 'Out of stock', archived: 'Archived' });
  assert.equal(sourceLabel({ origin: 'website' }), 'Website');
  assert.equal(sourceLabel({ origin: 'manual' }), 'Manual');
});

test('price line: sale price struck through, price on request, hidden price', () => {
  assert.deepEqual(priceLine({ price_label: '$450 CAD', compare_at_label: '$500 CAD', price_on_request: false, show_price: true }), { main: '$450 CAD', was: '$500 CAD' });
  assert.deepEqual(priceLine({ price_label: '$450 CAD', compare_at_label: '', price_on_request: true, show_price: true }), { main: 'Price on request', was: '' });
  assert.deepEqual(priceLine({ price_label: '$450 CAD', compare_at_label: '', price_on_request: false, show_price: false }), { main: 'Price hidden', was: '' });
  assert.deepEqual(priceLine({ price_label: '', compare_at_label: '', price_on_request: false, show_price: true }), { main: '', was: '' });
});

test('query string skips empty filters and joins statuses', () => {
  assert.equal(productQueryString({}), 'page=1&per_page=48');
  assert.equal(
    productQueryString({ q: ' oak ', category_id: 7, status: ['active', 'draft'], source: 'manual', price_min: '10', price_max: '', in_stock: true, sort: 'title', page: 2 }),
    'q=oak&category_id=7&status=active%2Cdraft&source=manual&price_min=10&in_stock=1&sort=title&page=2&per_page=48',
  );
});

test('gates: hidden off the pilot, upgrade on a free plan, ready otherwise; nav only in the personal and own External view', () => {
  assert.equal(productsGate(null), 'hidden');
  assert.equal(productsGate(status({ pilot: false, available: false, reason: 'not_available' })), 'hidden');
  assert.equal(productsGate(status({ available: false, reason: 'plan_required' })), 'upgrade');
  assert.equal(productsGate(status()), 'ready');
  assert.equal(campaignGridHidesCatalogue(status({ available: false, reason: 'plan_required' })), true);
  assert.equal(campaignGridHidesCatalogue(status({ pilot: false })), false);
  assert.equal(campaignGridHidesCatalogue(null), false);
  assert.equal(showsProductsNav(status(), 'personal', false), true);
  assert.equal(showsProductsNav(status(), 'property', false), false);
  assert.equal(showsProductsNav(status(), 'property', true), true);
  assert.equal(showsProductsNav(status({ pilot: false }), 'personal', false), false);
});

test('variant combinations and merging keep edited rows', () => {
  const options = [{ name: 'Size', values: ['S', 'L', ' '] }, { name: 'Colour', values: ['Oak'] }, { name: '', values: ['x'] }];
  assert.deepEqual(variantCombinations(options), [{ Size: 'S', Colour: 'Oak' }, { Size: 'L', Colour: 'Oak' }]);
  const existing = [{ id: 9, options: { Size: 'S', Colour: 'Oak' }, sku: 'S-OAK', price: '40', compare_at_price: '', stock_status: 'in_stock', quantity: '', image_id: null }];
  const merged = mergeVariants(existing, options);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 9);
  assert.equal(merged[0].sku, 'S-OAK');
  assert.deepEqual(merged[1].options, { Size: 'L', Colour: 'Oak' });
  assert.equal(merged[1].sku, '');
  assert.deepEqual(variantCombinations([]), []);
});

test('moveItem', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(moveItem(['a', 'b'], 0, 5), ['a', 'b']);
});

test('form round trip and payload only carries editable fields', () => {
  const detail = {
    id: 1, origin: 'manual', title: 'Walnut Chair', short_description: 'Hand-made', description_html: '<p>x</p>', brand: null, product_type: null,
    price: '450.00', compare_at_price: null, currency: 'CAD', price_on_request: false, sku: 'WC', barcode: null, stock_status: 'in_stock', quantity: 4,
    options: [{ name: 'Size', values: ['S'] }], variants: [{ id: 3, options: { Size: 'S' }, sku: null, price: '420.00', compare_at_price: null, stock_status: 'in_stock', quantity: null, image_id: null }],
    attributes: [{ label: 'Wood', value: 'Walnut' }], weight: null, weight_unit: null, dimensions: null, categories: [{ id: 5, name: 'Featured' }], tags: ['new'], collections: [],
    status: 'active', show_enquire: true, show_price: true, seo: { slug: 'walnut-chair', title: null, description: null, share_image: null }, buy_url: null, internal_notes: 'n',
  };
  const form = formFromDetail(detail);
  assert.equal(form.price, '450.00');
  assert.equal(form.quantity, '4');
  assert.deepEqual(form.category_ids, [5]);
  assert.equal(form.slug, 'walnut-chair');
  assert.equal(form.variants[0].price, '420.00');
  const payload = payloadFromForm({ ...form, price: '99', quantity: '' }, ['title', 'price', 'quantity', 'variants']);
  assert.deepEqual(Object.keys(payload).sort(), ['price', 'quantity', 'title', 'variants']);
  assert.equal(payload.price, 99);
  assert.equal(payload.quantity, null);
  assert.deepEqual(payload.variants, [{ id: 3, options: { Size: 'S' }, sku: null, price: 420, compare_at_price: null, stock_status: 'in_stock', quantity: null, image_id: null }]);
  const website = payloadFromForm(form, ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'category_ids']);
  assert.deepEqual(Object.keys(website).sort(), ['category_ids', 'collections', 'internal_notes', 'show_enquire', 'show_price', 'status', 'tags']);
  assert.equal(emptyProductForm('INR').currency, 'INR');
  assert.equal(emptyProductForm('INR').status, 'active');
});

test('validation messages match the API\'s', () => {
  const all = ['title', 'price', 'compare_at_price', 'quantity', 'slug', 'buy_url', 'share_image', 'currency', 'weight'];
  const f = { ...emptyProductForm('CAD'), title: ' ', price: '100', compare_at_price: '90', quantity: '1.5', slug: 'Not OK', buy_url: 'javascript:x', currency: 'CA' };
  assert.deepEqual(validateProductForm(f, all), {
    title: 'Give the product a title.',
    compare_at_price: 'The compare-at price should be higher than the price.',
    quantity: 'Enter a whole number.',
    slug: 'Use lower-case letters, numbers and dashes only.',
    buy_url: 'Use a web address starting with https://',
    currency: 'Use a three-letter currency code, like CAD.',
  });
  assert.deepEqual(validateProductForm({ ...f, title: 'Ok' }, ['status']), {}); // a website product checks only what it edits
});

test('field errors and slugs', () => {
  assert.deepEqual(fieldErrorsFrom({ title: ['Give the product a title.', 'x'], 'variants.0.price': ['Bad'] }), { title: 'Give the product a title.', 'variants.0.price': 'Bad' });
  assert.deepEqual(fieldErrorsFrom(null), {});
  assert.equal(slugFromTitle('  Café Chair — Walnut & Oak!  '), 'cafe-chair-walnut-oak');
});
