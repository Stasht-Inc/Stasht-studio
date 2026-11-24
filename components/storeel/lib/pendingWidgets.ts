import type { PreviewMoment } from './previewMoments.ts';
import { isOrderable } from './momentOrder.ts';
import { widgetAnchorPostId, type PreviewWidget, type PreviewWidgetType } from './storeelWidgets.ts';

// Deepak 24 Nov 2026 (P1): "If it is a given option it needs to work here itself." On Create Storeel every "+" option
// opens its own editor right there; a saved editor puts the widget in the preview at its "+" — kept here, nothing sent
// — and Save as Draft / Save & Send makes the Storeel, then each widget at its place. Pure, so `node --test` loads it.
//
// A pending widget follows a MOMENT (its key in the form, as the "+" it came from; null = under the cover), as the
// campaign page's widgets do (memory_widgets.after_post_id). Its place inside that moment's group is its place in the
// list.

export interface PendingWidget {
  /** Local id ("pw-1"), also its preview id. */
  key: string;
  /** The Add Widget option it came from (e.g. 'request_moment' is a 'cta' widget). */
  kind: string;
  /** Its name in menus and messages ("Call to Action", "Quote", the product's title …). */
  label: string;
  /** The moment it follows (form key); null = the top, under the cover. */
  anchor: string | null;
  widgetType: PreviewWidgetType;
  /** Exactly what the campaign page's editor sends as widget_data. */
  widgetData: Record<string, unknown>;
  /** The editor's fields, to open it again with them (Edit). */
  fields?: unknown;
  /** What the preview draws that isn't in widget_data (e.g. AI Creator's reference image, shown but not uploaded). */
  extra?: Partial<PreviewWidget>;
}

/** The places a widget can hang: under the cover (null), then after each moment that has a "+" (photos, products,
 *  linked campaigns — not vehicles, which always show last). */
export function widgetSlots(moments: ReadonlyArray<PreviewMoment>): Array<string | null> {
  return [null, ...moments.filter(isOrderable).map((m) => m.key)];
}

/** Where a widget picked from a "+" goes: that "+"'s moment; the Moments card (undefined) or a gone moment: the last
 *  place (after the last moment, else the top). */
export function resolveAnchor(moments: ReadonlyArray<PreviewMoment>, anchor: string | null | undefined): string | null {
  const slots = widgetSlots(moments);
  if (anchor === null) return null;
  if (anchor !== undefined && slots.includes(anchor)) return anchor;
  return slots[slots.length - 1];
}

/** A widget whose moment is no longer shown is drawn (and saved) at the end, as the preview does with any such widget. */
function placeOf(slots: ReadonlyArray<string | null>, anchor: string | null): number {
  const i = slots.indexOf(anchor);
  return i < 0 ? slots.length - 1 : i;
}

/** Pinned to the bottom (a "Share Request a Moment" with Pin to bottom): drawn last, so it can't move. */
export function isPinnedPending(w: PendingWidget): boolean {
  return w.widgetType === 'cta' && w.widgetData.mode === 'request_moment' && Boolean(w.widgetData.pinToBottom);
}

/** The list in the order the preview shows it: by place (the top, then each moment), then as listed. */
export function orderedPending(list: ReadonlyArray<PendingWidget>, moments: ReadonlyArray<PreviewMoment>): PendingWidget[] {
  const slots = widgetSlots(moments);
  return list.map((w, i) => ({ w, i, at: placeOf(slots, w.anchor) })).sort((a, b) => a.at - b.at || a.i - b.i).map((x) => x.w);
}

/** What the ⋮ of the widget `key` can do: Move up / Move down (not past the top or the end; never a pinned one). */
export function pendingMoves(list: ReadonlyArray<PendingWidget>, moments: ReadonlyArray<PreviewMoment>, key: string): { up: boolean; down: boolean } {
  const w = list.find((x) => x.key === key);
  if (!w || isPinnedPending(w)) return { up: false, down: false };
  const slots = widgetSlots(moments);
  const at = placeOf(slots, w.anchor);
  const group = orderedPending(list, moments).filter((x) => !isPinnedPending(x) && placeOf(slots, x.anchor) === at);
  const i = group.findIndex((x) => x.key === key);
  return { up: i > 0 || at > 0, down: i < group.length - 1 || at < slots.length - 1 };
}

/**
 * Move a widget one step: past its neighbour in the same group, else past the moment above (to the end of the group
 * before) / below (to the start of the next group) — as moving it on the campaign page's timeline.
 */
export function movePending(list: ReadonlyArray<PendingWidget>, moments: ReadonlyArray<PreviewMoment>, key: string, direction: 'up' | 'down'): PendingWidget[] {
  const can = pendingMoves(list, moments, key);
  if (direction === 'up' ? !can.up : !can.down) return [...list];
  const slots = widgetSlots(moments);
  const ordered = orderedPending(list, moments);
  const w = ordered.find((x) => x.key === key)!;
  const at = placeOf(slots, w.anchor);
  const group = ordered.filter((x) => !isPinnedPending(x) && placeOf(slots, x.anchor) === at);
  const i = group.findIndex((x) => x.key === key);
  const rest = ordered.filter((x) => x.key !== key);
  if (direction === 'up' && i > 0) {
    const before = group[i - 1].key;
    const j = rest.findIndex((x) => x.key === before);
    return [...rest.slice(0, j), w, ...rest.slice(j)];
  }
  if (direction === 'down' && i < group.length - 1) {
    const after = group[i + 1].key;
    const j = rest.findIndex((x) => x.key === after);
    return [...rest.slice(0, j + 1), w, ...rest.slice(j + 1)];
  }
  const moved = { ...w, anchor: slots[direction === 'up' ? at - 1 : at + 1] };
  const target = placeOf(slots, moved.anchor);
  if (direction === 'up') {
    // To the end of the group before: after its last widget (or where that group would start).
    const j = rest.findIndex((x) => placeOf(slots, x.anchor) > target);
    return j < 0 ? [...rest, moved] : [...rest.slice(0, j), moved, ...rest.slice(j)];
  }
  // To the start of the next group.
  const j = rest.findIndex((x) => placeOf(slots, x.anchor) >= target);
  return j < 0 ? [...rest, moved] : [...rest.slice(0, j), moved, ...rest.slice(j)];
}

/** The preview's widget for a pending one: drawn like a saved widget (PreviewWidgetCard), at its moment. */
export function pendingPreviewWidget(w: PendingWidget, order: number): PreviewWidget {
  const d = w.widgetData as Record<string, any>;
  const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
  const base: PreviewWidget = { id: w.key, type: w.widgetType, afterPostId: null, anchorKey: w.anchor, order };
  switch (w.widgetType) {
    case 'html': return { ...base, title: str(d.title), content: str(d.content) };
    case 'youtube': return { ...base, title: str(d.title), videoId: str(d.videoId) };
    case 'quote': return { ...base, text: str(d.text), author: str(d.author) };
    case 'cta': return {
      ...base, title: str(d.title), buttonText: str(d.buttonText), buttonColor: str(d.buttonColor), textColor: str(d.textColor),
      borderRadius: Number.isFinite(Number(d.borderRadius)) ? Number(d.borderRadius) : 12, fontSize: Number(d.fontSize) || 16,
      buttonWidth: Number(d.buttonWidth) || 0, mode: str(d.mode) || 'link', ...(isPinnedPending(w) ? { pinned: true } : {}),
    };
    case 'ai_creator': return { ...base, text: str(d.text), background: str(d.background), imageUrl: null, isDark: typeof d.is_dark === 'boolean' ? d.is_dark : null, ...w.extra };
    case 'product': return { ...base, title: str(d.title), image: d.image ? str(d.image) : null, price: d.price ? (d.currency ? `${str(d.currency)} ${str(d.price)}` : str(d.price)) : '' };
    default: return base;
  }
}

/** Every pending widget as the preview draws it, in order. */
export function pendingPreviewWidgets(list: ReadonlyArray<PendingWidget>, moments: ReadonlyArray<PreviewMoment>): PreviewWidget[] {
  // After any saved widget of the same place (those keep their own widget_order).
  return orderedPending(list, moments).map((w, i) => pendingPreviewWidget(w, 100000 + i));
}

export interface PendingCreate { key: string; label: string; body: { widget_type: string; after_post_id: string | null; widget_order: number; widget_data: Record<string, unknown> } }

/**
 * The POST /memories/{id}/widgets bodies, in order, once the Storeel exists: each widget after the moment its "+"
 * followed (`postIdOf`: a form moment's new id — the same mapping the old hand-off used, widgetAnchorPostId: a linked
 * campaign's widget goes after the moment above it), numbered inside its group after the `orderBase` already there.
 */
export function pendingCreateBodies(
  list: ReadonlyArray<PendingWidget>,
  moments: ReadonlyArray<PreviewMoment>,
  postIdOf: (m: PreviewMoment) => number | undefined,
  orderBase: (afterPostId: string | null) => number = () => 0,
  fallbackAfter: number | null = null,
): PendingCreate[] {
  const next = new Map<string, number>();
  return orderedPending(list, moments).map((w) => {
    let after = w.anchor === null ? null : widgetAnchorPostId(moments, w.anchor, postIdOf);
    // Its moment's id isn't known (the API skipped a product): after the campaign's last moment.
    if (after === null && w.anchor !== null) after = fallbackAfter;
    const afterPostId = after === null ? null : String(after);
    const group = afterPostId ?? '';
    const order = next.has(group) ? next.get(group)! : orderBase(afterPostId);
    next.set(group, order + 1);
    return { key: w.key, label: w.label, body: { widget_type: w.widgetType, after_post_id: afterPostId, widget_order: order, widget_data: w.widgetData } };
  });
}

/** The toast for widgets that couldn't be added (the Storeel itself was made): names each one. */
export function failedWidgetsMessage(labels: ReadonlyArray<string>): string {
  if (!labels.length) return '';
  const names = labels.map((l) => `“${l}”`);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${list} couldn’t be added. Add ${labels.length === 1 ? 'it' : 'them'} again from the Storeel’s page.`;
}
