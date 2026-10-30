// "Add this to the email too" (Chris, 30 Oct): the text message box is SMS only; this copies its text into the email
// as a Text section at the end, in the same shape "+ → Text" makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsTextHtml, smsTextBlock, appendSmsToEmail, canAddSmsToEmail } from '../../components/newsletters/lib/smsToEmail.ts';
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

test('appendSmsToEmail adds it at the end and leaves the other sections alone', () => {
  const blocks = [title('a'), title('b')];
  const r = appendSmsToEmail(blocks, 'Sale on now', 'bnew');
  assert.equal(r.outcome, 'added');
  assert.deepEqual(r.blocks.map((b) => b.id), ['a', 'b', 'bnew']);
  assert.deepEqual(r.blocks[2], { id: 'bnew', type: 'text', data: { html: '<p>Sale on now</p>' } });
  assert.deepEqual(blocks.map((b) => b.id), ['a', 'b'], 'the list passed in is not changed');
  assert.deepEqual(appendSmsToEmail([], 'Hi', 'b1').blocks.map((b) => b.id), ['b1']);
});

test('appendSmsToEmail: blank text or a full email changes nothing', () => {
  const blocks = [title('a')];
  assert.deepEqual(appendSmsToEmail(blocks, '  ', 'b1'), { blocks, outcome: 'empty' });
  const full = Array.from({ length: 40 }, (_, i) => title(`x${i}`));
  const r = appendSmsToEmail(full, 'Hi', 'b1');
  assert.equal(r.outcome, 'full');
  assert.equal(r.blocks, full);
});

test('canAddSmsToEmail: only with some text and when the newsletter can be changed', () => {
  assert.equal(canAddSmsToEmail('Hi', false), true);
  assert.equal(canAddSmsToEmail('', false), false);
  assert.equal(canAddSmsToEmail(' \n ', false), false);
  assert.equal(canAddSmsToEmail('Hi', true), false);
});
