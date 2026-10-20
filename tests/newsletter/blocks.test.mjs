import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_TYPES, newBlockId, createBlock, insertBlock, moveBlock, removeBlock, updateBlockData, blockProblem, blocksProblems, normaliseBlocks,
} from '../../components/newsletters/lib/blocks.ts';

const title = (id, text = 'Hi') => ({ id, type: 'title', data: { text, size: 'large' } });

test('createBlock makes every type with the §8 fields', () => {
  assert.deepEqual(BLOCK_TYPES, ['image', 'title', 'text', 'youtube', 'button', 'divider']);
  assert.deepEqual(createBlock('image', 'b1'), { id: 'b1', type: 'image', data: { url: '', alt: '', link: null } });
  assert.deepEqual(createBlock('title', 'b2').data, { text: '', size: 'large' });
  assert.deepEqual(createBlock('text', 'b3').data, { html: '' });
  assert.deepEqual(createBlock('youtube', 'b4').data, { url: '' });
  assert.deepEqual(createBlock('button', 'b5').data, { label: 'Learn more', url: '', color: '#6C60FF' });
  assert.deepEqual(createBlock('divider', 'b6').data, { style: 'line' });
});

test('newBlockId avoids ids in use, even with a stuck random, and fits the API id rule', () => {
  const blocks = [title('b1'), title('b2')];
  const id = newBlockId(blocks, () => 0);
  assert.ok(!['b1', 'b2'].includes(id));
  assert.match(newBlockId([]), /^b[a-z0-9]{4,}$/);
  assert.match(newBlockId([]), /^[A-Za-z0-9_-]{1,40}$/);
});

test('insert, move, remove, update', () => {
  const a = title('a'); const b = title('b'); const c = title('c');
  assert.deepEqual(insertBlock([a, c], 1, b).map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(insertBlock([a], 99, b).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(insertBlock([a], -5, b).map((x) => x.id), ['b', 'a']);
  const full = Array.from({ length: 40 }, (_, i) => title(`x${i}`));
  assert.equal(insertBlock(full, 0, a), full, '40 sections is the limit');
  assert.deepEqual(moveBlock([a, b, c], 2, -1).map((x) => x.id), ['a', 'c', 'b']);
  assert.deepEqual(moveBlock([a, b, c], 0, 1).map((x) => x.id), ['b', 'a', 'c']);
  const same = [a, b];
  assert.equal(moveBlock(same, 0, -1), same);
  assert.equal(moveBlock(same, 1, 1), same);
  assert.deepEqual(removeBlock([a, b, c], 'b').map((x) => x.id), ['a', 'c']);
  assert.deepEqual(updateBlockData([a, b], 'b', { text: 'New' })[1], { id: 'b', type: 'title', data: { text: 'New', size: 'large' } });
});

test('blockProblem says what to fix', () => {
  assert.equal(blockProblem(createBlock('image', 'i')), 'Add an image, or remove this section.');
  assert.equal(blockProblem({ id: 'i', type: 'image', data: { url: 'http://x.ca/a.png', alt: '', link: null } }), 'Use an image link that starts with https://.');
  assert.equal(blockProblem({ id: 'i', type: 'image', data: { url: 'https://x.ca/a.png', alt: '', link: 'http://x.ca' } }), 'The image link must start with https://.');
  assert.equal(blockProblem(createBlock('title', 't')), 'Type a title, or remove this section.');
  assert.equal(blockProblem({ id: 't', type: 'text', data: { html: '<p><br></p>' } }), 'Write some text, or remove this section.');
  assert.equal(blockProblem({ id: 'y', type: 'youtube', data: { url: 'https://vimeo.com/1' } }), 'Paste a YouTube link, like https://www.youtube.com/watch?v=…');
  assert.equal(blockProblem({ id: 'y', type: 'youtube', data: { url: 'https://youtu.be/dQw4w9WgXcQ' } }), null);
  assert.equal(blockProblem(createBlock('button', 'b')), 'Add the link the button opens (https://…).');
  assert.equal(blockProblem({ id: 'b', type: 'button', data: { label: ' ', url: 'https://x.ca', color: '#6C60FF' } }), 'Add the button text.');
  assert.equal(blockProblem({ id: 'b', type: 'button', data: { label: 'Go', url: 'https://x.ca', color: 'red' } }), 'Pick a button colour.');
  assert.equal(blockProblem(createBlock('divider', 'd')), null);
  assert.deepEqual(blocksProblems([createBlock('divider', 'd'), createBlock('title', 't')]), { t: 'Type a title, or remove this section.' });
});

// The API stores an empty link or URL as null and a missing title size as medium (NewsletterContent::blockData).
test('normaliseBlocks turns what the API returns into editor data', () => {
  const raw = [
    { id: 'i', type: 'image', data: { url: null, alt: '', link: null } },
    { id: 'y', type: 'youtube', data: { url: null } },
    { id: 'b', type: 'button', data: { label: 'Go', url: null, color: '#6C60FF' } },
    { id: 't', type: 'title', data: { text: 'Hi' } },
    { id: 'x', type: 'text', data: {} },
    { id: 'd', type: 'divider', data: { style: 'space' } },
    { id: 'z', type: 'poll', data: {} },
    null,
  ];
  assert.deepEqual(normaliseBlocks(raw), [
    { id: 'i', type: 'image', data: { url: '', alt: '', link: null } },
    { id: 'y', type: 'youtube', data: { url: '' } },
    { id: 'b', type: 'button', data: { label: 'Go', url: '', color: '#6C60FF' } },
    { id: 't', type: 'title', data: { text: 'Hi', size: 'medium' } },
    { id: 'x', type: 'text', data: { html: '' } },
    { id: 'd', type: 'divider', data: { style: 'space' } },
  ]);
  assert.deepEqual(normaliseBlocks(undefined), []);
});
