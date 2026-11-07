// Chris (7 Nov, point 4): "WE should be able to edit small, normal, large, x-large and make it whatever size we want,
// and it affects the entire H-class". One scale (Small / Normal / Large / X-Large) per newsletter, the same numbers and
// rules as the API (NewsletterTypeScale): Text spans name their style (<span data-size="large">), older px spans count
// as the style they were, Titles follow Large / X-Large in the proportions they always had.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPE_SCALE_MIN, TYPE_SCALE_MAX, USUAL_SCALE, scaleOf, storedScale, styleLineHeight, titlePx, titleLineHeight, scaleVars,
  sizeVar, lineHeightVar, titleSizeVar, titleLineHeightVar, parsePxInput, stepPx, sameScale, styleOfPx,
} from '../../components/newsletters/lib/typeScale.ts';
import { parseTextHtml, resizeTextHtml, sanitizeTextHtml, serializeTextNodes, spanOpen, fontTextHtml } from '../../components/newsletters/lib/textHtml.ts';
import { draftFromNewsletter, draftToInput, emptyDraft, changedFields, mergeUntouched } from '../../components/newsletters/lib/draft.ts';

const GEORGIA = "Georgia, 'Times New Roman', Times, serif";

test('the usual scale is the px the email always used, with its line heights', () => {
  assert.deepEqual(USUAL_SCALE, { small: 14, normal: 16, large: 20, xlarge: 24 });
  assert.deepEqual(['small', 'normal', 'large', 'xlarge'].map((s) => styleLineHeight(s, USUAL_SCALE[s])), [22, 26, 30, 34]);
  assert.deepEqual(['small', 'medium', 'large'].map((s) => titlePx(USUAL_SCALE, s)), [18, 22, 28]);
  assert.equal(titleLineHeight(22), 30);
  assert.equal(TYPE_SCALE_MIN, 10);
  assert.equal(TYPE_SCALE_MAX, 72);
});

test('a changed style changes its line height and the titles that follow it (as the API rounds)', () => {
  const scale = scaleOf({ large: 22, xlarge: 30 });
  assert.deepEqual(scale, { small: 14, normal: 16, large: 22, xlarge: 30 });
  assert.equal(styleLineHeight('large', 22), 33);
  assert.equal(styleLineHeight('xlarge', 30), 43);
  assert.equal(styleLineHeight('small', 12), 19);
  assert.equal(styleLineHeight('normal', 17), 28);
  assert.deepEqual(['small', 'medium', 'large'].map((s) => titlePx(scale, s)), [20, 28, 35]);
});

test('only whole px from 10 to 72 count; the usual scale is not stored', () => {
  assert.deepEqual(scaleOf({ small: 9, normal: 73, large: '22', xlarge: 22.5, huge: 40 }), USUAL_SCALE);
  assert.deepEqual(scaleOf(null), USUAL_SCALE);
  assert.equal(storedScale(null), null);
  assert.equal(storedScale({ small: 14 }), null);
  assert.deepEqual(storedScale({ normal: 17 }), { small: 14, normal: 17, large: 20, xlarge: 24 });
  assert.equal(sameScale(scaleOf({}), USUAL_SCALE), true);
  assert.equal(sameScale(scaleOf({ small: 12 }), USUAL_SCALE), false);
});

test('the px field: whole numbers in range; the steppers stop at the edges', () => {
  assert.equal(parsePxInput('22'), 22);
  assert.equal(parsePxInput(' 22 px '), 22);
  assert.equal(parsePxInput('9'), null);
  assert.equal(parsePxInput('73'), null);
  assert.equal(parsePxInput('2.5'), null);
  assert.equal(parsePxInput(''), null);
  assert.equal(stepPx(20, 1), 21);
  assert.equal(stepPx(72, 1), 72);
  assert.equal(stepPx(10, -1), 10);
});

test('the editor draws every style through CSS variables set from the newsletter\'s scale', () => {
  const vars = scaleVars(scaleOf({ large: 22, xlarge: 30 }));
  assert.equal(vars['--nl-size-large'], '22px');
  assert.equal(vars['--nl-lh-large'], '33px');
  assert.equal(vars['--nl-size-normal'], '16px');
  assert.equal(vars['--nl-title-large'], '35px');
  assert.equal(vars['--nl-title-lh-large'], '43px');
  assert.equal(sizeVar('large'), 'var(--nl-size-large, 20px)');
  assert.equal(lineHeightVar('large'), 'var(--nl-lh-large, 30px)');
  assert.equal(titleSizeVar('medium'), 'var(--nl-title-medium, 22px)');
  assert.equal(titleLineHeightVar('medium'), 'var(--nl-title-lh-medium, 30px)');
  assert.equal(styleOfPx(20), 'large');
  assert.equal(styleOfPx(18), null);
});

test('text spans name their style (data-size); older px spans are read as the style they were', () => {
  // Review I3: the style's usual px too, so an older Studio (a stale PWA load) or the app editor keeps the size.
  assert.equal(spanOpen(20, null), '<span data-size="large" style="font-size:20px">');
  assert.equal(spanOpen(14, 'georgia'), `<span data-size="small" style="font-size:14px;font-family:${GEORGIA}">`);
  assert.equal(spanOpen(null, 'georgia'), `<span style="font-family:${GEORGIA}">`);
  assert.deepEqual(parseTextHtml('<span data-size="xlarge">a</span>'), [{ kind: 'size', px: 24, children: [{ kind: 'text', text: 'a' }] }]);
  // Older px spans: kept as their style, written in the new form.
  assert.equal(sanitizeTextHtml('<p><span style="font-size:20px">a</span> <span style="font-size:24px;font-family:Georgia">b</span></p>'),
    `<p><span data-size="large" style="font-size:20px">a</span> <span data-size="xlarge" style="font-size:24px;font-family:${GEORGIA}">b</span></p>`);
  // A style wins over a px; an unknown style is no size; other attributes go.
  assert.equal(sanitizeTextHtml('<p><span data-size="small" style="font-size:24px">a</span></p>'), '<p><span data-size="small" style="font-size:14px">a</span></p>');
  // A custom-scale px (Large = 22 here) is read by its style, written with the usual px (review M4: data-size first).
  assert.equal(sanitizeTextHtml('<p><span data-size="large" style="font-size:22px">a</span></p>'), '<p><span data-size="large" style="font-size:20px">a</span></p>');
  assert.equal(sanitizeTextHtml('<p><span data-size="huge">a</span><span data-size="Large">b</span></p>'), '<p>ab</p>');
  assert.equal(sanitizeTextHtml('<p><span data-size="large" class="x" onclick="y()">a</span></p>'), '<p><span data-size="large" style="font-size:20px">a</span></p>');
  // In the editor a span also carries the CSS variables it is drawn with: read as its style.
  assert.equal(sanitizeTextHtml('<p><span data-size="large" style="font-size: var(--nl-size-large, 20px); line-height: var(--nl-lh-large, 30px); font-family: Georgia, serif;">a</span></p>'),
    `<p><span data-size="large" style="font-size:20px;font-family:${GEORGIA}">a</span></p>`);
  // Round trip.
  const html = `<p>a <span data-size="large" style="font-size:20px">b</span> <span data-size="small" style="font-size:14px;font-family:${GEORGIA}">c</span></p>`;
  assert.equal(serializeTextNodes(parseTextHtml(html)), html);
});

test('sizing words writes the style, never a px', () => {
  assert.equal(resizeTextHtml('<p>Big savings</p>', 24, null), '<p><span data-size="xlarge" style="font-size:24px">Big savings</span></p>');
  assert.equal(resizeTextHtml('<p><span data-size="large">a</span> b</p>', 16, null), '<p>a b</p>');
  assert.equal(fontTextHtml('<p><span data-size="large">a</span></p>', 'georgia', null), `<p><span data-size="large" style="font-size:20px;font-family:${GEORGIA}">a</span></p>`);
});

test('a newsletter keeps its own scale: loaded, saved, and a new one takes the account default from the server', () => {
  assert.equal(emptyDraft().type_scale, null);
  const n = { name: 'N', header: {}, blocks: [], type_scale: { small: 14, normal: 17, large: 20, xlarge: 24 } };
  assert.deepEqual(draftFromNewsletter(n).type_scale, { small: 14, normal: 17, large: 20, xlarge: 24 });
  assert.equal(draftFromNewsletter({ name: 'Older', header: {}, blocks: [] }).type_scale, null);
  const d = { ...emptyDraft(), type_scale: { small: 14, normal: 16, large: 22, xlarge: 24 } };
  assert.deepEqual(draftToInput(d).type_scale, { small: 14, normal: 16, large: 22, xlarge: 24 });
  assert.equal(draftToInput(emptyDraft()).type_scale, null);
  // Only sent when it changed.
  assert.equal('type_scale' in changedFields(emptyDraft(), { ...emptyDraft(), name: 'x' }), false);
  assert.deepEqual(changedFields(emptyDraft(), d).type_scale, d.type_scale);
  // The server's (the account default) shows unless the sizes were already changed here.
  const server = { ...emptyDraft(), type_scale: { small: 12, normal: 16, large: 20, xlarge: 24 } };
  assert.deepEqual(mergeUntouched(emptyDraft(), server, new Set()).type_scale, server.type_scale);
  assert.deepEqual(mergeUntouched(d, server, new Set(['type_scale'])).type_scale, d.type_scale);
});

test('point 3: the usual font has a name (never "Default" alone), as Gmail names its own', async () => {
  const { fontLabel, DEFAULT_FONT_LABEL, fontOfLabel } = await import('../../components/newsletters/lib/fonts.ts');
  assert.equal(DEFAULT_FONT_LABEL, 'Sans Serif');
  assert.equal(fontLabel(null), 'Sans Serif');
  assert.equal(fontLabel('georgia'), 'Georgia');
  // It is no font key: a span or title never stores it.
  assert.equal(fontOfLabel('Sans Serif'), null);
});

test('review I1: joining paragraphs in Chrome keeps the moved words\' size (its copied span has the CSS variable only)', () => {
  // Chrome's own output (headless Chrome, Backspace at the start of a Large paragraph after a plain one).
  assert.equal(sanitizeTextHtml('<p>plain one<span style="font-size: var(--nl-size-large, 20px);">big two</span></p>'),
    '<p>plain one<span data-size="large" style="font-size:20px">big two</span></p>');
  assert.equal(sanitizeTextHtml('<p><span data-size="small" style="font-size: var(--nl-size-small, 14px); line-height: var(--nl-lh-small, 22px);">small one</span><span style="font-size: var(--nl-size-xlarge, 24px);">xl two</span></p>'),
    '<p><span data-size="small" style="font-size:14px">small one</span><span data-size="xlarge" style="font-size:24px">xl two</span></p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-size: var(--nl-size-huge, 20px);">a</span></p>'), '<p>a</p>');
  // Chrome also copies the section's base size (Normal) onto moved words: that is no size.
  assert.equal(sanitizeTextHtml('<p>a<span style="font-size: var(--nl-size-normal, 16px); line-height: var(--nl-lh-normal, 26px);">.</span></p>'), '<p>a.</p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-size: var(--nl-size-large, 20px); font-family: Georgia, serif;">a</span></p>'),
    `<p><span data-size="large" style="font-size:20px;font-family:${GEORGIA}">a</span></p>`);
});

test('review I2: a new, unsaved draft starts from the account\'s default sizes until they are changed', async () => {
  const { seedBrandTypeScale } = await import('../../components/newsletters/lib/draft.ts');
  const brand = { small: 14, normal: 17, large: 22, xlarge: 30 };
  const fresh = emptyDraft();
  assert.deepEqual(seedBrandTypeScale(fresh, brand, new Set(), null).type_scale, brand);
  assert.equal(seedBrandTypeScale(fresh, null, new Set(), null), fresh, 'no default: unchanged');
  assert.equal(seedBrandTypeScale(fresh, { small: 14 }, new Set(), null), fresh, 'the usual sizes: unchanged');
  const touched = { ...fresh, type_scale: { small: 12, normal: 16, large: 20, xlarge: 24 } };
  assert.equal(seedBrandTypeScale(touched, brand, new Set(['type_scale']), null), touched, 'sizes already changed here stay');
  assert.equal(seedBrandTypeScale(fresh, brand, new Set(), 7), fresh, 'a saved newsletter keeps its own');
});

test('review M2: a picker unmounted while open records only a colour already applied', async () => {
  const { unmountRecent } = await import('../../components/newsletters/lib/colorPicker.ts');
  assert.equal(unmountRecent({ open: true, changed: true, end: '#402113', atOpen: '' }), '#402113');
  assert.equal(unmountRecent({ open: true, changed: false, end: '#402113', atOpen: '' }), null);
  assert.equal(unmountRecent({ open: true, changed: true, end: '#402113', atOpen: '#402113' }), null, 'back where it started');
  assert.equal(unmountRecent({ open: false, changed: true, end: '#402113', atOpen: '' }), null, 'already closed (recorded then)');
});
