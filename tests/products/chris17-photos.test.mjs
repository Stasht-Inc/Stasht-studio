// Chris 17 Nov 2026: "should have option to hide photo in edit" — the product editor's "Show photos" switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MANUAL_FIELDS, emptyProductForm, formFromDetail, payloadFromForm, photosFacts } from '../../utils/products.ts';

const detail = (over = {}) => ({
  title: 'Half Front Torso', categories: [], tags: [], collections: [], options: [], variants: [], attributes: [], media: [],
  seo: {}, dimensions: null, status: 'active', show_enquire: true, show_price: true, editable_fields: MANUAL_FIELDS, ...over,
});

test('a new product shows photos', () => {
  assert.equal(emptyProductForm('USD').show_photos, true);
});

test('the form follows the product; missing (older web API) counts as shown', () => {
  assert.equal(formFromDetail(detail({ show_photos: false })).show_photos, false);
  assert.equal(formFromDetail(detail({ show_photos: true })).show_photos, true);
  assert.equal(formFromDetail(detail()).show_photos, true);
});

test('the save sends show_photos only when the product takes it', () => {
  const form = { ...emptyProductForm('USD'), title: 'Half Front Torso', show_photos: false };
  assert.equal(payloadFromForm(form, MANUAL_FIELDS).show_photos, false);
  assert.ok(!('show_photos' in payloadFromForm(form, ['title', 'status'])));
});

test('the details page says Photos: Hidden / Shown, only once the switch is offered', () => {
  assert.deepEqual(photosFacts({ show_photos: false, can_hide_photos: true }), [{ label: 'Photos', value: 'Hidden' }]);
  assert.deepEqual(photosFacts({ show_photos: true, can_hide_photos: true }), [{ label: 'Photos', value: 'Shown' }]);
  assert.deepEqual(photosFacts({ show_photos: false }), []);
});
