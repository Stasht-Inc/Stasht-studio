// tests/products/postlive-details.test.mjs — post-live P1 (15 Nov): the product details view's actions and facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailActions, detailFacts, enquireFact, WEBSITE_SYNC_NOTE } from '../../utils/products.ts';

const MANUAL_FIELDS = ['title', 'price', 'status', 'tags', 'media'];
const WEBSITE_FIELDS = ['status', 'tags', 'collections', 'internal_notes', 'show_price', 'show_enquire', 'category_ids'];

test('P1: a manual product has Edit and ⋯ with Duplicate, Archive and Delete', () => {
  assert.deepEqual(detailActions({ read_only: false, origin: 'manual', editable_fields: MANUAL_FIELDS, status: 'active' }),
    { edit: true, settings: false, duplicate: true, archive: 'archive', remove: true, menu: true });
  assert.equal(detailActions({ read_only: false, origin: 'manual', editable_fields: MANUAL_FIELDS, status: 'archived' }).archive, 'unarchive');
});

test('P1: a website product has no Edit; ⋯ keeps Duplicate, Archive and its Studio-only settings, never Delete', () => {
  assert.deepEqual(detailActions({ read_only: false, origin: 'website', editable_fields: WEBSITE_FIELDS, status: 'active' }),
    { edit: false, settings: true, duplicate: true, archive: 'archive', remove: false, menu: true });
  assert.match(WEBSITE_SYNC_NOTE, /comes from your website/);
});

test('P1: the External view (read-only) has no Edit and no ⋯', () => {
  assert.deepEqual(detailActions({ read_only: true, origin: 'manual', editable_fields: [], status: 'active' }),
    { edit: false, settings: false, duplicate: false, archive: null, remove: false, menu: false });
});

test('P1: facts list only what the product has', () => {
  assert.deepEqual(detailFacts({ sku: 'SKU-1', brand: '', product_type: null, barcode: null, quantity: 0, weight: '2.5', weight_unit: 'kg', dimensions: { length: 10, width: 20, unit: 'cm' } }), [
    { label: 'SKU', value: 'SKU-1' }, { label: 'Quantity', value: '0' }, { label: 'Weight', value: '2.5 kg' }, { label: 'Dimensions', value: '10 × 20 × – cm' },
  ]);
  assert.deepEqual(detailFacts({ sku: null, brand: null, product_type: null, barcode: null, quantity: null, weight: null, weight_unit: null, dimensions: null }), []);
});

test('the details say whether the Enquire button is on (Chris 16 Nov, point 4); unset = on', () => {
  assert.deepEqual(enquireFact({ show_enquire: true }), { label: 'Enquire button', value: 'On' });
  assert.deepEqual(enquireFact({ show_enquire: null }), { label: 'Enquire button', value: 'On' });
  assert.deepEqual(enquireFact({}), { label: 'Enquire button', value: 'On' });
  assert.deepEqual(enquireFact({ show_enquire: false }), { label: 'Enquire button', value: 'Off' });
});
