// tests/utils/visualViewport.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheetBoxForVisualViewport } from '../../utils/visualViewport.ts';

test('phone: follows the visual viewport (keyboard open)', () => {
  assert.deepEqual(sheetBoxForVisualViewport({ height: 508.4, offsetTop: 0 }, 390), { top: 0, height: 508 });
  assert.deepEqual(sheetBoxForVisualViewport({ height: 500, offsetTop: 120.6 }, 390), { top: 121, height: 500 });
});

test('phone: negative offsets (rubber-band) clamp to 0', () => {
  assert.deepEqual(sheetBoxForVisualViewport({ height: 844, offsetTop: -12 }, 390), { top: 0, height: 844 });
});

test('no override on wide screens, without visualViewport, or on a zero reading', () => {
  assert.equal(sheetBoxForVisualViewport({ height: 700, offsetTop: 0 }, 1280), null);
  assert.equal(sheetBoxForVisualViewport({ height: 700, offsetTop: 0 }, 768), null);
  assert.equal(sheetBoxForVisualViewport(null, 390), null);
  assert.equal(sheetBoxForVisualViewport(undefined, 390), null);
  assert.equal(sheetBoxForVisualViewport({ height: 0, offsetTop: 0 }, 390), null);
});
