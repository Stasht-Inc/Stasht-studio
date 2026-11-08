// tests/utils/productCardButton.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
// Chris, 8 Nov 2026 (point 3): a product's "View on website" button sits INSIDE its moment card, not in a second card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isInCardProductButton, productButtonsByPost } from '../../utils/productCardButton.ts';

const cta = (id, after, data = {}, extra = {}) => ({ id, widget_type: 'cta', after_post_id: after, widget_order: 0, widget_data: { buttonText: 'View on website', buttonLink: 'https://shop.example.com/p', ...data }, is_visible: true, ...extra });

test('the API mark (in_card) or the stored placement makes a product button', () => {
  assert.equal(isInCardProductButton(cta(1, 10, {}, { in_card: true })), true);
  assert.equal(isInCardProductButton(cta(2, 10, { placement: 'in_card' })), true); // before the API marks it (Studio deployed first)
});

test("the owner's own Call to Action stays a card, even with the same words", () => {
  assert.equal(isInCardProductButton(cta(3, 10)), false);
  assert.equal(isInCardProductButton(cta(4, 10, {}, { in_card: false })), false);
});

test('never: at the top (no card), Share Request a Moment, other widget types, hidden ones', () => {
  assert.equal(isInCardProductButton(cta(5, null, {}, { in_card: true })), false);
  assert.equal(isInCardProductButton(cta(6, 10, { mode: 'request_moment' }, { in_card: true })), false);
  assert.equal(isInCardProductButton({ id: 7, widget_type: 'quote', after_post_id: 10, widget_data: { placement: 'in_card' }, in_card: true }), false);
  assert.equal(isInCardProductButton(cta(8, 10, {}, { in_card: true, is_visible: false })), false);
  assert.equal(isInCardProductButton(cta(9, 10, {}, { in_card: true, is_visible: 0 })), false);
  assert.equal(isInCardProductButton(null), false);
});

test('one button per moment, keyed by the moment id; everything else is left for the timeline', () => {
  const widgets = [cta(1, 10, {}, { in_card: true }), cta(2, 10), cta(3, 11, {}, { in_card: true }), cta(4, 11, {}, { in_card: true }), { id: 5, widget_type: 'html', after_post_id: 10, widget_data: {} }];
  const { byPost, rest } = productButtonsByPost(widgets);
  assert.deepEqual([...byPost.keys()], ['10', '11']);
  assert.equal(byPost.get('10').id, 1);
  assert.equal(byPost.get('11').id, 3);
  // A second marked button on the same moment (shouldn't happen) is never dropped: it stays a card.
  assert.deepEqual(rest.map((w) => w.id), [2, 4, 5]);
});

test('also takes the campaign page\'s mapped widgets (afterPostId + inCard)', () => {
  const mapped = [{ id: '1', afterPostId: '10', inCard: true, mode: 'link' }, { id: '2', afterPostId: '10', inCard: false, mode: 'link' }];
  const { byPost, rest } = productButtonsByPost(mapped);
  assert.equal(byPost.get('10').id, '1');
  assert.deepEqual(rest.map((w) => w.id), ['2']);
});
