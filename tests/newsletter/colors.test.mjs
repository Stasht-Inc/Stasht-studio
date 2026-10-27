import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_SWATCHES, DEFAULT_BUTTON_COLOR, safeHexColor, contrastInk } from '../../components/newsletters/lib/colors.ts';

test('safeHexColor accepts #RRGGBB only', () => {
  assert.equal(safeHexColor('#6C60FF', '#000000'), '#6C60FF');
  assert.equal(safeHexColor(' #6c60ff ', '#000000'), '#6c60ff');
  assert.equal(safeHexColor('purple', '#000000'), '#000000');
  assert.equal(safeHexColor('#fff', '#000000'), '#000000');
  assert.equal(safeHexColor('#6C60FF;background:url(x)', '#000000'), '#000000');
  assert.equal(safeHexColor(null, ''), '');
});

// Same rule and colours as the email (NewsletterRenderer::contrast), so the preview matches what people get.
test('contrastInk picks readable text like the email renderer', () => {
  assert.equal(contrastInk('#6C60FF'), '#FFFFFF');
  assert.equal(contrastInk('#ffffff'), '#1F2937');
  assert.equal(contrastInk('#F59E0B'), '#1F2937');
  assert.equal(contrastInk('#059669'), '#FFFFFF');
  assert.equal(contrastInk('bogus'), '#FFFFFF');
});

test('swatches start with Stasht purple', () => {
  assert.equal(DEFAULT_BUTTON_COLOR, '#6C60FF');
  assert.deepEqual(COLOR_SWATCHES[0], { value: '#6C60FF', name: 'Purple' });
  assert.equal(COLOR_SWATCHES.length, 6);
  assert.ok(COLOR_SWATCHES.every((s) => /^#[0-9A-F]{6}$/.test(s.value)), 'upper-case hex, as the API stores it');
});
