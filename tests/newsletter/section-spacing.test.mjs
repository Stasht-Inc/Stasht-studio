// Chris (7 Nov, point 2): "Add spacing so we can make gaps smaller between rows. Add padding so we can decrease padding
// on top and bottom." One Spacing menu on the Title and Text toolbars (line spacing + section padding); a Padding switch
// on Button, Divider and Campaigns. The same keys, rules and numbers as the API (NewsletterSpacing), so the editor
// draws what the email shows. Normal is never stored: an older section stays exactly as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINE_SPACING_OPTIONS, PADDING_OPTIONS, lineHeight, paddingPx, spacingOf, spacingPatch, textSpacingStyle, spanLineHeight, toolbarGap,
} from '../../components/newsletters/lib/sectionSpacing.ts';
import { sectionLook } from '../../components/newsletters/lib/sectionStyle.ts';
import { blocksToInput, normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';

test('the choices: Tight / Normal / Relaxed and None / Small / Normal / Large', () => {
  assert.deepEqual(LINE_SPACING_OPTIONS.map((o) => [o.value, o.label]), [['tight', 'Tight'], ['normal', 'Normal'], ['relaxed', 'Relaxed']]);
  assert.deepEqual(PADDING_OPTIONS.map((o) => [o.value, o.label]), [['none', 'None'], ['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']]);
});

test('keys: kept when not normal, bad ones dropped; line spacing only on sections with words (like the API)', () => {
  assert.deepEqual(spacingOf({ line_spacing: 'tight', padding: 'none' }, true), { line_spacing: 'tight', padding: 'none' });
  assert.deepEqual(spacingOf({ line_spacing: 'normal', padding: 'normal' }, true), {});
  assert.deepEqual(spacingOf({ line_spacing: 'double', padding: '0px' }, true), {});
  assert.deepEqual(spacingOf({ line_spacing: 'relaxed', padding: 'large' }, false), { padding: 'large' });
});

test('spacingPatch: Normal removes the key (undefined, which JSON leaves out)', () => {
  assert.deepEqual(spacingPatch({ line_spacing: 'tight' }), { line_spacing: 'tight' });
  assert.deepEqual(spacingPatch({ line_spacing: 'normal' }), { line_spacing: undefined });
  assert.deepEqual(spacingPatch({ padding: 'normal' }), { padding: undefined });
  assert.equal(JSON.stringify(spacingPatch({ padding: 'normal' })), '{}');
});

test('the numbers match NewsletterSpacing', () => {
  assert.equal(lineHeight(16, 26, 'tight'), 22);
  assert.equal(lineHeight(16, 26, null), 26);
  assert.equal(lineHeight(16, 26, 'relaxed'), 32);
  assert.equal(lineHeight(14, 22, 'tight'), 18.5);
  assert.equal(lineHeight(24, 34, 'tight'), 28.8);
  assert.equal(lineHeight(20, 30, 'relaxed'), 37.5);
  assert.equal(lineHeight(28, 36, 'tight'), 33.6);
  assert.equal(lineHeight(28, 36, 'relaxed'), 46.5);
  assert.deepEqual(['none', 'small', undefined, 'large'].map((p) => paddingPx(12, p)), [0, 6, 12, 24]);
  assert.deepEqual(['none', 'small', undefined, 'large'].map((p) => paddingPx(24, p)), [0, 12, 24, 40]);
  assert.deepEqual(['none', 'small', undefined, 'large'].map((p) => paddingPx(40, p)), [0, 20, 40, 64]);
});

test('sized words in the editor: their line height follows the section spacing through CSS variables', () => {
  // Normal (no variables set) is the usual line height; tight / relaxed resolve to lineHeight() in the browser.
  assert.equal(spanLineHeight(20, 30), 'max(calc(30px + var(--nl-lh-k, 0) * 20px), calc(var(--nl-lh-min, 0) * 20px))');
  assert.deepEqual(textSpacingStyle(null), {});
  assert.deepEqual(textSpacingStyle('tight'), { lineHeight: '22px', '--nl-lh-k': '-0.25', '--nl-lh-min': '1.2', '--nl-gap': '8px', '--nl-row': '2px' });
  assert.deepEqual(textSpacingStyle('relaxed'), { lineHeight: '32px', '--nl-lh-k': '0.375', '--nl-lh-min': '0', '--nl-gap': '24px', '--nl-row': '12px' });
});

test('sectionLook: padding sets the room above and below and makes the section styled', () => {
  assert.equal(sectionLook({ text: 'x' }, true, '#111827').padY, 12);
  assert.equal(sectionLook({ text: 'x' }, true, '#111827').styled, false);
  const plain = sectionLook({ text: 'x', padding: 'small' }, true, '#111827');
  assert.equal(plain.padY, 6);
  assert.equal(plain.styled, true);
  assert.equal(sectionLook({ text: 'x', background_color: '#4A2F1F', padding: 'none' }, true, '#111827').padY, 0);
  assert.equal(sectionLook({ text: 'x', background_color: '#4A2F1F', padding: 'large' }, true, '#111827').padY, 40);
  assert.equal(sectionLook({ text: 'x', background_image_url: 'https://a.example/x.jpg', padding: 'small' }, true, '#111827').padY, 20);
  assert.equal(sectionLook({ html: 'x', line_spacing: 'tight' }, false, '#374151').styled, true);
});

test('normaliseBlocks keeps the keys; blocksToInput sends a Campaigns section\'s padding; older blocks are unchanged', () => {
  const blocks = normaliseBlocks([
    { id: 't', type: 'title', data: { text: 'A', size: 'large', line_spacing: 'tight', padding: 'none' } },
    { id: 'x', type: 'text', data: { html: '<p>B</p>', line_spacing: 'relaxed', padding: 'large' } },
    { id: 'u', type: 'button', data: { label: 'Go', url: 'https://a.example', color: '#6C60FF', padding: 'small', line_spacing: 'tight' } },
    { id: 'd', type: 'divider', data: { style: 'line', padding: 'large' } },
    { id: 'c', type: 'campaigns', data: { selections: [{ kind: 'campaign', id: 5 }], columns: 1, padding: 'none' } },
    { id: 'i', type: 'image', data: { url: 'https://a.example/x.jpg', alt: '', link: null, padding: 'large' } },
    { id: 'o', type: 'text', data: { html: '<p>Old</p>' } },
  ]);
  assert.deepEqual(blocks[0].data, { text: 'A', size: 'large', line_spacing: 'tight', padding: 'none' });
  assert.deepEqual(blocks[1].data, { html: '<p>B</p>', line_spacing: 'relaxed', padding: 'large' });
  assert.equal(blocks[2].data.padding, 'small');
  assert.equal('line_spacing' in blocks[2].data, false);
  assert.deepEqual(blocks[3].data, { style: 'line', padding: 'large' });
  assert.equal(blocks[4].data.padding, 'none');
  assert.equal('padding' in blocks[5].data, false, 'a picture has no padding option');
  assert.deepEqual(blocks[6].data, { html: '<p>Old</p>' });
  assert.equal(blocksToInput(blocks)[4].data.padding, 'none');
  assert.equal('padding' in blocksToInput([{ id: 'c', type: 'campaigns', data: { selections: [], campaign_ids: [] } }])[0].data, false);
});

test('while editing, the style toolbar clears the move / delete buttons even with no padding', () => {
  assert.equal(toolbarGap(12), 8, 'the usual 8 px (as before)');
  assert.equal(toolbarGap(24), 8);
  assert.equal(toolbarGap(6), 14);
  assert.equal(toolbarGap(0), 20);
});
