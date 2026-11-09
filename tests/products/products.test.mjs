// tests/products/products.test.mjs
// Products M2 pure helpers (plan docs/superpowers/plans/2026-11-09-products-m1-m2.md, web API repo). Node >= 22.18.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BADGE_LABEL, sourceLabel, priceLine, productQueryString, productsGate, campaignGridHidesCatalogue, showsProductsNav,
  variantCombinations, mergeVariants, moveItem, emptyProductForm, formFromDetail, payloadFromForm, validateProductForm,
  fieldErrorsFrom, slugFromTitle, bulkResultMessage, pageToClampTo, WEBSITE_DELETE_HINT, MANUAL_FIELDS, editableFor,
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

import { createKeyedStore } from '../../utils/keyedStore.ts';

const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('keyed store: per-key cache, a slow old key never overwrites the current one', async () => {
  const store = createKeyedStore();
  const slow = deferred();
  const a = store.load('A', false, () => slow.promise);
  assert.equal(await store.load('B', false, async () => 'b'), 'b');
  slow.resolve('a');
  await a;
  assert.equal(store.peek('A'), 'a');
  assert.equal(store.peek('B'), 'b');
  assert.equal(await store.load('A', false, async () => 'zzz'), 'a'); // cached, no second fetch
});

test('keyed store: concurrent fresh loads share one request; failures are not cached', async () => {
  const store = createKeyedStore();
  let calls = 0;
  const d = deferred();
  const fetcher = () => { calls += 1; return d.promise; };
  const loads = [store.load('K', true, fetcher), store.load('K', true, fetcher), store.load('K', true, fetcher)];
  d.resolve(null);
  assert.deepEqual(await Promise.all(loads), [null, null, null]);
  assert.equal(calls, 1);
  assert.equal(store.peek('K'), undefined);
  assert.equal(await store.load('K', false, async () => 'ok'), 'ok'); // retried after the failure
  assert.equal(await store.load('K', false, async () => { throw new Error('x'); }), 'ok');
  assert.equal(await store.load('Z', false, async () => { throw new Error('x'); }), null);
});

test('keyed store: a stale non-fresh response does not overwrite a later fresh one', async () => {
  const store = createKeyedStore();
  const old = deferred();
  const first = store.load('K', false, () => old.promise);
  assert.equal(await store.load('K', true, async () => 'new'), 'new');
  old.resolve('old');
  await first;
  assert.equal(store.peek('K'), 'new');
});

test('number-format errors, weight and dimensions payload', () => {
  const f = { ...emptyProductForm('CAD'), title: 'T', price: 'abc', weight: '-1', compare_at_price: '' };
  const errs = validateProductForm(f, ['title', 'price', 'weight', 'compare_at_price']);
  assert.equal(errs.price, 'Enter a number, like 49.99.');
  assert.equal(errs.weight, 'Enter a number, like 49.99.');
  const g = { ...emptyProductForm('CAD'), weight: '2.5', weight_unit: 'lb', dimensions: { length: '10', width: '', height: '3', unit: 'in' } };
  const p = payloadFromForm(g, ['weight', 'weight_unit', 'dimensions']);
  assert.equal(p.weight, 2.5);
  assert.equal(p.weight_unit, 'lb');
  assert.deepEqual(p.dimensions, { length: 10, width: null, height: 3, unit: 'in' });
  assert.equal(payloadFromForm({ ...g, weight: '' }, ['weight', 'weight_unit']).weight_unit, null);
});

test('bulk result message: counts, skipped ids and why', () => {
  assert.equal(bulkResultMessage('status', { updated: 3, deleted: 0, skipped_ids: [] }), '3 updated.');
  assert.equal(bulkResultMessage('category', { updated: 1, deleted: 0, skipped_ids: [9] }), "1 updated, 1 skipped (they're no longer available to you).");
  assert.equal(bulkResultMessage('delete', { updated: 0, deleted: 3, skipped_ids: [4] }, [4, 7]), "3 deleted, 1 skipped (website products can't be deleted).");
  assert.equal(bulkResultMessage('delete', { updated: 0, deleted: 1, skipped_ids: [4, 5] }, [4]), "1 deleted, 2 skipped (they're no longer available to you).");
  assert.equal(bulkResultMessage('delete', { updated: 0, deleted: 2, skipped_ids: [] }), '2 deleted.');
  assert.equal(WEBSITE_DELETE_HINT, "Products from your website can't be deleted. Archive them instead.");
});

test('page clamp: an empty page past the last one goes back to the last page', () => {
  const pg = (current_page, last_page) => ({ current_page, per_page: 48, total: 0, last_page });
  assert.equal(pageToClampTo(3, pg(3, 2), 0), 2);
  assert.equal(pageToClampTo(2, pg(2, 1), 0), 1);
  assert.equal(pageToClampTo(2, pg(2, 0), 0), 1); // nothing left at all → page 1
  assert.equal(pageToClampTo(1, pg(1, 1), 0), null); // page 1 empty: the real empty state
  assert.equal(pageToClampTo(2, pg(2, 2), 0), null); // within range: show what came back
  assert.equal(pageToClampTo(3, pg(3, 2), 5), null); // items came back: nothing to fix
});

test('a new product edits every manual field; a loaded one what the API says', () => {
  assert.ok(MANUAL_FIELDS.includes('variants') && MANUAL_FIELDS.includes('slug') && !MANUAL_FIELDS.includes('media'));
  assert.deepEqual(editableFor(null), MANUAL_FIELDS);
  assert.deepEqual(editableFor({ editable_fields: ['status', 'tags'] }), ['status', 'tags']);
});

test('variant rows: number format and compare-at above the price, under each row\'s field (API keys variants.N.*)', () => {
  const v = (over) => ({ options: { Size: 'S' }, sku: '', price: '', compare_at_price: '', stock_status: 'in_stock', quantity: '', image_id: null, ...over });
  const form = { ...emptyProductForm('CAD'), title: 'Bench', variants: [v({ price: '10', compare_at_price: '8' }), v({ price: 'abc', quantity: '1.5' }), v({ price: '10', compare_at_price: '12' })] };
  const e = validateProductForm(form, MANUAL_FIELDS);
  assert.equal(e['variants.0.compare_at_price'], 'The compare-at price should be higher than the price.');
  assert.equal(e['variants.1.price'], 'Enter a number, like 49.99.');
  assert.equal(e['variants.1.quantity'], 'Enter a whole number.');
  assert.ok(!Object.keys(e).some((k) => k.startsWith('variants.2')));
  assert.deepEqual(validateProductForm(form, ['status']), {}); // a website product never checks rows it can't change
});
