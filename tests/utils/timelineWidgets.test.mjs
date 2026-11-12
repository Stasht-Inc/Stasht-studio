// Chris, 8 Nov 2026 (review I1): the campaign page draws a moment's widgets grouped by type — HTML, YouTube, Quote,
// Shopify product, AI Creator, then Calls to Action — and pinned "Share Request a Moment" buttons after the last item.
// One helper says so for the campaign page and the Storeel preview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIMELINE_WIDGET_ORDER, isPinnedCta, isTimelineCta, orderTimelineWidgets } from '../../utils/timelineWidgets.ts';

test("the campaign page's type order under a moment", () => {
  assert.deepEqual([...TIMELINE_WIDGET_ORDER], ['html', 'youtube', 'quote', 'product', 'ai_creator', 'cta']);
});

test('widgets follow their saved widget_order (Chris 12 Nov); the older id, then the old type order, break ties', () => {
  const w = [
    { id: 'c1', type: 'cta', order: 0 }, { id: 'q1', type: 'quote', order: 1 }, { id: 'h2', type: 'html', order: 5 },
    { id: 'h1', type: 'html', order: 2 }, { id: 'a1', type: 'ai_creator', order: 3 }, { id: 'p1', type: 'product', order: 9 },
    { id: 'y1', type: 'youtube', order: 7 },
  ];
  assert.deepEqual(orderTimelineWidgets(w).map((x) => x.id), ['c1', 'q1', 'h1', 'a1', 'h2', 'y1', 'p1']);
  // Old data saved every widget with order 0: the older (lower id) first, whatever its type.
  const old = [{ id: '30', type: 'html', order: 0 }, { id: '12', type: 'quote', order: 0 }, { id: '20', type: 'cta', order: 0 }];
  assert.deepEqual(orderTimelineWidgets(old).map((x) => x.id), ['12', '20', '30']);
  // Same order and no saved id: the old type order.
  assert.deepEqual(orderTimelineWidgets([{ id: 'x', type: 'cta' }, { id: 'y', type: 'html' }]).map((x) => x.id), ['y', 'x']);
});

test('a pinned Call to Action is kept out of the timeline (it shows after the last item)', () => {
  assert.equal(isPinnedCta({ pinToBottom: true }), true);
  assert.equal(isTimelineCta({ pinToBottom: true }), false);
  assert.equal(isTimelineCta({ pinToBottom: false }), true);
  assert.equal(isTimelineCta({}), true);
});
