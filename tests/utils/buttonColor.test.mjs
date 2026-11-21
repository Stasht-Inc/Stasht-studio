// tests/utils/buttonColor.test.mjs — Chris 21 Nov 2026 (R2-2): product buttons in the product's / brand colour.
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BUTTON_COLOR, buttonColors, buttonTextOn, hexColor, outlineColors } from '../../utils/buttonColor.ts';
import { enquireColorMap } from '../../utils/productEnquiry.ts';
import { previewCardButtons } from '../../components/storeel/lib/storeelWidgets.ts';

test('colours are read as #RRGGBB only', () => {
  assert.equal(hexColor('#2e7d32'), '#2E7D32');
  assert.equal(hexColor('2e7d32'), '#2E7D32');
  assert.equal(hexColor('#abc'), '#AABBCC');
  assert.equal(hexColor('red'), null);
  assert.equal(hexColor('#12345'), null);
  assert.equal(hexColor('url(x)'), null);
  assert.equal(hexColor(null), null);
});

test('the words stay readable: white on dark, near-black on light', () => {
  assert.equal(buttonTextOn('#2E7D32'), '#FFFFFF');
  assert.equal(buttonTextOn('#6C60FF'), '#FFFFFF');
  assert.equal(buttonTextOn('#F5C518'), '#1F2937');
  assert.equal(buttonTextOn('#FFFFFF'), '#1F2937');
});

test('a button: its colour, else the fallback, else purple; given words win', () => {
  assert.deepEqual(buttonColors('#2E7D32'), { background: '#2E7D32', text: '#FFFFFF' });
  assert.deepEqual(buttonColors(null, null, '#F5C518'), { background: '#F5C518', text: '#1F2937' });
  assert.deepEqual(buttonColors(undefined), { background: DEFAULT_BUTTON_COLOR, text: '#FFFFFF' });
  assert.deepEqual(buttonColors('#0D47A1', '#FFEB3B'), { background: '#0D47A1', text: '#FFEB3B' });
});

test('the outlined Enquire: coloured border, words in the colour unless it is too light', () => {
  assert.deepEqual(outlineColors('#2E7D32'), { border: '#2E7D32', text: '#2E7D32' });
  assert.deepEqual(outlineColors('#F5C518'), { border: '#F5C518', text: '#1F2937' });
  assert.deepEqual(outlineColors(null), { border: '#6C60FF', text: '#6C60FF' });
});

test('enquire colours by post id; entries without a valid colour are left out', () => {
  const m = enquireColorMap([
    { post_id: 5, title: 'A', button_color: '#2e7d32' },
    { post_id: 6, title: 'B' },
    { post_id: 7, title: 'C', button_color: 'red' },
    null, 'x',
  ]);
  assert.deepEqual([...m.entries()], [['5', '#2E7D32']]);
  assert.equal(enquireColorMap(undefined).size, 0);
});

test('the Storeel preview gets the in-card button colours the campaign page got', () => {
  const m = previewCardButtons([
    { id: '1', afterPostId: '10', inCard: true, mode: 'link', buttonText: 'Visit', cardColor: '#3E2723', cardTextColor: '#FFFFFF' },
    { id: '2', afterPostId: '11', inCard: true, mode: 'link', buttonText: '' },
  ]);
  assert.deepEqual(m.get('10'), { buttonText: 'Visit', buttonColor: '#3E2723', textColor: '#FFFFFF' });
  assert.deepEqual(m.get('11'), { buttonText: 'View on website' });
});

test('a newsletter product card uses its chosen colour, others the section colour', async () => {
  const { cardButtonColor, itemFromOption } = await import('../../components/newsletters/lib/campaignsBlock.ts');
  assert.equal(cardButtonColor({ kind: 'product', button_color: '#b71c1c' }, '#1F2937'), '#B71C1C');
  assert.equal(cardButtonColor({ kind: 'product' }, '#1F2937'), '#1F2937');
  assert.equal(cardButtonColor({ kind: 'vehicle', button_color: '#B71C1C' }, '#1F2937'), '#1F2937');
  assert.equal(cardButtonColor({ kind: 'product', button_color: 'red' }, '#1F2937'), '#1F2937');
  const picked = itemFromOption({ kind: 'product', id: 1, title: 'Chair', description: null, cover_url: null, date: null, public_url: 'https://shop.example/chair', shareable: true, reason: null, button_color: '#B71C1C' });
  assert.equal(picked.button_color, '#B71C1C');
});
