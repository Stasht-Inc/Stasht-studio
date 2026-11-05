// Review fixes (5 Nov): font sizes applied on the text model (no execCommand / <font>), an html undo history the editor
// owns, automatic colours that read at 4.5:1 and a warning for a picked colour that doesn't. Same rules as the API.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resizeTextHtml, parseTextHtml } from '../../components/newsletters/lib/textHtml.ts';
import { createHistory, recordHistory, undoHistory, redoHistory } from '../../components/newsletters/lib/textHistory.ts';
import { contrastRatio, readableInk, sectionLook, textLinkColor, poorContrast, TEXT_INK, TITLE_INK } from '../../components/newsletters/lib/sectionStyle.ts';

const P = '<p>Book your winter tire swap this week. Big savings on all brands.</p>';
const at = (html, words) => { const plain = parseTextHtml(html).map(function t(n) { return n.kind === 'text' ? n.text : n.children ? n.children.map(t).join('') : ''; }).join(''); const i = plain.indexOf(words); return { start: i, end: i + words.length }; };

test('whole section: one size around the words of each paragraph and list item, never around a block', () => {
  assert.equal(resizeTextHtml(P, 20, null), '<p><span style="font-size:20px">Book your winter tire swap this week. Big savings on all brands.</span></p>');
  assert.equal(resizeTextHtml('<p>One</p><ul><li>Two</li><li><strong>Three</strong> four</li></ul>', 24, null),
    '<p><span style="font-size:24px">One</span></p><ul><li><span style="font-size:24px">Two</span></li><li><span style="font-size:24px"><strong>Three</strong> four</span></li></ul>');
  // Normal on the whole section: no size left.
  assert.equal(resizeTextHtml('<p><span style="font-size:20px">a <strong>b</strong></span> c</p>', 16, null), '<p>a <strong>b</strong> c</p>');
});

test('selected words only; the older size inside them goes, the rest keeps theirs', () => {
  assert.equal(resizeTextHtml(P, 24, at(P, 'Big savings')), '<p>Book your winter tire swap this week. <span style="font-size:24px">Big savings</span> on all brands.</p>');
  const large = '<p>Book <span style="font-size:20px">Big savings on all brands.</span></p>';
  assert.equal(resizeTextHtml(large, 16, at(large, 'all brands')), '<p>Book <span style="font-size:20px">Big savings on </span>all brands<span style="font-size:20px">.</span></p>');
  const mixed = '<p><span style="font-size:14px">a</span> b <span style="font-size:24px">c</span></p>';
  assert.equal(resizeTextHtml(mixed, 20, null), '<p><span style="font-size:20px">a b c</span></p>');
  // Across two paragraphs: each gets its own span.
  const two = '<p>First line</p><p>Second line</p>';
  assert.equal(resizeTextHtml(two, 20, at(two, 'lineSecond')), '<p>First <span style="font-size:20px">line</span></p><p><span style="font-size:20px">Second</span> line</p>');
  // Formatting and links stay.
  const f = '<p>See <a href="https://a.example/x"><strong>our deals</strong></a> now</p>';
  assert.equal(resizeTextHtml(f, 20, at(f, 'our deals')), '<p>See <span style="font-size:20px"><a href="https://a.example/x"><strong>our deals</strong></a></span> now</p>');
  assert.ok(!/<font/i.test(resizeTextHtml(f, 24, null)));
});

test('undo history: typing bursts are one step, formatting is its own step, redo after undo, a new change drops redo', () => {
  let h = createHistory('<p>a</p>');
  h = recordHistory(h, '<p>ab</p>', 'typing', 1000);
  h = recordHistory(h, '<p>abc</p>', 'typing', 1500); // same burst
  h = recordHistory(h, '<p><span style="font-size:20px">abc</span></p>', 'format', 1600);
  h = recordHistory(h, '<p><span style="font-size:20px">abc</span>d</p>', 'typing', 1700);
  let r = undoHistory(h); assert.equal(r.html, '<p><span style="font-size:20px">abc</span></p>');
  r = undoHistory(r.history); assert.equal(r.html, '<p>abc</p>');
  r = undoHistory(r.history); assert.equal(r.html, '<p>a</p>');
  assert.equal(undoHistory(r.history).html, null, 'nothing before the start');
  r = redoHistory(r.history); assert.equal(r.html, '<p>abc</p>');
  r = redoHistory(r.history); assert.equal(r.html, '<p><span style="font-size:20px">abc</span></p>');
  const branched = recordHistory(r.history, '<p>x</p>', 'format', 2000);
  assert.equal(redoHistory(branched).html, null, 'a new change drops what could be redone');
  // A pause between keystrokes starts a new step; the same html is not a step.
  let p = createHistory('<p></p>');
  p = recordHistory(p, '<p>a</p>', 'typing', 0);
  p = recordHistory(p, '<p>ab</p>', 'typing', 5000);
  p = recordHistory(p, '<p>ab</p>', 'format', 5100);
  assert.equal(undoHistory(p).html, '<p>a</p>');
});

test('automatic words read at 4.5:1 on every band (as NewsletterRenderer::readableInk)', () => {
  assert.equal(Math.round(contrastRatio('#059669', '#111827') * 100) / 100, 4.71);
  assert.equal(readableInk('#059669', TITLE_INK), '#111827');
  assert.equal(readableInk('#059669', TEXT_INK), '#111827');
  assert.equal(readableInk('#2563EB', TITLE_INK), '#FFFFFF');
  assert.equal(readableInk('#F59E0B', TITLE_INK), '#111827');
  assert.equal(readableInk('#FEF3C7', TEXT_INK), TEXT_INK);
  assert.equal(readableInk('#6C60FF', TITLE_INK), '#FFFFFF', 'no colour reaches 4.5 on purple: the most contrast');
  assert.equal(sectionLook({ background_color: '#059669' }, false, TEXT_INK).ink, '#111827');
  assert.equal(textLinkColor(sectionLook({ background_color: '#059669' }, false, TEXT_INK)), '#111827');
  assert.equal(textLinkColor(sectionLook({ background_color: '#FEF3C7' }, false, TEXT_INK)), '#6C60FF');
});

test('a picked colour that is hard to read on the band is flagged', () => {
  assert.equal(poorContrast('#F59E0B', '#FEF3C7'), true);
  assert.equal(poorContrast('#111827', '#FEF3C7'), false);
  assert.equal(poorContrast(null, '#FEF3C7'), false);
  assert.equal(poorContrast('#111827', null), false);
});
