// tests/utils/productEnquiry.test.mjs — Chris 16 Nov 2026 (point 4): the public page's Enquire button.
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENQUIRY_SENT, enquiryErrors, enquiryMessage, enquirePostMap } from '../../utils/productEnquiry.ts';

test('the message starts with the product', () => {
  assert.equal(enquiryMessage('Oak Table'), "Hi, I'm interested in Oak Table.");
  assert.equal(enquiryMessage('  '), "Hi, I'm interested in this product.");
  assert.equal(enquiryMessage(null), "Hi, I'm interested in this product.");
});

test('enquire_products becomes a post id → title map; junk is skipped', () => {
  const m = enquirePostMap([{ post_id: 12, title: 'Chair' }, { post_id: '13', title: null }, null, { title: 'x' }, { post_id: 0 }]);
  assert.deepEqual([...m.entries()], [['12', 'Chair'], ['13', '']]);
  assert.equal(enquirePostMap(undefined).size, 0);
  assert.equal(enquirePostMap({}).size, 0);
});

test('server errors: field ones under their field, the rest at the bottom', () => {
  assert.deepEqual(enquiryErrors(422, { message: 'x', errors: { phone: ['Enter a valid phone number, including the area code.'] } }),
    { fields: { contact: 'Enter a valid phone number, including the area code.' }, general: '' });
  assert.deepEqual(enquiryErrors(422, { errors: { name: ['Enter your name.'], email: ['Bad'] } }),
    { fields: { name: 'Enter your name.', contact: 'Bad' }, general: '' });
  assert.deepEqual(enquiryErrors(422, { code: 'enquire_off', message: 'This product is not taking enquiries.' }),
    { fields: {}, general: 'This product is not taking enquiries.' });
  assert.equal(enquiryErrors(404, { message: 'Product not found.' }).general, 'This product is no longer available.');
  assert.equal(enquiryErrors(429, null).general, 'Too many tries. Please wait a minute and try again.');
  assert.equal(enquiryErrors(500, null).general, 'Something went wrong. Please try again.');
  assert.equal(ENQUIRY_SENT, "Thanks! We'll be in touch.");
});
