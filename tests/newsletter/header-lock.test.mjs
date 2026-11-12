// Chris 12 Nov: property accounts use the main account's header, locked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerLockOf } from '../../components/newsletters/lib/headerLock.ts';

const lock = { by: 'Serpa Chrysler', message: 'Header set by Serpa Chrysler' };

test('the draft decides once it exists, else the brand', () => {
  assert.deepEqual(headerLockOf(null, { header_locked: lock }), lock, 'new draft: the brand');
  assert.deepEqual(headerLockOf({ header_locked: lock }, null), lock);
  assert.equal(headerLockOf({}, { header_locked: lock }), null, 'an existing personal draft stays editable');
  assert.equal(headerLockOf({ header_locked: null }, { header_locked: lock }), null);
});

test('no lock, or a malformed one, keeps the header editable', () => {
  assert.equal(headerLockOf(null, null), null);
  assert.equal(headerLockOf(null, {}), null);
  assert.equal(headerLockOf({ header_locked: { by: 'x' } }, null), null);
  assert.equal(headerLockOf({ header_locked: { by: 'x', message: '  ' } }, null), null);
});
