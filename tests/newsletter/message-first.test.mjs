// The Message section stays first under the header (live screenshot, 3 Nov): no + above it, nothing inserted or
// moved above it; without a message nothing changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_BLOCK_ID } from '../../components/newsletters/lib/messageBlock.ts';
import { canMoveBlock, firstInsertIndex, insertBlock, moveBlock, restoreBlock } from '../../components/newsletters/lib/blocks.ts';

const title = (id) => ({ id, type: 'title', data: { text: 'Hi', size: 'large' } });
const message = { id: MESSAGE_BLOCK_ID, type: 'text', data: { html: '<p>Hey</p>' } };
const ids = (bs) => bs.map((b) => b.id);

test('first insert point: after the message when it leads, else the top', () => {
  assert.equal(firstInsertIndex([message, title('a')]), 1);
  assert.equal(firstInsertIndex([message]), 1);
  assert.equal(firstInsertIndex([title('a'), message]), 0);
  assert.equal(firstInsertIndex([title('a')]), 0);
  assert.equal(firstInsertIndex([]), 0);
});

test('insert at 0 with a message goes below it; without one, at the top', () => {
  assert.deepEqual(ids(insertBlock([message, title('a')], 0, title('n'))), [MESSAGE_BLOCK_ID, 'n', 'a']);
  assert.deepEqual(ids(insertBlock([message, title('a')], -3, title('n'))), [MESSAGE_BLOCK_ID, 'n', 'a']);
  assert.deepEqual(ids(insertBlock([title('a')], 0, title('n'))), ['n', 'a']);
  assert.deepEqual(ids(restoreBlock([message, title('a')], title('x'), 0)), [MESSAGE_BLOCK_ID, 'x', 'a']);
  // The message itself may still go back at the top (undo of its delete, sync).
  assert.deepEqual(ids(insertBlock([title('a')], 0, message)), [MESSAGE_BLOCK_ID, 'a']);
});

test('nothing moves above or off the message', () => {
  const bs = [message, title('a'), title('b')];
  assert.equal(canMoveBlock(bs, 1, -1), false);
  assert.equal(moveBlock(bs, 1, -1), bs);
  assert.equal(canMoveBlock(bs, 0, 1), false);
  assert.equal(moveBlock(bs, 0, 1), bs);
  assert.equal(canMoveBlock(bs, 2, -1), true);
  assert.deepEqual(ids(moveBlock(bs, 2, -1)), [MESSAGE_BLOCK_ID, 'b', 'a']);
  assert.deepEqual(ids(moveBlock(bs, 1, 1)), [MESSAGE_BLOCK_ID, 'b', 'a']);
});

test('without a message, moving is unchanged', () => {
  const bs = [title('a'), title('b')];
  assert.equal(canMoveBlock(bs, 1, -1), true);
  assert.deepEqual(ids(moveBlock(bs, 1, -1)), ['b', 'a']);
  assert.equal(canMoveBlock(bs, 0, -1), false);
  assert.equal(canMoveBlock(bs, 1, 1), false);
});
