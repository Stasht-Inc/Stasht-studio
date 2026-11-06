// Chris (6 Nov, points 5 and 7). 5: "Need duplicate row": Duplicate in the selected section's action bar copies the
// section (all its words, settings and styles) directly below it with a new id, and selects the copy. Every section
// type, never the Message section, and never past the 40-section limit. 7: the Button section's "Full width" and
// "Open in new window" options, stored like the API stores them (NewsletterContent::buttonOptions: only when on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canDuplicateBlock, duplicateBlock } from '../../components/newsletters/lib/duplicateBlock.ts';
import { buttonOptionPatch, buttonOptionsOf, withButtonOption } from '../../components/newsletters/lib/buttonOptions.ts';
import { createBlock, normaliseBlocks, blocksToInput } from '../../components/newsletters/lib/blocks.ts';
import { MESSAGE_BLOCK_ID } from '../../components/newsletters/lib/messageBlock.ts';

const title = (id, text = 'Hi') => ({ id, type: 'title', data: { text, size: 'large' } });
const ids = (blocks) => blocks.map((b) => b.id);
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

const EVERY_TYPE = [
  { id: 'i1', type: 'image', data: { url: 'https://cdn.example.com/a.jpg', alt: 'Team', link: 'https://example.com' } },
  { id: 't1', type: 'title', data: { text: 'Fall event', size: 'medium', align: 'center', color: '#DC2626', background_color: '#FEF3C7', background_image_url: 'https://cdn.example.com/bg.jpg' } },
  { id: 'x1', type: 'text', data: { html: '<p>Hi <span style="font-size:20px">there</span></p>', align: 'right', background_color: '#111827' } },
  { id: 'y1', type: 'youtube', data: { url: 'https://youtu.be/dQw4w9WgXcQ' } },
  { id: 'u1', type: 'button', data: { label: 'RSVP', url: 'https://example.com/rsvp', color: '#4F6752', full_width: true, new_window: true } },
  { id: 'd1', type: 'divider', data: { style: 'space' } },
  { id: 'c1', type: 'campaigns', data: {
    selections: [{ kind: 'product', id: 7 }, { kind: 'campaign', id: 3 }], campaign_ids: [3], columns: 2,
    items: [{ kind: 'product', id: 7, title: 'Lever', description: '', cover_url: null, url: 'https://shop.example/lever', date: '2026-10-01' }],
    overrides: { 'product:7': { title: 'Our best lever', button_text: 'Shop now', image_url: 'https://cdn.example.com/mine.jpg' } },
  } },
];

test('every section type is copied directly below it, with all its data, a new id, and the copy is selected', () => {
  for (const [index, block] of EVERY_TYPE.entries()) {
    const r = duplicateBlock(EVERY_TYPE, block.id, seq(0.123456789));
    assert.equal(r.outcome, 'duplicated', block.type);
    assert.equal(r.blocks.length, EVERY_TYPE.length + 1);
    const copy = r.blocks[index + 1];
    assert.equal(r.id, copy.id, `${block.type}: the id to select is the copy's`);
    assert.notEqual(copy.id, block.id);
    assert.match(copy.id, /^[A-Za-z0-9_-]{1,40}$/, 'an id the API accepts');
    assert.equal(copy.type, block.type);
    assert.deepEqual(copy.data, block.data, `${block.type}: same data and styles`);
    assert.equal(r.blocks[index], block, 'the original stays where it was, untouched');
    assert.deepEqual(ids(r.blocks).filter((id) => id !== copy.id), ids(EVERY_TYPE), 'every other section stays in order');
  }
});

test('the copy is deep: changing it (card edits, picks, styles) never changes the original', () => {
  const r = duplicateBlock(EVERY_TYPE, 'c1');
  const copy = r.blocks[7];
  assert.notEqual(copy.data, EVERY_TYPE[6].data);
  assert.notEqual(copy.data.overrides, EVERY_TYPE[6].data.overrides);
  assert.notEqual(copy.data.overrides['product:7'], EVERY_TYPE[6].data.overrides['product:7']);
  assert.notEqual(copy.data.selections, EVERY_TYPE[6].data.selections);
  assert.notEqual(copy.data.items[0], EVERY_TYPE[6].data.items[0]);
  copy.data.overrides['product:7'].title = 'Changed';
  copy.data.selections.push({ kind: 'campaign', id: 9 });
  assert.equal(EVERY_TYPE[6].data.overrides['product:7'].title, 'Our best lever');
  assert.equal(EVERY_TYPE[6].data.selections.length, 2);
  // What the PUT sends for the copy: its picks, columns and card edits (the API builds its own cards).
  const sent = blocksToInput([copy])[0];
  assert.deepEqual(sent.data.overrides, { 'product:7': { title: 'Changed', button_text: 'Shop now', image_url: 'https://cdn.example.com/mine.jpg' } });
  assert.equal(sent.data.columns, 2);
});

test('the new id is never one already used', () => {
  // The random part would give "b4fzzxxx" again: newBlockId tries another.
  const blocks = [{ id: 'b4fzzxxx', type: 'divider', data: { style: 'line' } }, title('x')];
  const r = duplicateBlock(blocks, 'x', seq(0.123456789, 0.987654321));
  assert.equal(new Set(ids(r.blocks)).size, 3);
  const twice = duplicateBlock(r.blocks, 'x');
  assert.equal(new Set(ids(twice.blocks)).size, 4, 'duplicating again makes another new id');
});

test('the Message section is never duplicated (no button, and nothing happens if asked)', () => {
  const message = { id: MESSAGE_BLOCK_ID, type: 'text', data: { html: '<p>Hello</p>' } };
  const blocks = [message, title('a')];
  assert.equal(canDuplicateBlock(message), false);
  assert.equal(canDuplicateBlock(blocks[1]), true);
  for (const block of EVERY_TYPE) assert.equal(canDuplicateBlock(block), true, block.type);
  const r = duplicateBlock(blocks, MESSAGE_BLOCK_ID);
  assert.equal(r.outcome, 'not-allowed');
  assert.equal(r.blocks, blocks, 'same array: nothing to save');
});

test('a full email (40 sections) is not changed: the editor shows the limit message', () => {
  const full = Array.from({ length: 40 }, (_, i) => title(`x${i}`));
  const r = duplicateBlock(full, 'x3');
  assert.equal(r.outcome, 'full');
  assert.equal(r.blocks, full);
  const almost = full.slice(0, 39);
  assert.equal(duplicateBlock(almost, 'x3').blocks.length, 40, 'the 40th section can still be a copy');
});

test('a section that has gone (deleted meanwhile) changes nothing', () => {
  const blocks = [title('a')];
  const r = duplicateBlock(blocks, 'gone');
  assert.equal(r.outcome, 'missing');
  assert.equal(r.blocks, blocks);
});

test('duplicating the last section puts the copy at the end; the first, right under it', () => {
  const blocks = [title('a'), title('b'), title('c')];
  assert.equal(duplicateBlock(blocks, 'c').blocks[3].data.text, 'Hi');
  assert.deepEqual(ids(duplicateBlock(blocks, 'a').blocks).filter((id) => !['a', 'b', 'c'].includes(id)).length, 1);
  assert.equal(ids(duplicateBlock(blocks, 'a').blocks)[0], 'a');
  assert.equal(ids(duplicateBlock(blocks, 'a').blocks)[2], 'b');
});

// ---- 7. button options ---------------------------------------------------------------------------------------------

test('a new button opens in a new window and is not full width', () => {
  assert.deepEqual(createBlock('button', 'b5').data, { label: 'Learn more', url: '', color: '#6C60FF', new_window: true });
});

test('button options: only true is kept (the API stores them only when on); older buttons have neither', () => {
  assert.deepEqual(buttonOptionsOf({ full_width: true, new_window: true }), { full_width: true, new_window: true });
  assert.deepEqual(buttonOptionsOf({ full_width: false, new_window: 'yes' }), {});
  assert.deepEqual(buttonOptionsOf({}), {});
  const [older, newer] = normaliseBlocks([
    { id: 'u1', type: 'button', data: { label: 'Go', url: 'https://example.com', color: '#6C60FF' } },
    { id: 'u2', type: 'button', data: { label: 'Go', url: 'https://example.com', color: '#6C60FF', full_width: true, new_window: true } },
  ]);
  assert.deepEqual(older.data, { label: 'Go', url: 'https://example.com', color: '#6C60FF' }, 'an older button keeps exactly its keys');
  assert.deepEqual(newer.data, { label: 'Go', url: 'https://example.com', color: '#6C60FF', full_width: true, new_window: true });
});

test('ticking and unticking an option: on stores true, off removes the key (as the API does)', () => {
  const data = { label: 'Go', url: 'https://example.com', color: '#6C60FF', new_window: true };
  assert.deepEqual(withButtonOption(data, 'full_width', true), { ...data, full_width: true });
  const off = withButtonOption(data, 'new_window', false);
  assert.ok(!('new_window' in off));
  assert.deepEqual(off, { label: 'Go', url: 'https://example.com', color: '#6C60FF' });
  assert.equal(data.new_window, true, 'the data passed in is not changed');
});

test('the editor patch for an option: true when ticked, undefined (left out of the JSON) when unticked', () => {
  assert.deepEqual(buttonOptionPatch('full_width', true), { full_width: true });
  const off = buttonOptionPatch('new_window', false);
  assert.ok('new_window' in off && off.new_window === undefined);
  assert.equal(JSON.stringify({ label: 'Go', ...off }), '{"label":"Go"}');
});
