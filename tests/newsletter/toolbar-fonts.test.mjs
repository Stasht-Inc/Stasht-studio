// Chris (6 Nov, point 3): "We are missing font types" and the B / I / link buttons show no pressed state. A font family
// dropdown in the Title and Text toolbars, with the same fonts, stacks and rules as the API (NewsletterFonts,
// NewsletterHtmlSanitizer::spanOpen, NewsletterContent::titleType). Text: on the selected words, or the whole section
// when nothing is selected, worked out on the text model (like the font size) so undo/redo stays clean. Title: the
// whole title (data.font), and bold can be turned off (data.bold false; absent = bold, so older titles are unchanged).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONTS, DEFAULT_FONT_STACK, fontStack, styleFontFamily, titleTypeOf, withTitleType, fontOfLabel } from '../../components/newsletters/lib/fonts.ts';
import { fontTextHtml, parseTextHtml, resizeTextHtml, sanitizeTextHtml, pastedTextNodes, serializeTextNodes, fontAt, formatAt } from '../../components/newsletters/lib/textHtml.ts';
import { createHistory, recordHistory, undoHistory, redoHistory } from '../../components/newsletters/lib/textHistory.ts';
import { normaliseBlocks } from '../../components/newsletters/lib/blocks.ts';

const GEORGIA = "Georgia, 'Times New Roman', Times, serif";

test('the fonts offered, each with web-safe fallbacks (the API\'s NewsletterFonts::FONTS)', () => {
  assert.deepEqual(FONTS.map((f) => [f.value, f.label]), [
    ['arial', 'Arial'], ['helvetica', 'Helvetica'], ['georgia', 'Georgia'], ['times', 'Times New Roman'],
    ['verdana', 'Verdana'], ['trebuchet', 'Trebuchet MS'], ['tahoma', 'Tahoma'], ['courier', 'Courier New'],
  ]);
  assert.deepEqual(FONTS.map((f) => f.stack), [
    'Arial, Helvetica, sans-serif', 'Helvetica, Arial, sans-serif', GEORGIA, "'Times New Roman', Times, serif",
    'Verdana, Geneva, sans-serif', "'Trebuchet MS', Helvetica, Arial, sans-serif", 'Tahoma, Verdana, Geneva, sans-serif', "'Courier New', Courier, monospace",
  ]);
  assert.equal(DEFAULT_FONT_STACK, "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif");
  assert.equal(fontStack('georgia'), GEORGIA);
  assert.equal(fontStack(null), DEFAULT_FONT_STACK);
  assert.equal(fontOfLabel('times new roman'), 'times');
});

test('a style\'s font family: its first family when offered (by label, any case, quoted or not), else null', () => {
  assert.equal(styleFontFamily('font-family:Georgia'), 'georgia');
  assert.equal(styleFontFamily(`font-size:20px;font-family:${GEORGIA}`), 'georgia');
  assert.equal(styleFontFamily('font-family: "times new roman" , serif'), 'times');
  assert.equal(styleFontFamily("font-family:'Courier New'"), 'courier');
  assert.equal(styleFontFamily('font-family:Comic Sans MS'), null);
  assert.equal(styleFontFamily('font-family:Wingdings, Arial'), null);
  assert.equal(styleFontFamily('font-family:url(https://evil.test/f.woff)'), null);
  assert.equal(styleFontFamily('font-family:expression(alert(1))'), null);
  assert.equal(styleFontFamily('color:red'), null);
  assert.equal(styleFontFamily(null), null);
});

test('the sanitiser keeps size and/or font spans canonically (size first) and nothing else (as the API)', () => {
  assert.equal(sanitizeTextHtml('<p><span style="font-family:Georgia">a</span></p>'), `<p><span style="font-family:${GEORGIA}">a</span></p>`);
  assert.equal(sanitizeTextHtml(`<p><span style="font-family:${GEORGIA}; font-size: 20px">a</span></p>`), `<p><span style="font-size:20px;font-family:${GEORGIA}">a</span></p>`);
  assert.equal(sanitizeTextHtml('<p><span style="color:red;font-family:Arial;background:url(https://x.test/a.png)">a</span></p>'), '<p><span style="font-family:Arial, Helvetica, sans-serif">a</span></p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-family:Comic Sans MS">a</span></p>'), '<p>a</p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-size:24px;font-family:Papyrus">a</span></p>'), '<p><span style="font-size:24px">a</span></p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-family:expression(alert(1))">a</span></p>'), '<p>a</p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-family:url(https://evil.test/f.woff)">a</span></p>'), '<p>a</p>');
  assert.equal(sanitizeTextHtml('<font face="Georgia">a</font>'), '<p>a</p>');
  // The parsed node: px null for a font alone; no font key for a size alone (as before).
  assert.deepEqual(parseTextHtml('<span style="font-family:Tahoma">a</span>'), [{ kind: 'size', px: null, font: 'tahoma', children: [{ kind: 'text', text: 'a' }] }]);
  assert.deepEqual(parseTextHtml('<span style="font-size:20px">a</span>'), [{ kind: 'size', px: 20, children: [{ kind: 'text', text: 'a' }] }]);
});

test('review (6 Nov): a non-breaking or other Unicode space reads as a space, exactly as the API (NewsletterFonts::normaliseSpaces)', () => {
  // The same cases as the API's NewsletterHtmlSanitizerFontsTest.
  assert.equal(sanitizeTextHtml('<p><span style="font-family:\u00a0Georgia\u00a0">a</span></p>'), `<p><span style="font-family:${GEORGIA}">a</span></p>`);
  assert.equal(sanitizeTextHtml('<p><span style="font-family:Times\u00a0New Roman">a</span></p>'), `<p><span style="font-family:'Times New Roman', Times, serif">a</span></p>`);
  assert.equal(sanitizeTextHtml('<p><span style="font-size:\u00a020px\u3000">a</span></p>'), '<p><span style="font-size:20px">a</span></p>');
  assert.equal(sanitizeTextHtml('<p><span style="font-family:&nbsp;Verdana">a</span></p>'), '<p><span style="font-family:Verdana, Geneva, sans-serif">a</span></p>');
});

test('a paste never brings a font (other apps set one on every word)', () => {
  assert.deepEqual(pastedTextNodes('<p><span style="font-family:Arial,sans-serif">pasted</span> words</p>'), [{ kind: 'text', text: 'pasted words' }]);
});

test('font on selected words only; the rest keep theirs', () => {
  const html = '<p>Book your swap. Big savings on all brands.</p>';
  const start = html.replace(/<[^>]+>/g, '').indexOf('Big savings');
  assert.equal(fontTextHtml(html, 'georgia', { start, end: start + 'Big savings'.length }),
    `<p>Book your swap. <span style="font-family:${GEORGIA}">Big savings</span> on all brands.</p>`);
});

test('font with nothing selected: the whole section, every paragraph and list item', () => {
  assert.equal(fontTextHtml('<p>One</p><ul><li>Two</li></ul>', 'verdana', null),
    '<p><span style="font-family:Verdana, Geneva, sans-serif">One</span></p><ul><li><span style="font-family:Verdana, Geneva, sans-serif">Two</span></li></ul>');
  // Default on the whole section takes every font away.
  assert.equal(fontTextHtml('<p><span style="font-family:Verdana, Geneva, sans-serif">One</span> two</p>', null, null), '<p>One two</p>');
});

test('font and size combine on the same words in one canonical span, and each keeps the other', () => {
  const sized = resizeTextHtml('<p>Big savings</p>', 24, null);
  assert.equal(sized, '<p><span style="font-size:24px">Big savings</span></p>');
  const both = fontTextHtml(sized, 'courier', { start: 0, end: 3 });
  assert.equal(both, `<p><span style="font-size:24px;font-family:'Courier New', Courier, monospace">Big</span><span style="font-size:24px"> savings</span></p>`);
  // Resizing later keeps the font; Normal keeps the font and drops only the size.
  assert.equal(resizeTextHtml(both, 16, null), `<p><span style="font-family:'Courier New', Courier, monospace">Big</span> savings</p>`);
  // Bold and links inside keep their markup.
  assert.equal(fontTextHtml('<p><strong>Big</strong> <a href="https://a.test/x">deal</a></p>', 'tahoma', null),
    '<p><span style="font-family:Tahoma, Verdana, Geneva, sans-serif"><strong>Big</strong> <a href="https://a.test/x">deal</a></span></p>');
});

test('a font inside another font on part of the words; Default inside a font', () => {
  const all = fontTextHtml('<p>one two three</p>', 'arial', null);
  const mid = fontTextHtml(all, null, { start: 4, end: 7 });
  assert.equal(mid, '<p><span style="font-family:Arial, Helvetica, sans-serif">one </span>two<span style="font-family:Arial, Helvetica, sans-serif"> three</span></p>');
  // Nested spans (as another editor might save them) are flattened first.
  assert.equal(fontTextHtml('<p><span style="font-size:20px"><span style="font-family:Georgia">a</span>b</span></p>', 'arial', { start: 1, end: 2 }),
    `<p><span style="font-size:20px;font-family:${GEORGIA}">a</span><span style="font-size:20px;font-family:Arial, Helvetica, sans-serif">b</span></p>`);
});

test('the font and formatting at the caret (what the toolbar shows)', () => {
  const html = `<p>plain <span style="font-family:${GEORGIA}">serif <strong>bold <em>both</em></strong> <a href="https://a.test/x">link</a></span></p>`;
  const nodes = parseTextHtml(html);
  const at = (w) => serializeTextNodes(nodes).replace(/<[^>]+>/g, '').indexOf(w) + 1;
  assert.equal(fontAt(nodes, at('plain')), null);
  assert.equal(fontAt(nodes, at('serif')), 'georgia');
  assert.deepEqual(formatAt(nodes, at('plain')), { bold: false, italic: false, link: false });
  assert.deepEqual(formatAt(nodes, at('bold')), { bold: true, italic: false, link: false });
  assert.deepEqual(formatAt(nodes, at('both')), { bold: true, italic: true, link: false });
  assert.deepEqual(formatAt(nodes, at('link')), { bold: false, italic: false, link: true });
});

test('review (6 Nov): Link is pressed only with the caret inside a link, not just before or after it (typing there is not linked)', () => {
  const nodes = parseTextHtml('<p>Book <a href="https://a.test/x">winter tire</a> swap</p>');
  const text = 'Book winter tire swap';
  const start = text.indexOf('winter');
  const end = start + 'winter tire'.length;
  assert.equal(formatAt(nodes, start).link, false, 'just before the link');
  assert.equal(formatAt(nodes, start + 1).link, true, 'inside');
  assert.equal(formatAt(nodes, end - 1).link, true, 'inside, before the last letter');
  assert.equal(formatAt(nodes, end).link, false, 'just after the link');
  assert.equal(formatAt(nodes, start, end).link, true, 'the whole link selected');
  assert.equal(formatAt(nodes, start - 1, end).link, false, 'a selection reaching outside it');
  // Two links side by side: the caret between them is in neither.
  const two = parseTextHtml('<p><a href="https://a.test/1">one</a><a href="https://a.test/2">two</a></p>');
  assert.equal(formatAt(two, 3).link, false);
  // At the very end of text that ends with a link.
  assert.equal(formatAt(parseTextHtml('<p><a href="https://a.test/1">one</a></p>'), 3).link, false);
});

test('undo / redo across font changes lands on the exact html each time', () => {
  const start = '<p>Book your swap. Big savings.</p>';
  let h = createHistory(start);
  const s1 = fontTextHtml(start, 'georgia', { start: 17, end: 28 });
  h = recordHistory(h, s1, 'format', 1);
  const s2 = fontTextHtml(s1, 'courier', null);
  h = recordHistory(h, s2, 'format', 2);
  let step = undoHistory(h); h = step.history; assert.equal(step.html, s1);
  step = undoHistory(h); h = step.history; assert.equal(step.html, start);
  step = redoHistory(h); h = step.history; assert.equal(step.html, s1);
  step = redoHistory(h); h = step.history; assert.equal(step.html, s2);
  assert.ok(!/<font/i.test(s1 + s2));
});

test('title type keys: font only when offered, bold only when off (as the API keeps them)', () => {
  assert.deepEqual(titleTypeOf({ text: 'x', font: 'georgia', bold: false }), { font: 'georgia', bold: false });
  assert.deepEqual(titleTypeOf({ text: 'x', font: 'Comic', bold: true }), {});
  assert.deepEqual(titleTypeOf({ text: 'x', font: '', bold: 'no' }), {});
  assert.deepEqual(withTitleType({ text: 'x', size: 'large' }, { font: 'times' }), { text: 'x', size: 'large', font: 'times' });
  assert.deepEqual(withTitleType({ text: 'x', size: 'large', font: 'times', bold: false }, { font: null, bold: true }), { text: 'x', size: 'large' });
  // The Title's style keys and these come back from the API together; an older title has neither.
  const [a, b] = normaliseBlocks([
    { id: 't1', type: 'title', data: { text: 'Deals', size: 'large', font: 'courier', bold: false, align: 'center' } },
    { id: 't2', type: 'title', data: { text: 'Old', size: 'small' } },
  ]);
  assert.deepEqual(a.data, { text: 'Deals', size: 'large', align: 'center', font: 'courier', bold: false });
  assert.deepEqual(b.data, { text: 'Old', size: 'small' });
});
