// The Message box's text as a Text section (Chris, 31 Oct: it goes at the top of the email; messageBlock.ts), in the
// same shape "+ → Text" makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsTextHtml, smsTextBlock } from '../../components/newsletters/lib/smsToEmail.ts';
import { createBlock, blockProblem } from '../../components/newsletters/lib/blocks.ts';
import { sanitizeTextHtml, textHtmlIsEmpty } from '../../components/newsletters/lib/textHtml.ts';

const title = (id) => ({ id, type: 'title', data: { text: 'Hi', size: 'large' } });

test('one line becomes one paragraph, trimmed', () => {
  assert.equal(smsTextHtml('  October deals are here.  '), '<p>October deals are here.</p>');
});

test('the text is escaped, never read as HTML', () => {
  assert.equal(smsTextHtml('Save <b>20%</b> & more "today"'), '<p>Save &lt;b&gt;20%&lt;/b&gt; &amp; more &quot;today&quot;</p>');
  assert.equal(smsTextHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('a new line is a line break; a blank line starts a new paragraph', () => {
  assert.equal(smsTextHtml('Line one\nLine two'), '<p>Line one<br>Line two</p>');
  assert.equal(smsTextHtml('First\n\nSecond'), '<p>First</p><p>Second</p>');
  assert.equal(smsTextHtml('First\r\n  \r\nSecond\r\nmore'), '<p>First</p><p>Second<br>more</p>');
  assert.equal(smsTextHtml('\n\nA\n\n\n\nB\n\n'), '<p>A</p><p>B</p>');
});

test('blank text makes nothing', () => {
  assert.equal(smsTextHtml(''), '');
  assert.equal(smsTextHtml('  \n \n '), '');
  assert.equal(smsTextBlock('   ', 'b1'), null);
});

test('the block is a Text section, the same shape "+ → Text" makes, with nothing to fix', () => {
  const block = smsTextBlock('October deals are here.', 'bsms1');
  const made = createBlock('text', 'bsms1');
  assert.equal(block.type, made.type);
  assert.deepEqual(Object.keys(block.data), Object.keys(made.data));
  assert.deepEqual(block, { id: 'bsms1', type: 'text', data: { html: '<p>October deals are here.</p>' } });
  assert.equal(blockProblem(block), null);
  // What the editor would save is the same HTML (it is already the allowed subset).
  assert.equal(sanitizeTextHtml(block.data.html), block.data.html);
  assert.equal(textHtmlIsEmpty(block.data.html), false);
});
