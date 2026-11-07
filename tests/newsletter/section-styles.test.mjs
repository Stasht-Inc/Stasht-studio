// Chris (5 Nov, points 2 and 3): a style toolbar for the Title and Text sections. Title: one size dropdown, alignment,
// text colour, section background colour or picture. Text: font size on the words, alignment, text colour, section
// background colour. Same keys, rules and numbers as the API (NewsletterContent::sectionStyle,
// NewsletterRenderer::section, NewsletterHtmlSanitizer::FONT_SIZES), so the editor draws what the email shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIGN_OPTIONS, BACKGROUND_SWATCHES, IMAGE_FALLBACK, IMAGE_SHADE, IMAGE_SHADOW, TEXT_INK, TEXT_SIZES, TITLE_INK, TITLE_SIZE_OPTIONS,
  sectionLook, sectionStyleOf, textLinkColor, textSizeOf, withSectionStyle, withTitleBackgroundMode, titleBackgroundModeOf,
} from '../../components/newsletters/lib/sectionStyle.ts';
import { normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';
import { sanitizeTextHtml, parseTextHtml, pastedTextNodes } from '../../components/newsletters/lib/textHtml.ts';

const PHOTO = 'https://stasht-media.s3.amazonaws.com/newsletter-images/1/showroom.jpg';

test('the controls offered: one title size list, three alignments, four text sizes', () => {
  assert.deepEqual(TITLE_SIZE_OPTIONS.map((o) => [o.value, o.label]), [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]);
  assert.deepEqual(ALIGN_OPTIONS.map((o) => [o.value, o.label]), [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]);
  // The API's NewsletterHtmlSanitizer::FONT_SIZES (px => line height).
  assert.deepEqual(TEXT_SIZES.map((s) => [s.value, s.label, s.px, s.lineHeight]), [
    ['small', 'Small', 14, 22], ['normal', 'Normal', 16, 26], ['large', 'Large', 20, 30], ['xlarge', 'X-Large', 24, 34],
  ]);
  assert.ok(BACKGROUND_SWATCHES.length >= 6 && BACKGROUND_SWATCHES.every((s) => /^#[0-9A-F]{6}$/.test(s.value)));
  assert.equal(textSizeOf(20)?.value, 'large');
  assert.equal(textSizeOf(13), null);
});

test('style keys: kept when valid, tidied, left/blank/bad ones are not kept (like the API)', () => {
  assert.deepEqual(
    sectionStyleOf({ text: 'x', size: 'large', align: 'center', color: '#dc2626', background_color: '#fef3c7', background_image_url: PHOTO }, true),
    { align: 'center', color: '#DC2626', background_color: '#FEF3C7', background_image_url: PHOTO },
  );
  assert.deepEqual(sectionStyleOf({ align: 'left', color: '', background_color: null }, true), {});
  assert.deepEqual(sectionStyleOf({ align: 'justify', color: 'red', background_color: '#FFF', background_image_url: 'http://a.example/x.jpg' }, true), {});
  // A text section never has a picture.
  assert.deepEqual(sectionStyleOf({ background_image_url: PHOTO, background_color: '#111827' }, false), { background_color: '#111827' });
});

test('withSectionStyle sets a key, and removes it for left / no colour / no picture, leaving an old-looking block', () => {
  const base = { text: 'Deals', size: 'large' };
  assert.deepEqual(withSectionStyle(base, { align: 'center' }), { ...base, align: 'center' });
  assert.deepEqual(withSectionStyle({ ...base, align: 'center' }, { align: 'left' }), base);
  assert.deepEqual(withSectionStyle({ ...base, color: '#DC2626' }, { color: null }), base);
  assert.deepEqual(withSectionStyle(base, { background_color: '#fef3c7' }), { ...base, background_color: '#FEF3C7' });
  assert.deepEqual(withSectionStyle({ ...base, background_image_url: PHOTO }, { background_image_url: null }), base);
  assert.ok(!('align' in withSectionStyle({ ...base, align: 'right' }, { align: 'left' })), 'no key left behind');
});

test('title background: Colour | Image, Colour takes the picture away (as the header does)', () => {
  const t = { text: 'Deals', size: 'large', background_color: '#2563EB', background_image_url: PHOTO };
  assert.equal(titleBackgroundModeOf(t), 'image');
  assert.equal(titleBackgroundModeOf({ text: 'x', size: 'large' }), 'color');
  assert.deepEqual(withTitleBackgroundMode(t, 'color'), { text: 'Deals', size: 'large', background_color: '#2563EB' });
  assert.equal(withTitleBackgroundMode(t, 'image'), t);
});

test('the look matches NewsletterRenderer::section: band padding, picture padding, readable words', () => {
  // No style: the usual section.
  assert.deepEqual(sectionLook({ text: 'x', size: 'large' }, true, TITLE_INK), { styled: false, align: 'left', bg: null, image: null, fallback: null, ink: TITLE_INK, padY: 12, link: '#6C60FF' });
  // A dark band: white words; a light one: the usual dark words; a picked colour always wins.
  assert.equal(sectionLook({ background_color: '#111827' }, true, TITLE_INK).ink, '#FFFFFF');
  assert.equal(sectionLook({ background_color: '#FEF3C7' }, true, TITLE_INK).ink, TITLE_INK);
  assert.equal(sectionLook({ background_color: '#FEF3C7' }, false, TEXT_INK).ink, TEXT_INK);
  assert.equal(sectionLook({ background_color: '#111827', color: '#F59E0B' }, false, TEXT_INK).ink, '#F59E0B');
  assert.equal(sectionLook({ background_color: '#111827' }, true, TITLE_INK).padY, 24);
  assert.equal(sectionLook({ align: 'center' }, true, TITLE_INK).padY, 12);
  // A picture: white words over the header's dark layer, 40 px of room, the colour (or a dark one) as fallback.
  const pic = sectionLook({ background_image_url: PHOTO, align: 'center' }, true, TITLE_INK);
  assert.deepEqual(pic, { styled: true, align: 'center', bg: null, image: PHOTO, fallback: IMAGE_FALLBACK, ink: '#FFFFFF', padY: 40, link: '#6C60FF' });
  assert.equal(sectionLook({ background_image_url: PHOTO, background_color: '#2563EB' }, true, TITLE_INK).fallback, '#2563EB');
  assert.equal(IMAGE_SHADE, 'rgba(17,24,39,0.55)');
  assert.equal(IMAGE_SHADOW, '0 1px 3px rgba(0,0,0,0.5)');
  assert.equal(IMAGE_FALLBACK, '#111827');
});

test('links are purple, except on a dark band where they take the words colour', () => {
  assert.equal(textLinkColor(sectionLook({ html: '' }, false, TEXT_INK)), '#6C60FF');
  assert.equal(textLinkColor(sectionLook({ background_color: '#FEF3C7' }, false, TEXT_INK)), '#6C60FF');
  assert.equal(textLinkColor(sectionLook({ background_color: '#111827' }, false, TEXT_INK)), '#FFFFFF');
  assert.equal(textLinkColor(sectionLook({ background_color: '#111827', color: '#F59E0B' }, false, TEXT_INK)), '#F59E0B');
});

test('normaliseBlocks keeps the style keys the API returns, and old blocks are unchanged', () => {
  const out = normaliseBlocks([
    { id: 't1', type: 'title', data: { text: 'Deals', size: 'large', align: 'center', color: '#DC2626', background_color: '#111827', background_image_url: PHOTO } },
    { id: 'x1', type: 'text', data: { html: '<p>Hi</p>', align: 'right', color: '#FFFFFF', background_color: '#111827', background_image_url: PHOTO } },
    { id: 't2', type: 'title', data: { text: 'Old', size: 'small' } },
    { id: 'x2', type: 'text', data: { html: '<p>Old</p>', align: 'nope' } },
  ]);
  assert.deepEqual(out[0].data, { text: 'Deals', size: 'large', align: 'center', color: '#DC2626', background_color: '#111827', background_image_url: PHOTO });
  assert.deepEqual(out[1].data, { html: '<p>Hi</p>', align: 'right', color: '#FFFFFF', background_color: '#111827' });
  assert.deepEqual(out[2].data, { text: 'Old', size: 'small' });
  assert.deepEqual(out[3].data, { html: '<p>Old</p>' });
});

test('text html keeps the toolbar font sizes, as the API sanitiser does', () => {
  const sizes = '<p>a <span data-size="small">s</span> <span data-size="normal">n</span> <span data-size="large">l</span> <span data-size="xlarge">x</span></p>';
  assert.equal(sanitizeTextHtml(sizes), sizes);
  assert.equal(sanitizeTextHtml('<span style=" FONT-SIZE : 20PX ; ">a</span>'), '<p><span data-size="large">a</span></p>');
  assert.equal(sanitizeTextHtml('<span style="color:red;font-size:20px;background:url(https://evil.example/x)" onclick="x()">a</span>'), '<p><span data-size="large">a</span></p>');
  assert.equal(sanitizeTextHtml('<span style="font-size:13px">a</span><span style="font-size:20pt">b</span><span style="font-size:larger">c</span>'), '<p>abc</p>');
  assert.equal(sanitizeTextHtml('<span style="font-size:expression(alert(1))">a</span>'), '<p>a</p>');
  assert.equal(sanitizeTextHtml('<p style="font-size:20px">a <strong style="font-size:24px">b</strong></p>'), '<p>a <strong>b</strong></p>');
  assert.equal(sanitizeTextHtml('<p><span data-size="large">a <span data-size="normal">b</span> c</span></p>'), '<p><span data-size="large">a <span data-size="normal">b</span> c</span></p>');
  assert.equal(sanitizeTextHtml('<p>a<span data-size="large"></span></p>'), '<p>a</p>');
  assert.equal(sanitizeTextHtml('<p><span data-size="xlarge"><strong>Big</strong> <a href="https://a.example/deal">deal</a></span></p>'), '<p><span data-size="xlarge"><strong>Big</strong> <a href="https://a.example/deal">deal</a></span></p>');
  // A plain span inside a sized one doesn't end the size early.
  assert.equal(sanitizeTextHtml('<p><span data-size="large">a <span>b</span> c</span></p>'), '<p><span data-size="large">a b c</span></p>');
  // A paragraph never ends up inside a size.
  assert.equal(sanitizeTextHtml('<span data-size="large">a<p>b</p></span>'), '<p><span data-size="large">a</span></p><p>b</p>');
  // The browser's <font size="7"> (execCommand) never reaches the email.
  assert.equal(sanitizeTextHtml('<font size="7">big</font>'), '<p>big</p>');
  assert.deepEqual(parseTextHtml('<span data-size="large">a</span>'), [{ kind: 'size', px: 20, children: [{ kind: 'text', text: 'a' }] }]);
});

test('a paste never brings a font size (other apps size their words in pt and px of their own)', () => {
  assert.deepEqual(pastedTextNodes('<p><span data-size="large">big</span> words</p>'), [{ kind: 'text', text: 'big words' }]);
});

test('stylePatch: the editor patch for a style change (undefined takes a key away, so the saved JSON has no key)', async () => {
  const { stylePatch } = await import('../../components/newsletters/lib/sectionStyle.ts');
  assert.deepEqual(stylePatch({ align: 'center', color: '#dc2626' }), { align: 'center', color: '#DC2626' });
  const off = stylePatch({ align: 'left', color: null, background_color: '', background_image_url: null });
  assert.deepEqual(Object.keys(off).sort(), ['align', 'background_color', 'background_image_url', 'color']);
  assert.ok(Object.values(off).every((v) => v === undefined));
  assert.equal(JSON.stringify({ text: 'x', ...off }), '{"text":"x"}');
  assert.deepEqual(stylePatch({ background_image_url: 'javascript:alert(1)' }), { background_image_url: undefined });
});
