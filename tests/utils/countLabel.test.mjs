// tests/utils/countLabel.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Counts on the Users page tabs read as English: "1 property", "2 properties" (Chris, 1 Nov 2026: "1 properties").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLabel } from '../../utils/countLabel.ts';

test('one is singular, everything else plural', () => {
  assert.equal(countLabel(1, 'property', 'properties'), '1 property');
  assert.equal(countLabel(0, 'property', 'properties'), '0 properties');
  assert.equal(countLabel(2, 'property', 'properties'), '2 properties');
  assert.equal(countLabel(1, 'campaign'), '1 campaign');
  assert.equal(countLabel(3, 'campaign'), '3 campaigns', 'the plural defaults to word + s');
  assert.equal(countLabel(1, 'external account'), '1 external account');
  assert.equal(countLabel(4, 'external account'), '4 external accounts');
});

test('large counts get thousands separators; odd input counts as 0', () => {
  assert.equal(countLabel(1234, 'user'), '1,234 users');
  assert.equal(countLabel(Number.NaN, 'user'), '0 users');
  assert.equal(countLabel(undefined, 'user'), '0 users');
  assert.equal(countLabel('1', 'property', 'properties'), '1 property');
});
