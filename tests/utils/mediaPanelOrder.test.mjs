// tests/utils/mediaPanelOrder.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
// Chris, 19 Nov 2026: dragging photos up and down in the campaign's Media panel organises the campaign (saved order).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaInTimelineOrder, moveInTimeline, nextMediaSort, planMediaDrop } from '../../utils/campaignMoments.ts';

const P = (id) => ({ type: 'post', id: String(id) });
const L = (id) => ({ type: 'linked', id: String(id) });
const photo = (id, parent_id = null) => ({ id, parent_id });
// Timeline 11, linked 7, 12, 13; 12 holds 21 and 22.
const TIMELINE = [P(11), L(7), P(12), P(13)];
const PHOTOS = [photo(13), photo(21, 12), photo(11), photo(12), photo(22, 12)];
const ids = (list) => list.map((i) => i.id);

test('the panel follows the campaign order, each moment followed by its own photos', () => {
  assert.deepEqual(ids(mediaInTimelineOrder(PHOTOS, TIMELINE)), [11, 12, 21, 22, 13]);
  // Photos the order doesn't know yet (just uploaded) come last, with their sub-photos; orphans at the very end.
  assert.deepEqual(ids(mediaInTimelineOrder([...PHOTOS, photo(14), photo(31, 99)], TIMELINE)), [11, 12, 21, 22, 13, 14, 31]);
  assert.deepEqual(ids(mediaInTimelineOrder(PHOTOS, null)), [13, 11, 12, 21, 22]);
});

test('moveInTimeline puts a moment right before / after another, linked campaigns keep their place', () => {
  assert.deepEqual(moveInTimeline(TIMELINE, P(13), 'before', P(11)), [P(13), P(11), L(7), P(12)]);
  assert.deepEqual(moveInTimeline(TIMELINE, P(11), 'after', P(12)), [L(7), P(12), P(11), P(13)]);
  assert.deepEqual(moveInTimeline(TIMELINE, P(11), 'after', P(99)), TIMELINE, 'unknown anchor: unchanged');
});

test('dragging a moment up puts it before the target, down after it — and that is what gets saved', () => {
  const shown = mediaInTimelineOrder(PHOTOS, TIMELINE); // 11, 12, 21, 22, 13
  const up = planMediaDrop(shown, TIMELINE, 13, 12);
  assert.equal(up.kind, 'moment');
  assert.deepEqual([up.item, up.where, up.anchor], [P(13), 'before', P(12)]);
  assert.deepEqual(up.order, [P(11), L(7), P(13), P(12)]);

  const down = planMediaDrop(shown, TIMELINE, 11, 13);
  assert.deepEqual([down.where, down.anchor], ['after', P(13)]);
  assert.deepEqual(down.order, [L(7), P(12), P(13), P(11)]);

  // Dropped on another moment's sub-photo: next to that moment.
  const onSub = planMediaDrop(shown, TIMELINE, 13, 21);
  assert.deepEqual([onSub.where, onSub.anchor], ['before', P(12)]);
  // String ids from the page work the same.
  assert.equal(planMediaDrop(shown.map((p) => ({ ...p, id: String(p.id) })), TIMELINE, '13', '12').kind, 'moment');
});

test('a reversed panel (campaign order, bottom first) flips before / after', () => {
  const shown = mediaInTimelineOrder(PHOTOS, TIMELINE).reverse(); // 13, 22, 21, 12, 11
  const drop = planMediaDrop(shown, TIMELINE, 11, 13, true); // dragged up on screen = later in the campaign
  assert.deepEqual([drop.where, drop.anchor], ['after', P(13)]);
});

test('sub-photos shuffle only within their moment, on screen; nothing else is saved', () => {
  const shown = mediaInTimelineOrder(PHOTOS, TIMELINE);
  assert.deepEqual(planMediaDrop(shown, TIMELINE, 22, 21), { kind: 'local' });
  assert.deepEqual(planMediaDrop(shown, TIMELINE, 22, 12), { kind: 'local' });
  assert.deepEqual(planMediaDrop(shown, TIMELINE, 22, 13), { kind: 'none', reason: 'other-moment' });
  assert.deepEqual(planMediaDrop(shown, TIMELINE, 12, 21), { kind: 'none', reason: 'same' }, 'a moment on its own photo');
  assert.deepEqual(planMediaDrop(shown, TIMELINE, 12, 12), { kind: 'none', reason: 'same' });
  assert.deepEqual(planMediaDrop(shown, TIMELINE, 12, 404), { kind: 'none', reason: 'unknown' });
  assert.deepEqual(planMediaDrop([...shown, photo(14)], TIMELINE, 14, 11), { kind: 'local' }, 'not in the saved order yet');
});

test('the desktop sort button: campaign order ↔ newest first (two states)', () => {
  // Two states only since 20 Nov (Chris): campaign order ↔ newest first; no "oldest first".
  assert.deepEqual(nextMediaSort('order', 'asc'), { by: 'date', dir: 'desc' });
  assert.deepEqual(nextMediaSort('date', 'desc'), { by: 'order', dir: 'asc' });
  assert.deepEqual(nextMediaSort('date', 'asc'), { by: 'order', dir: 'asc' });
  assert.deepEqual(nextMediaSort('name', 'desc'), { by: 'order', dir: 'asc' });
});
