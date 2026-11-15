// tests/products/premerge.test.mjs — pre-merge fixes (15 Nov): D1 External view status filter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterStatusesFor } from '../../utils/products.ts';

test('D1: the External view offers only statuses its active-only list can match; the account keeps every one', () => {
  assert.deepEqual(filterStatusesFor(true), ['active', 'draft', 'out_of_stock', 'archived']);
  assert.deepEqual(filterStatusesFor(false), ['active', 'out_of_stock']);
});
