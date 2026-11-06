// Chris (6 Nov, point 4): "Custom" opened Chrome's own colour picker, which shows RGB first and can't be switched to HEX.
// It is now Studio's own small picker (a colour area, a hue strip and a HEX field shown first), and every colour picked
// with it is offered again in every colour panel: newest first, no repeats (any case), at most 8 (the API's
// NewsletterRecentColors). Pure helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_RECENT_COLORS, addRecentColor, hexToHsv, hsvToHex, parseHexInput, recentColorsFrom } from '../../components/newsletters/lib/colorPicker.ts';

test('the HEX field takes #RRGGBB with or without the #, any case, and nothing else', () => {
  assert.equal(parseHexInput('#ebf4ff'), '#EBF4FF');
  assert.equal(parseHexInput('EBF4FF'), '#EBF4FF');
  assert.equal(parseHexInput('  #6c60ff '), '#6C60FF');
  for (const bad of ['', '#', '#12345', '1234567', '#12345g', 'red', 'rgb(1,2,3)', '##123456', '#123456;', null, undefined, 123456]) {
    assert.equal(parseHexInput(bad), null, String(bad));
  }
});

test('recent colours: newest first, no repeats in any case, at most 8', () => {
  assert.equal(MAX_RECENT_COLORS, 8);
  assert.deepEqual(addRecentColor([], '#ebf4ff'), ['#EBF4FF']);
  assert.deepEqual(addRecentColor(['#112233', '#EBF4FF'], '#ebf4ff'), ['#EBF4FF', '#112233']);
  const ten = Array.from({ length: 10 }, (_, i) => `#0000${String(i).padStart(2, '0')}`);
  const list = ten.reduce((acc, c) => addRecentColor(acc, c), []);
  assert.deepEqual(list, ['#000009', '#000008', '#000007', '#000006', '#000005', '#000004', '#000003', '#000002']);
  // A bad colour changes nothing.
  assert.deepEqual(addRecentColor(['#112233'], 'red'), ['#112233']);
});

test('recent colours from the API are checked again (valid, uppercase, no repeats, at most 8)', () => {
  assert.deepEqual(recentColorsFrom(['#abcdef', '#ABCDEF', 'red', 7, '#123456']), ['#ABCDEF', '#123456']);
  assert.deepEqual(recentColorsFrom(null), []);
  assert.deepEqual(recentColorsFrom('nope'), []);
  assert.equal(recentColorsFrom(Array.from({ length: 12 }, (_, i) => `#1111${String(i).padStart(2, '0')}`)).length, 8);
});

test('HEX ⇄ HSV (the colour area and hue strip) round-trips', () => {
  assert.deepEqual(hexToHsv('#FF0000'), { h: 0, s: 1, v: 1 });
  assert.deepEqual(hexToHsv('#000000'), { h: 0, s: 0, v: 0 });
  assert.deepEqual(hexToHsv('#FFFFFF'), { h: 0, s: 0, v: 1 });
  assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), '#00FF00');
  assert.equal(hsvToHex({ h: 240, s: 1, v: 0.5 }), '#000080');
  for (const hex of ['#6C60FF', '#EBF4FF', '#111827', '#F59E0B', '#059669', '#DC2626', '#123456', '#FEDCBA']) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex, hex);
  }
  // Out-of-range input is clamped, never NaN.
  assert.match(hsvToHex({ h: 400, s: 2, v: -1 }), /^#[0-9A-F]{6}$/);
});
