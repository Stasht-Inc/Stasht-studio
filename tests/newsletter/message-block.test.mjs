// The Message box (Chris, 31 Oct): its text goes at the top of the email as a Text section with a fixed id, which
// Studio keeps in step with the box (insert at the top / update / remove), and also as the text when Text message is
// ticked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_BLOCK_ID, isMessageBlock, syncMessageBlock, addMissingMessageBlock } from '../../components/newsletters/lib/messageBlock.ts';
import { blockProblem, newBlockId } from '../../components/newsletters/lib/blocks.ts';

const title = (id) => ({ id, type: 'title', data: { text: 'Hi', size: 'large' } });
const message = (html) => ({ id: MESSAGE_BLOCK_ID, type: 'text', data: { html } });

test('the id is one the API keeps ([A-Za-z0-9_-]{1,40}) and Studio never makes for a new section', () => {
  assert.match(MESSAGE_BLOCK_ID, /^[A-Za-z0-9_-]{1,40}$/);
  // newBlockId makes 'b' + base-36 (or 'b' + a number): never this id.
  assert.ok(!MESSAGE_BLOCK_ID.startsWith('b'));
  assert.notEqual(newBlockId([message('<p>x</p>')]), MESSAGE_BLOCK_ID);
});

test('isMessageBlock: only a Text section with the fixed id', () => {
  assert.equal(isMessageBlock(message('<p>Hi</p>')), true);
  assert.equal(isMessageBlock({ id: 'b1', type: 'text', data: { html: '<p>Hi</p>' } }), false);
  assert.equal(isMessageBlock({ id: MESSAGE_BLOCK_ID, type: 'title', data: { text: 'Hi', size: 'large' } }), false);
});

test('a message with no section yet: a Text section goes at the top, the others are untouched', () => {
  const blocks = [title('a'), title('b')];
  const next = syncMessageBlock(blocks, 'Hey Team');
  assert.deepEqual(next.map((b) => b.id), [MESSAGE_BLOCK_ID, 'a', 'b']);
  assert.deepEqual(next[0], message('<p>Hey Team</p>'));
  assert.equal(next[1], blocks[0], 'other sections are the same objects');
  assert.equal(next[2], blocks[1]);
  assert.deepEqual(blocks.map((b) => b.id), ['a', 'b'], 'the list passed in is not changed');
  assert.equal(blockProblem(next[0]), null, 'nothing to fix before sending');
  assert.deepEqual(syncMessageBlock([], 'Hi'), [message('<p>Hi</p>')]);
});

test('the message is escaped and its new lines become line breaks', () => {
  const next = syncMessageBlock([], 'Save <b>20%</b> & more\nCall "today"');
  assert.equal(next[0].data.html, '<p>Save &lt;b&gt;20%&lt;/b&gt; &amp; more<br>Call &quot;today&quot;</p>');
});

test('a changed message updates the section where it is (it may have been moved)', () => {
  const blocks = [title('a'), message('<p>Old</p>'), title('b')];
  const next = syncMessageBlock(blocks, 'New words');
  assert.deepEqual(next.map((b) => b.id), ['a', MESSAGE_BLOCK_ID, 'b']);
  assert.deepEqual(next[1], message('<p>New words</p>'));
  assert.equal(next[0], blocks[0]);
  assert.equal(next[2], blocks[2]);
});

test('a cleared message removes the section; nothing else changes', () => {
  const blocks = [message('<p>Old</p>'), title('a')];
  assert.deepEqual(syncMessageBlock(blocks, '').map((b) => b.id), ['a']);
  assert.deepEqual(syncMessageBlock(blocks, '  \n  ').map((b) => b.id), ['a']);
  const none = [title('a')];
  assert.equal(syncMessageBlock(none, ''), none, 'no section and no message: the same list');
});

test('idempotent: the same message gives back the same list (no change, nothing to save)', () => {
  const once = syncMessageBlock([title('a')], 'Hey Team');
  assert.equal(syncMessageBlock(once, 'Hey Team'), once);
  assert.equal(syncMessageBlock(once, '  Hey Team  '), once, 'spaces around the line make the same HTML');
});

test('never two message sections: a stray copy is dropped, the first stays', () => {
  const blocks = [title('a'), message('<p>One</p>'), title('b'), message('<p>Two</p>')];
  const next = syncMessageBlock(blocks, 'One');
  assert.deepEqual(next.map((b) => b.id), ['a', MESSAGE_BLOCK_ID, 'b']);
  assert.equal(next.filter((b) => b.id === MESSAGE_BLOCK_ID).length, 1);
});

test('a section of another type with the id is replaced by the message, in place', () => {
  const blocks = [title('a'), { id: MESSAGE_BLOCK_ID, type: 'title', data: { text: 'x', size: 'large' } }];
  const next = syncMessageBlock(blocks, 'Hi');
  assert.deepEqual(next, [blocks[0], message('<p>Hi</p>')]);
});

test('a full email (40 sections) gets no new section, but an existing one still updates or goes', () => {
  const full = Array.from({ length: 40 }, (_, i) => title(`x${i}`));
  assert.equal(syncMessageBlock(full, 'Hi'), full);
  const fullWithMessage = [message('<p>Old</p>'), ...full.slice(1)];
  assert.equal(syncMessageBlock(fullWithMessage, 'New')[0].data.html, '<p>New</p>');
  assert.equal(syncMessageBlock(fullWithMessage, '').length, 39);
});

test('addMissingMessageBlock (opening an older draft): adds it at the top only when there is none', () => {
  const blocks = [title('a')];
  const next = addMissingMessageBlock(blocks, 'Hey Team, This is just a test');
  assert.deepEqual(next.map((b) => b.id), [MESSAGE_BLOCK_ID, 'a']);
  assert.equal(next[0].data.html, '<p>Hey Team, This is just a test</p>');
  // Already there (even with the server's own escaping, or moved, or edited): left exactly as it is.
  const saved = [title('a'), message('<p>it&#039;s here</p>')];
  assert.equal(addMissingMessageBlock(saved, "it's here"), saved);
  assert.equal(addMissingMessageBlock(saved, 'something else'), saved);
  // No message: nothing to add.
  assert.equal(addMissingMessageBlock(blocks, ''), blocks);
  assert.equal(addMissingMessageBlock(blocks, '   '), blocks);
  const full = Array.from({ length: 40 }, (_, i) => title(`x${i}`));
  assert.equal(addMissingMessageBlock(full, 'Hi'), full);
});
