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

// Chris, 9 Nov 2026 (point 7): the sheet only follows the visual viewport while the keyboard is up (a text field
// is focused). Otherwise it fills the screen — a stale/short visualViewport (iOS after the keyboard closes, home-screen
// app) must not leave the campaign page showing under it.
import { keyboardSheetBox, isKeyboardEditable, keyboardClosedResize } from '../../utils/visualViewport.ts';

test('keyboardSheetBox: no override unless a text field is being edited', () => {
  assert.equal(keyboardSheetBox({ height: 520, offsetTop: 0 }, 390, false), null);
  assert.equal(keyboardSheetBox({ height: 844, offsetTop: 0 }, 390, false), null);
  assert.deepEqual(keyboardSheetBox({ height: 508.4, offsetTop: 0 }, 390, true), { top: 0, height: 508 });
  assert.deepEqual(keyboardSheetBox({ height: 500, offsetTop: 120.6 }, 390, true), { top: 121, height: 500 });
  assert.equal(keyboardSheetBox({ height: 500, offsetTop: 0 }, 1280, true), null);
  assert.equal(keyboardSheetBox(null, 390, true), null);
});

test('isKeyboardEditable: text fields yes, buttons/checkboxes/radios no', () => {
  const el = (tagName, extra = {}) => ({ tagName, ...extra });
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'text' })), true);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'email' })), true);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'tel' })), true);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'search' })), true);
  assert.equal(isKeyboardEditable(el('INPUT', {})), true);
  assert.equal(isKeyboardEditable(el('TEXTAREA')), true);
  assert.equal(isKeyboardEditable(el('DIV', { isContentEditable: true })), true);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'checkbox' })), false);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'radio' })), false);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'button' })), false);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'file' })), false);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'text', readOnly: true })), false);
  assert.equal(isKeyboardEditable(el('INPUT', { type: 'text', disabled: true })), false);
  assert.equal(isKeyboardEditable(el('BUTTON')), false);
  assert.equal(isKeyboardEditable(el('DIV')), false);
  assert.equal(isKeyboardEditable(el('SECTION', { isContentEditable: false })), false);
  assert.equal(isKeyboardEditable(null), false);
  assert.equal(isKeyboardEditable(undefined), false);
});

test('keyboardClosedResize: the visual viewport grew by a keyboard, not by a toolbar', () => {
  assert.equal(keyboardClosedResize(520, 844), true);
  assert.equal(keyboardClosedResize(600, 844), true);
  assert.equal(keyboardClosedResize(750, 844), false); // Safari toolbar collapsing
  assert.equal(keyboardClosedResize(844, 520), false); // keyboard opening
  assert.equal(keyboardClosedResize(0, 844), false); // first reading
});
