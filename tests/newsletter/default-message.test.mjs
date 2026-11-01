// "Set as my default message" under the Message box (Chris, 1 Nov; "we already have this in Storeels"): the account's
// saved text (GET/PUT /newsletter-brand default_message) pre-fills a new newsletter's Message box, and the box is
// ticked whenever its text is that saved text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSetDefaultMessage, isDefaultMessage, withDefaultMessage } from '../../components/newsletters/lib/defaultMessage.ts';
import { MESSAGE_BLOCK_ID } from '../../components/newsletters/lib/messageBlock.ts';
import { emptyDraft, mergeUntouched, savableChanges } from '../../components/newsletters/lib/draft.ts';

const title = (id) => ({ id, type: 'title', data: { text: 'Hi', size: 'large' } });

test('ticked only while the box shows the saved default (spaces at the ends do not matter)', () => {
  assert.equal(isDefaultMessage('November deals are here.', 'November deals are here.'), true);
  assert.equal(isDefaultMessage('November deals are here.', '  November deals are here. '), true);
  assert.equal(isDefaultMessage('November deals are here.', 'November deals are here!'), false, 'edited: no longer the default');
  assert.equal(isDefaultMessage(null, ''), false, 'nothing saved');
  assert.equal(isDefaultMessage(undefined, 'Hi'), false, 'an older API with no default_message');
  assert.equal(isDefaultMessage('', ''), false, 'an empty box is never "the default"');
});

test('a default can be set only from a message that fits', () => {
  assert.equal(canSetDefaultMessage('Hi'), true);
  assert.equal(canSetDefaultMessage('   '), false, 'blank');
  assert.equal(canSetDefaultMessage(''), false);
  assert.equal(canSetDefaultMessage('a'.repeat(120)), true);
  assert.equal(canSetDefaultMessage('a'.repeat(121)), false, 'longer than the box allows');
});

test('a new, empty draft takes the default: the box and the Message section at the top of the email', () => {
  const d = withDefaultMessage(emptyDraft(), 'November deals are here.\nCome see us.');
  assert.equal(d.sms_text, 'November deals are here.\nCome see us.');
  assert.equal(d.blocks.length, 1);
  assert.equal(d.blocks[0].id, MESSAGE_BLOCK_ID);
  assert.equal(d.blocks[0].data.html, '<p>November deals are here.<br>Come see us.</p>');

  const withSection = withDefaultMessage({ ...emptyDraft(), blocks: [title('b1')] }, 'Hi');
  assert.deepEqual(withSection.blocks.map((b) => b.id), [MESSAGE_BLOCK_ID, 'b1'], 'above the sections already added');
});

test('nothing changes when there is no default or the box already has words', () => {
  const empty = emptyDraft();
  assert.equal(withDefaultMessage(empty, null), empty);
  assert.equal(withDefaultMessage(empty, undefined), empty);
  assert.equal(withDefaultMessage(empty, '   '), empty);
  const typed = { ...emptyDraft(), sms_text: 'My own words' };
  assert.equal(withDefaultMessage(typed, 'Default'), typed, 'never replaces what the person typed');
});

test('the pre-filled message survives the draft being created and goes in the first save', () => {
  const local = withDefaultMessage(emptyDraft(), 'Hi there');
  // POST /newsletters answers with the server's defaults: no text, no sections.
  const server = { ...emptyDraft(), name: 'November Newsletter 2026', sms_text: '', blocks: [] };
  const merged = mergeUntouched({ ...local, name: '' }, server, new Set());
  assert.equal(merged.sms_text, 'Hi there');
  assert.equal(merged.blocks[0].id, MESSAGE_BLOCK_ID);
  const { patch } = savableChanges(server, merged);
  assert.equal(patch.sms_text, 'Hi there');
  assert.equal(patch.blocks[0].id, MESSAGE_BLOCK_ID);
});
