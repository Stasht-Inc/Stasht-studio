// tests/utils/productMoment.test.mjs — Chris 21 Nov 2026 (P3): a product moment's price badge and caption.
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRICE_ON_REQUEST, isProductPost, plainText, shownPrice, splitProductCaption } from '../../utils/productMoment.ts';

test('a product moment is told by its catalog_ type_id', () => {
  assert.equal(isProductPost({ type_id: 'catalog_812_0_1763700000' }), true);
  assert.equal(isProductPost({ type_id: 'web_image_5_0_1763700000_metadata' }), false);
  assert.equal(isProductPost({ type_id: 'catalog_' }), false);
  assert.equal(isProductPost({}), false);
  assert.equal(isProductPost(null), false);
});

test('the price line becomes the badge; the description stays as the caption', () => {
  const d = 'All our waxing services are performed with Hard Wax.\nIncludes hands and fingers.\nPrice: $65 CAD\nDuration: 30 min';
  assert.deepEqual(splitProductCaption(d, 'Full Arms'), {
    price: '$65 CAD',
    caption: 'All our waxing services are performed with Hard Wax.\nIncludes hands and fingers.\nDuration: 30 min',
  });
});

test('no description: the API wrote the title, which is not repeated under the title', () => {
  assert.deepEqual(splitProductCaption('Brazilian (V)\nPrice: $80 CAD', 'Brazilian (V)'), { price: '$80 CAD', caption: '' });
});

test('Price on request is a badge too; no price means no badge', () => {
  assert.deepEqual(splitProductCaption('Custom work.\nPrice on request', 'Mural'), { price: PRICE_ON_REQUEST, caption: 'Custom work.' });
  assert.deepEqual(splitProductCaption('Custom work.', 'Mural'), { price: '', caption: 'Custom work.' });
  assert.deepEqual(splitProductCaption(null, 'Mural'), { price: '', caption: '' });
});

test('the last Price line is the one the API added', () => {
  assert.deepEqual(splitProductCaption('Price: was $90\nNow on sale.\nPrice: $65 CAD', 'X'), { price: '$65 CAD', caption: 'Price: was $90\nNow on sale.' });
});

test('plain text keeps line breaks and drops tags', () => {
  assert.equal(plainText('<p>Hard wax &amp; care.</p><p>Includes hands.</p>'), 'Hard wax & care.\nIncludes hands.');
  assert.equal(plainText(null), '');
});

test('the shown price follows Show the price and Price on request', () => {
  assert.equal(shownPrice({ price_label: '$65 CAD' }), '$65 CAD');
  assert.equal(shownPrice({ price_label: '$65 CAD', show_price: false }), '');
  assert.equal(shownPrice({ price_label: '$65 CAD', price_on_request: true }), PRICE_ON_REQUEST);
  assert.equal(shownPrice({ price_label: '' }), '');
});
