// tests/products/c20-product-page.test.mjs — Chris 20 Nov 2026 (points 13–17, 19, 20b): the product page shows what was
// entered in the editor, its Buy link is a button with the owner's words, photos have names, Edit Cover's order, and the
// details grid never shows internal settings, duplicates or placeholders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BUY_LABEL_MAX, DEFAULT_BUY_LABEL, MANUAL_FIELDS, cleanSpecRows, emptyProductForm, formFromDetail, mediaOrderWithFirst, payloadFromForm,
  productBuyButton, productCoverEditable, productPageCover, productPageSpecs, productPhotoName, validateProductForm,
} from '../../utils/products.ts';

const detail = (over = {}) => ({
  id: 701, user_id: 959, read_only: false, origin: 'manual', status: 'active', stock_status: 'in_stock', badge: 'active', title: 'Half Front Torso',
  price: '45.00', compare_at_price: null, currency: 'CAD', price_label: '$45 CAD', compare_at_label: '', price_on_request: false, show_price: true,
  main_image: null, images_count: 0, category: null, categories: [{ id: 3, name: 'Body' }], sku: null, brand: null, url: null, updated_at: null,
  short_description: 'All our waxing services are performed with Hard Wax.', description: 'Hair removed from the front body',
  description_html: '<p>Hair removed from the front body</p>', product_type: null, barcode: null, quantity: null, availability: 'available',
  options: [], variants: [], attributes: [], weight: null, weight_unit: null, dimensions: null, tags: [], collections: [],
  seo: { slug: 'half-front-torso', title: null, description: null, share_image: null }, buy_url: 'https://www.fresha.com/a/the-body-politik',
  buy_label: null, buy_button: 'Buy now', show_enquire: true, show_photos: true, can_hide_photos: true, media: [], editable_fields: [...MANUAL_FIELDS, 'media'],
  internal_notes: 'Supplier: wax co', ...over,
});

test('Buy button: the owner\'s words, else "Buy now"; http(s) links only', () => {
  assert.deepEqual(productBuyButton(detail()), { label: 'Buy now', href: 'https://www.fresha.com/a/the-body-politik' });
  assert.deepEqual(productBuyButton(detail({ buy_label: 'Book now', buy_button: 'Book now' })).label, 'Book now');
  assert.equal(productBuyButton(detail({ buy_button: undefined, buy_label: undefined })).label, DEFAULT_BUY_LABEL, 'an older web API');
  assert.equal(productBuyButton(detail({ buy_url: null })), null);
  assert.equal(productBuyButton(detail({ buy_url: 'javascript:alert(1)' })), null);
  assert.equal(productBuyButton(detail({ buy_url: 'fresha.com/x' })), null);
});

test('editor: Button text round-trips, is sent only when the API offers it, and is at most 40 characters', () => {
  assert.equal(emptyProductForm('CAD').buy_label, '');
  const f = formFromDetail(detail({ buy_label: 'Checkout' }));
  assert.equal(f.buy_label, 'Checkout');
  assert.equal(payloadFromForm({ ...f, buy_label: '  Book now ' }, MANUAL_FIELDS).buy_label, 'Book now');
  assert.equal(payloadFromForm({ ...f, buy_label: '' }, MANUAL_FIELDS).buy_label, null);
  assert.ok(!('buy_label' in payloadFromForm(f, MANUAL_FIELDS.filter((k) => k !== 'buy_label'))));
  assert.ok(MANUAL_FIELDS.includes('buy_label'));
  const long = { ...f, buy_label: 'x'.repeat(BUY_LABEL_MAX + 1) };
  assert.match(validateProductForm(long, MANUAL_FIELDS).buy_label, /40 characters/);
  assert.equal(validateProductForm({ ...f, buy_label: 'Book now' }, MANUAL_FIELDS).buy_label, undefined);
});

test('the Half Front Torso page shows its price and category; never Enquire / Photos / notes', () => {
  const specs = productPageSpecs(detail());
  assert.deepEqual(specs, [{ label: 'Price', value: '$45 CAD' }, { label: 'Category', value: 'Body' }]);
  const all = JSON.stringify(productPageSpecs(detail({ show_enquire: false, show_photos: false, tags: ['wax'], collections: ['Spring'] })));
  assert.ok(!/Enquire|Photos|Supplier|Hidden|Shown/.test(all), all);
  assert.match(all, /"Tags","value":"wax"/);
  assert.match(all, /"Collections","value":"Spring"/);
});

test('every useful editor field reaches the grid: brand, type, SKU, barcode, quantity, weight, dimensions, specs, variants', () => {
  const specs = productPageSpecs(detail({
    brand: 'Body Politik', product_type: 'Waxing', sku: 'WAX-HFT', barcode: '0123', quantity: 5, weight: '1', weight_unit: 'kg',
    dimensions: { length: 1, width: 2, height: 3, unit: 'cm' }, compare_at_label: '$55 CAD', attributes: [{ label: 'Duration', value: '30 min' }],
    variants: [{ id: 1, title: 'Short', options: { Length: 'Short' }, sku: null, price: '45.00', price_label: '$45 CAD', stock_status: 'in_stock', quantity: null }],
  })).map((s) => s.label);
  assert.deepEqual(specs, ['Price', 'Compare-at price', 'SKU', 'Brand', 'Product type', 'Barcode / UPC', 'Quantity', 'Weight', 'Dimensions', 'Category', 'Duration', 'Short']);
});

test('point 20b: one Category row, no placeholder values, nothing that only repeats the category', () => {
  const rows = productPageSpecs(detail({
    origin: 'website', categories: [{ id: 9, name: 'Sheet Stock' }], sku: 'WVF-WO-4X8-RIFT-POLY', brand: 'The Royal Wood Shop',
    attributes: [
      { label: 'Category', value: 'Sheet Stock' }, { label: 'Material', value: 'White Oak' }, { label: 'Sub-Category', value: 'Sheet Stock' },
      { label: 'Product Code', value: 'Sheet Stock' }, { label: 'Size', value: '4 x 8' }, { label: 'Availability', value: '-' }, { label: 'Lead Time', value: 'N/A' },
      { label: 'Height', value: '' }, { label: 'Unit of Measure', value: 'Unit of measure' }, { label: 'material', value: 'Oak' },
    ],
  }));
  assert.deepEqual(rows, [
    { label: 'Price', value: '$45 CAD' }, { label: 'SKU', value: 'WVF-WO-4X8-RIFT-POLY' }, { label: 'Brand', value: 'The Royal Wood Shop' },
    { label: 'Category', value: 'Sheet Stock' }, { label: 'Material', value: 'White Oak' }, { label: 'Size', value: '4 x 8' },
  ]);
  assert.deepEqual(cleanSpecRows([{ label: 'SKU', value: 'A' }, { label: ' sku ', value: 'B' }, { label: 'Colour', value: 'Red' }]), [{ label: 'SKU', value: 'A' }, { label: 'Colour', value: 'Red' }]);
});

test('point 19: photo names — the title for the first, "Photo N" for the others', () => {
  assert.equal(productPhotoName('Half Front Torso', 0), 'Half Front Torso');
  assert.equal(productPhotoName('Half Front Torso', 1), 'Photo 2');
  assert.equal(productPhotoName('', 0), 'Photo 1');
});

test('point 16: the cover is the first media item (photo or video); Edit Cover moves the pick first; owners only', () => {
  const media = [{ id: 5, url: 'b.jpg', type: 'photo', sort_order: 1 }, { id: 4, url: 'a.jpg', type: 'photo', sort_order: 0 }, { id: 6, url: 'v.mp4', type: 'video', sort_order: 2 }];
  assert.equal(productPageCover(detail({ media })), 'a.jpg');
  assert.equal(productPageCover(detail({ media: [{ id: 6, url: 'v.mp4', type: 'video', sort_order: 0 }, ...media.slice(0, 2)] })), 'v.mp4');
  assert.equal(productPageCover(detail({ media, show_photos: false })), null);
  assert.equal(productPageCover(detail()), null, 'no photo: the brand cover shows');
  assert.equal(productPageCover(detail({ main_image: 'm.jpg' })), 'm.jpg');
  assert.deepEqual(mediaOrderWithFirst(media, 6), [6, 4, 5]);
  assert.deepEqual(mediaOrderWithFirst(media, 99), [4, 5, 6]);
  assert.equal(productCoverEditable(detail()), true);
  assert.equal(productCoverEditable(detail({ read_only: true })), false);
  assert.equal(productCoverEditable(detail({ origin: 'website', editable_fields: ['status', 'tags'] })), false);
  assert.equal(productCoverEditable(null), false);
});

test('point 20b: the spec line under the title skips placeholder cells too', async () => {
  const { productSpecSummary } = await import('../../utils/products.ts');
  assert.equal(productSpecSummary({ categories: [{ id: 9, name: 'Sheet Stock' }], attributes: [{ label: 'Material', value: 'White Oak' }, { label: 'Lead Time', value: '-' }, { label: 'Code', value: 'Sheet Stock' }, { label: 'Size', value: "4' x 8'" }] }), "White Oak / 4' x 8'");
});
