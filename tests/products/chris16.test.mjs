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

test('C4: picks on a new product follow the API limits, in order', async () => {
  const { acceptPickedMedia } = await import('../../utils/products.ts');
  const f = (name, type, size = 1000) => ({ name, type, size });
  const r = acceptPickedMedia({ photos: 0, videos: 0 }, [f('a.jpg', 'image/jpeg'), f('b.mp4', 'video/mp4'), f('c.mov', 'video/quicktime'), f('d.pdf', 'application/pdf'), f('e.png', 'image/png', 11 * 1024 * 1024)]);
  assert.deepEqual(r.accepted.map((x) => [x.file.name, x.type]), [['a.jpg', 'photo'], ['b.mp4', 'video']]);
  assert.deepEqual(r.errors, [
    'c.mov: A product can have one video.',
    'd.pdf: Use a JPG, PNG, GIF or WebP photo, or an MP4, MOV or WebM video.',
    'e.png: A photo can be up to 10 MB.',
  ]);
  assert.deepEqual(acceptPickedMedia({ photos: 20, videos: 0 }, [f('x.webp', 'image/webp')]).errors, ['x.webp: A product can have up to 20 photos.']);
  assert.equal(acceptPickedMedia({ photos: 0, videos: 0 }, [f('v.webm', 'video/webm', 60 * 1024 * 1024)]).errors[0], 'v.webm: A video can be up to 50 MB.');
});
