// tests/utils/widgetMove.test.mjs
// Deepak, 24 Nov 2026 (batch b, P2): Move up / Move down on every widget, moments and widgets in one timeline order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyWidgetMove, widgetMoveTarget } from '../../utils/widgetMove.ts';

// Timeline: [top: T1] · P1 · [A, B] · P2 · [] · P3 · [C]
const posts = ['1', '2', '3'];
const widgets = [
  { id: 'T1', type: 'quote', afterPostId: null, widget_order: 0 },
  { id: 'A', type: 'cta', afterPostId: '1', widget_order: 0 },
  { id: 'B', type: 'html', afterPostId: '1', widget_order: 1 },
  { id: 'C', type: 'cta', afterPostId: '3', widget_order: 0 },
];

test('the first item has no Move up; the last no Move down', () => {
  assert.equal(widgetMoveTarget(posts, widgets, 'T1', 'up'), null);
  assert.equal(widgetMoveTarget(posts, widgets, 'C', 'down'), null);
});

test('inside a slot: up/down swap with the neighbouring widget', () => {
  assert.deepEqual(widgetMoveTarget(posts, widgets, 'B', 'up'), { afterPostId: '1', afterWidgetId: null });
  assert.deepEqual(widgetMoveTarget(posts, widgets, 'A', 'down'), { afterPostId: '1', afterWidgetId: 'B' });
});

test('first in its slot moving up goes past its moment, to the end of the slot before (or the top)', () => {
  assert.deepEqual(widgetMoveTarget(posts, widgets, 'A', 'up'), { afterPostId: null, afterWidgetId: 'T1' });
  assert.deepEqual(widgetMoveTarget(posts, widgets, 'C', 'up'), { afterPostId: '2', afterWidgetId: null });
});

test('last in its slot moving down goes past the next moment, first in its slot', () => {
  assert.deepEqual(widgetMoveTarget(posts, widgets, 'T1', 'down'), { afterPostId: '1', afterWidgetId: null });
  assert.deepEqual(widgetMoveTarget(posts, widgets, 'B', 'down'), { afterPostId: '2', afterWidgetId: null });
});

test('old data: same widget_order in a slot, the lower id first', () => {
  const ws = [{ id: '10', type: 'cta', afterPostId: '1', widget_order: 0 }, { id: '9', type: 'cta', afterPostId: '1', widget_order: 0 }];
  assert.deepEqual(widgetMoveTarget(['1'], ws, '10', 'up'), { afterPostId: '1', afterWidgetId: null });
  assert.deepEqual(widgetMoveTarget(['1'], ws, '9', 'up'), { afterPostId: null, afterWidgetId: null });
  assert.deepEqual(widgetMoveTarget(['1'], ws, '9', 'down'), { afterPostId: '1', afterWidgetId: '10' });
});

test('a widget whose moment is not on the timeline does not move', () => {
  assert.equal(widgetMoveTarget(['1'], [{ id: 'X', type: 'cta', afterPostId: '99', widget_order: 0 }], 'X', 'up'), null);
  assert.equal(widgetMoveTarget(['1'], [], 'nope', 'down'), null);
});

test('applyWidgetMove renumbers the target slot with the widget in its place', () => {
  const up = applyWidgetMove(widgets, 'A', { afterPostId: null, afterWidgetId: 'T1' });
  assert.deepEqual([...up.entries()], [['T1', { afterPostId: null, widget_order: 0 }], ['A', { afterPostId: null, widget_order: 1 }]]);
  const first = applyWidgetMove(widgets, 'B', { afterPostId: '1', afterWidgetId: null });
  assert.deepEqual([...first.entries()].map(([id, v]) => [id, v.widget_order]), [['B', 0], ['A', 1]]);
});
