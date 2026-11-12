// Chris, 9 Nov 2026 (point 5): "add the + options on the right side, and remove it from the left … it should be in the
// same spot everywhere." On the desktop campaign page the "+" (Add Widget) now sits in the right-hand timeline of cards:
// one under the "Timeline • N moments" header (the top, after_post_id null) and one after every moment card, the last
// one included. Linked campaigns can't be an after_post_id, so no "+" follows them (the left list had none either).
import type { TimelineItem } from './addMomentPosition.ts';
import type { AddWidgetKind, AddWidgetOption } from '../components/widgets/addWidgetOptions.ts';
import { orderTimelineWidgets } from './timelineWidgets.ts';

/** The after_post_id of the "+" drawn after this timeline item, or undefined when none follows it. */
export function addSlotAfter(item: TimelineItem | { type: string; id: unknown } | null | undefined): string | undefined {
  if (!item || item.type !== 'post' || item.id === null || item.id === undefined || String(item.id) === '') return undefined;
  return String(item.id);
}

// The collaborator (shared) view's left "+" offered Moment, Call to Action, Voice to Text, HTML, Youtube, Quote and
// DocuSign — never Share Request a Moment (owner only) or AI Creator. Its right "+" offers exactly those.
const NOT_FOR_COLLABORATORS: ReadonlyArray<AddWidgetKind> = ['request_moment', 'ai_creator'];

export function collaboratorAddWidgetOptions(options: ReadonlyArray<AddWidgetOption>): AddWidgetOption[] {
  return options.filter((o) => !NOT_FOR_COLLABORATORS.includes(o.kind));
}

// Chris, 12 Nov 2026: a "+" after EVERY timeline item — each moment card and each widget card. The "+" directly under a
// moment (or under the "Timeline" header) puts the new widget first in that moment's slot; the "+" after a widget puts
// it right after that widget (the API's after_widget_id). Widgets inside a slot are drawn in widget_order.

/** A widget as the campaign page holds it (its fetchWidgets states). */
export interface SlotWidget {
  id: string | number;
  type: string;
  afterPostId: string | null;
  widget_order?: number;
}

/** Where a "+" inserts: first in its slot, or right after one widget. `afterPostId` is the slot (null = the top). */
export type InsertPlace =
  | { atStart: true; afterPostId: string | null }
  | { afterWidgetId: string; afterPostId: string | null };

const slotKey = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));

/** Each widget's position inside its own slot (0, 1, 2 …), widget_order first: what CSS `order` draws them by. */
export function slotWidgetRanks(widgets: ReadonlyArray<SlotWidget>): Map<string, number> {
  const bySlot = new Map<string, SlotWidget[]>();
  for (const w of widgets) {
    const k = slotKey(w.afterPostId);
    bySlot.set(k, [...(bySlot.get(k) ?? []), w]);
  }
  const ranks = new Map<string, number>();
  for (const list of bySlot.values()) {
    orderTimelineWidgets(list.map((w) => ({ ...w, order: w.widget_order ?? 0 }))).forEach((w, i) => ranks.set(String(w.id), i));
  }
  return ranks;
}

/** A saved widget's id (a number), or null for an unsaved one. */
const savedId = (id: unknown): number | null => {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * The create body for a widget added from a "+" at `place`. Only when the body is for that same slot: after a saved
 * widget → after_widget_id; first in a slot that has widgets → a widget_order below them all. Otherwise unchanged.
 */
export function applyInsertPlace<B extends { after_post_id?: unknown; widget_order?: number }>(
  body: B,
  place: InsertPlace | null | undefined,
  widgets: ReadonlyArray<SlotWidget>,
): { body: B & { after_widget_id?: number }; placed: boolean } {
  if (!place || slotKey(body.after_post_id) !== slotKey(place.afterPostId)) return { body, placed: false };
  if ('afterWidgetId' in place) {
    const id = savedId(place.afterWidgetId);
    return id === null ? { body, placed: false } : { body: { ...body, after_widget_id: id }, placed: true };
  }
  const inSlot = widgets.filter((w) => slotKey(w.afterPostId) === slotKey(place.afterPostId));
  if (inSlot.length === 0) return { body, placed: false };
  const first = Math.min(...inSlot.map((w) => w.widget_order ?? 0));
  return { body: { ...body, widget_order: first - 1 }, placed: true };
}
