// Deepak, 24 Nov 2026 (batch b, P2): "what is the point of duplicating, if I can't move it up or down?" Every widget's
// ⋮ menu on the campaign page gets Move up / Move down, like moments. Widgets and moments share one timeline: the top
// slot's widgets (after_post_id null, under the "Timeline" header), then each moment followed by its slot's widgets,
// each slot in widget_order (slotWidgetRanks). A move steps over exactly one item — the widget or the moment next to
// it — so a widget first in its slot moving up goes past its moment, to the end of the moment before (or the top
// slot); one last in its slot moving down goes past the next moment, to the start of that moment's slot.
// The API (PUT memories/{id}/widgets/{w}/move) takes the result: the slot and the widget it now follows.
// Pure, so `node --test` loads it.
import { slotWidgetRanks, type SlotWidget } from './timelineAddSlots.ts';

/** Where a widget goes: its slot (null = the top) and the widget it then follows (null = first in the slot). */
export interface WidgetMoveTarget {
  afterPostId: string | null;
  afterWidgetId: string | null;
}

const slotKey = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));

/** The slot's widgets in drawn order. */
function slotList(widgets: ReadonlyArray<SlotWidget>, slot: string | null): SlotWidget[] {
  const inSlot = widgets.filter((w) => slotKey(w.afterPostId) === slotKey(slot));
  const ranks = slotWidgetRanks(inSlot);
  return [...inSlot].sort((a, b) => (ranks.get(String(a.id)) ?? 0) - (ranks.get(String(b.id)) ?? 0));
}

/**
 * Where Move up / Move down puts widget `id`, or null when it can't go that way (first / last item of the timeline,
 * or a widget whose moment isn't on the timeline).
 * @param postOrder the timeline's moments (top-level posts) in drawn order, as ids
 * @param widgets every widget the timeline draws in a slot (pinned buttons and in-card product buttons left out)
 */
export function widgetMoveTarget(
  postOrder: ReadonlyArray<string>,
  widgets: ReadonlyArray<SlotWidget>,
  id: string,
  direction: 'up' | 'down',
): WidgetMoveTarget | null {
  const me = widgets.find((w) => String(w.id) === String(id));
  if (!me) return null;
  const slot = me.afterPostId === null || me.afterPostId === undefined || me.afterPostId === '' ? null : String(me.afterPostId);
  const postIdx = slot === null ? -1 : postOrder.indexOf(slot);
  if (slot !== null && postIdx === -1) return null; // its moment isn't drawn: no place to step from
  const list = slotList(widgets, slot);
  const i = list.findIndex((w) => String(w.id) === String(id));

  if (direction === 'up') {
    if (i > 0) return { afterPostId: slot, afterWidgetId: i >= 2 ? String(list[i - 2].id) : null };
    if (slot === null) return null; // the first item of the timeline
    const prevSlot = postIdx > 0 ? postOrder[postIdx - 1] : null;
    const prev = slotList(widgets, prevSlot).filter((w) => String(w.id) !== String(id));
    return { afterPostId: prevSlot, afterWidgetId: prev.length ? String(prev[prev.length - 1].id) : null };
  }
  if (i < list.length - 1) return { afterPostId: slot, afterWidgetId: String(list[i + 1].id) };
  const nextSlot = postOrder[postIdx + 1];
  if (nextSlot === undefined) return null; // the last item of the timeline
  return { afterPostId: nextSlot, afterWidgetId: null };
}

/**
 * The widgets after a move, as the page holds them: the moved one in its new slot and that slot renumbered 0, 1, 2 …
 * in its new order (what the API saves). Returns id → { afterPostId, widget_order } for every widget that changed.
 */
export function applyWidgetMove(
  widgets: ReadonlyArray<SlotWidget>,
  id: string,
  target: WidgetMoveTarget,
): Map<string, { afterPostId: string | null; widget_order: number }> {
  const others = slotList(widgets, target.afterPostId).filter((w) => String(w.id) !== String(id));
  const at = target.afterWidgetId === null ? 0 : others.findIndex((w) => String(w.id) === String(target.afterWidgetId)) + 1;
  const ids = others.map((w) => String(w.id));
  ids.splice(at, 0, String(id));
  const out = new Map<string, { afterPostId: string | null; widget_order: number }>();
  ids.forEach((wid, n) => out.set(wid, { afterPostId: target.afterPostId, widget_order: n }));
  return out;
}
