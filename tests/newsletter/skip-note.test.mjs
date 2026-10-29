// Chris, 29 Oct (round 2), item 6: results say why a text was skipped (no text parts left).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipientSkipNote } from '../../components/newsletters/lib/skipNote.ts';

test('recipientSkipNote: the API’s note, plain words for a known reason, nothing otherwise', () => {
  assert.equal(recipientSkipNote({ status: 'skipped', skip_reason: 'no_text_parts', skip_note: 'Not sent: no text parts left' }), 'Not sent: no text parts left');
  assert.equal(recipientSkipNote({ status: 'skipped', skip_reason: 'no_text_parts', skip_note: null }), 'Not sent: no text parts left');
  assert.equal(recipientSkipNote({ status: 'skipped', skip_reason: 'unsubscribed', skip_note: null }), null);
  assert.equal(recipientSkipNote({ status: 'skipped' }), null, 'an older API');
  assert.equal(recipientSkipNote({ status: 'delivered', skip_reason: 'no_text_parts', skip_note: 'x' }), null);
});
