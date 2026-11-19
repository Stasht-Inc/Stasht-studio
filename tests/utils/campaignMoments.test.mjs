// tests/utils/campaignMoments.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
// Chris, 19 Nov 2026: Media panel sizes (12b), where Add a Moment inserts (10), Choose a Moment targets (13a),
// the Media panel's 2 / 3 columns remembered per viewer (12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatStoredSize, momentInsertAtStart, chooseMomentTargets, readMediaColumns, saveMediaColumns, MEDIA_COLUMNS_KEY,
} from '../../utils/campaignMoments.ts';

test('sizes are stored in MB: a 4032x3024 photo reads 3.4 MB, not "3 B"', () => {
  assert.equal(formatStoredSize(3.37), '3.4 MB');
  assert.equal(formatStoredSize('3.37'), '3.4 MB');
  assert.equal(formatStoredSize(3), '3 MB');
  assert.equal(formatStoredSize('4.00'), '4 MB');
  assert.equal(formatStoredSize(0.25), '256 KB');
  assert.equal(formatStoredSize(2048), '2 GB');
});

test('a byte count (old rows) is still read as bytes', () => {
  assert.equal(formatStoredSize(2515456), '2.4 MB');
  assert.equal(formatStoredSize('3538944'), '3.4 MB');
});

test('unknown size: nothing (no made-up 2.4 MB); an already formatted size is kept', () => {
  for (const v of [0, '0', null, undefined, '', 'abc', NaN, -1]) assert.equal(formatStoredSize(v), '');
  assert.equal(formatStoredSize('3.4 MB'), '3.4 MB');
});

test('only the top "+" (no moment above, atStart) puts the moment first', () => {
  assert.equal(momentInsertAtStart(null, { atStart: true }), true);
  assert.equal(momentInsertAtStart(undefined, { atStart: true }), true);
  assert.equal(momentInsertAtStart('42', { atStart: true }), false, 'the "+" under moment 42: after_post_id');
  assert.equal(momentInsertAtStart(null, { afterWidgetId: '7' }), false, 'after a top widget: no start');
  assert.equal(momentInsertAtStart(null, null), false, 'the header button: the end');
  assert.equal(momentInsertAtStart(null, undefined), false);
});

test('Choose a Moment never lists the photo itself', () => {
  const moments = [{ id: '1', title: 'Add-flour' }, { id: 2, title: 'add-salt-flour' }, { id: '3', title: 'stir-flour' }];
  assert.deepEqual(chooseMomentTargets(moments, '2').map((m) => m.title), ['Add-flour', 'stir-flour']);
  assert.deepEqual(chooseMomentTargets(moments, 9).length, 3);
});

test('2 / 3 columns are remembered, 2 by default, and broken storage never throws', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(readMediaColumns(storage), 2);
  saveMediaColumns(3, storage);
  assert.equal(store.get(MEDIA_COLUMNS_KEY), '3');
  assert.equal(readMediaColumns(storage), 3);
  saveMediaColumns(2, storage);
  assert.equal(readMediaColumns(storage), 2);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readMediaColumns(broken), 2);
  assert.doesNotThrow(() => saveMediaColumns(3, broken));
  assert.equal(readMediaColumns(null), 2);
});
