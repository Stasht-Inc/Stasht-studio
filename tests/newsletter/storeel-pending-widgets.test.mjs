// Deepak 24 Nov 2026 (P1): on Create Storeel every "+" option opens its editor right there; the widget waits in the
// preview at its "+" (moved / edited / removed like moments) and is made at its place after Save as Draft / Save & Send.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  widgetSlots, resolveAnchor, orderedPending, pendingMoves, movePending, pendingPreviewWidgets, pendingCreateBodies, failedWidgetsMessage, isPinnedPending,
} from '../../components/storeel/lib/pendingWidgets.ts';
import { widgetsByAnchor, postIdsAfterCreate, WIDGET_TOP, WIDGET_END, WIDGET_PINNED } from '../../components/storeel/lib/storeelWidgets.ts';

const photo = (key, postId) => ({ kind: 'photo', key, ...(postId ? { postId } : {}), image: 'x', video: false, title: '', caption: '', location: '', date: '' });
const linked = (id) => ({ kind: 'campaign', key: `campaign-${id}`, sourceId: String(id), image: null, title: `C${id}`, meta: '1 photo' });
const car = (id) => ({ kind: 'vehicle', key: `car-${id}`, sourceId: String(id), image: null, title: 'Car', price: '', tags: [] });
const w = (key, anchor, extra = {}) => ({ key, kind: 'quote', label: key, anchor, widgetType: 'quote', widgetData: { text: key, author: '' }, ...extra });
const cta = (key, anchor, data = {}) => ({ key, kind: 'cta', label: key, anchor, widgetType: 'cta', widgetData: { title: key, buttonText: 'Go', buttonLink: 'https://a.co', mode: 'link', ...data } });

const moments = [photo('photo-a'), photo('photo-b'), car(9)];

test('places: under the cover, then after each moment with a "+" (not a vehicle)', () => {
  assert.deepEqual(widgetSlots(moments), [null, 'photo-a', 'photo-b']);
  assert.deepEqual(widgetSlots([]), [null]);
});

test('a "+" anchors the widget; the Moments card (undefined) or a gone moment: after the last moment, else the top', () => {
  assert.equal(resolveAnchor(moments, null), null);
  assert.equal(resolveAnchor(moments, 'photo-a'), 'photo-a');
  assert.equal(resolveAnchor(moments, undefined), 'photo-b');
  assert.equal(resolveAnchor(moments, 'photo-gone'), 'photo-b');
  assert.equal(resolveAnchor([], undefined), null);
});

test('the list shows by place, then in its own order', () => {
  const list = [w('x', 'photo-b'), w('y', null), w('z', 'photo-a'), w('q', 'photo-b')];
  assert.deepEqual(orderedPending(list, moments).map((x) => x.key), ['y', 'z', 'x', 'q']);
});

test('Move up / Move down: past a neighbour, then past a moment; never above the top or below the end', () => {
  const list = [w('top', null), w('a1', 'photo-a'), w('a2', 'photo-a'), w('b1', 'photo-b')];
  assert.deepEqual(pendingMoves(list, moments, 'top'), { up: false, down: true });
  assert.deepEqual(pendingMoves(list, moments, 'b1'), { up: true, down: false });
  // Past its neighbour, same place.
  let next = movePending(list, moments, 'a2', 'up');
  assert.deepEqual(orderedPending(next, moments).map((x) => `${x.key}@${x.anchor}`), ['top@null', 'a2@photo-a', 'a1@photo-a', 'b1@photo-b']);
  // First after photo-a, up: above photo-a → the end of the top group.
  next = movePending(next, moments, 'a2', 'up');
  assert.deepEqual(orderedPending(next, moments).map((x) => `${x.key}@${x.anchor}`), ['top@null', 'a2@null', 'a1@photo-a', 'b1@photo-b']);
  // Last after photo-a, down: below photo-b → the start of photo-b's group.
  next = movePending(next, moments, 'a1', 'down');
  assert.deepEqual(orderedPending(next, moments).map((x) => `${x.key}@${x.anchor}`), ['top@null', 'a2@null', 'a1@photo-b', 'b1@photo-b']);
  // At an end: nothing changes.
  assert.deepEqual(movePending(next, moments, 'top', 'up').map((x) => x.key), next.map((x) => x.key));
});

test('a pinned "Share Request a Moment" shows last and has no Move', () => {
  const pinned = cta('pin', 'photo-a', { mode: 'request_moment', buttonLink: '', pinToBottom: true });
  assert.ok(isPinnedPending(pinned));
  assert.deepEqual(pendingMoves([pinned], moments, 'pin'), { up: false, down: false });
  const drawn = pendingPreviewWidgets([pinned], moments);
  assert.equal(drawn[0].pinned, true);
  assert.equal(widgetsByAnchor(moments, drawn).get(WIDGET_PINNED)?.[0].id, 'pin');
});

test('the preview draws them at their moment, like saved widgets (top / moment / end when the moment is gone)', () => {
  const list = [w('t', null), cta('c', 'photo-a'), w('g', 'photo-gone')];
  const drawn = pendingPreviewWidgets(list, moments);
  const c = drawn.find((x) => x.id === 'c');
  assert.equal(c.type, 'cta');
  assert.equal(c.buttonText, 'Go');
  assert.equal(c.mode, 'link');
  const groups = widgetsByAnchor(moments, drawn);
  assert.deepEqual(groups.get(WIDGET_TOP).map((x) => x.id), ['t']);
  assert.deepEqual(groups.get('photo-a').map((x) => x.id), ['c']);
  assert.deepEqual(groups.get(WIDGET_END).map((x) => x.id), ['g']);
  // A saved widget (afterPostId) is still placed by its post id.
  const saved = { id: '7', type: 'quote', afterPostId: '55', order: 0, text: 'q' };
  assert.deepEqual(widgetsByAnchor([photo('post-55', 55)], [saved]).get('post-55').map((x) => x.id), ['7']);
});

test('after Save as Draft: each widget is made after its moment\'s new id, numbered in its place', () => {
  const form = [photo('photo-a'), photo('photo-b')];
  const fresh = [photo('post-11', 11), photo('post-12', 12)];
  const ids = postIdsAfterCreate(['photo-a', 'photo-b'], fresh);
  const list = [cta('c1', 'photo-a'), w('q', null), w('h', 'photo-a'), w('y', 'photo-b')];
  const bodies = pendingCreateBodies(list, form, (m) => ids.get(m.key));
  assert.deepEqual(bodies.map((b) => [b.key, b.body.widget_type, b.body.after_post_id, b.body.widget_order]), [
    ['q', 'quote', null, 0],
    ['c1', 'cta', '11', 0],
    ['h', 'quote', '11', 1],
    ['y', 'quote', '12', 0],
  ]);
  assert.deepEqual(bodies[1].body.widget_data, { title: 'c1', buttonText: 'Go', buttonLink: 'https://a.co', mode: 'link' });
});

test('after a linked campaign: the moment above it; unknown ids: the fallback; an order base for widgets already there', () => {
  const form = [photo('photo-a'), linked(5)];
  const list = [w('l', 'campaign-5')];
  assert.equal(pendingCreateBodies(list, form, (m) => (m.key === 'photo-a' ? 21 : undefined))[0].body.after_post_id, '21');
  assert.equal(pendingCreateBodies([w('p', 'photo-a')], form, () => undefined, () => 0, 99)[0].body.after_post_id, '99');
  assert.equal(pendingCreateBodies([w('p', 'photo-a')], form, () => 21, (after) => (after === '21' ? 3 : 0))[0].body.widget_order, 3);
});

test('a failed widget is named in the message', () => {
  assert.equal(failedWidgetsMessage([]), '');
  assert.equal(failedWidgetsMessage(['Book now']), '“Book now” couldn’t be added. Add it again from the Storeel’s page.');
  assert.equal(failedWidgetsMessage(['A', 'B', 'C']), '“A”, “B” and “C” couldn’t be added. Add them again from the Storeel’s page.');
});
