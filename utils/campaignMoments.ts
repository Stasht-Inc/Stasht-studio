// Campaign page — Timeline + Media panel helpers (Chris, 19 Nov 2026, points 10, 12, 12b, 13a).

// ---- 12b: file sizes ----------------------------------------------------------------------------------------------
// memory_images.size is stored in MEGABYTES (the API's S3 helper: round(bytes / 1024 / 1024, 2); Add a Moment sends
// upload-image-with-metadata's originalSizeMB; the campaign's total_size sums them as MB). The Media panel formatted
// it as bytes, so a 3.4 MB photo read "3 B". Very large numbers can only be bytes (a 100 000 MB photo doesn't exist),
// so those are read as bytes. Nothing / 0 = unknown: '' (it used to show a made-up "2.4 MB").
const BYTES_FROM = 100_000;

export function formatStoredSize(value: unknown): string {
  if (typeof value === 'string' && /^\s*[\d.]+\s*(B|KB|MB|GB)\s*$/i.test(value)) return value.trim(); // already formatted ("3.4 MB")
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return '';
  const mb = n >= BYTES_FROM ? n / (1024 * 1024) : n;
  const round = (x: number) => String(parseFloat(x.toFixed(1)));
  if (mb >= 1024) return `${round(mb / 1024)} GB`;
  if (mb >= 1) return `${round(mb)} MB`;
  const kb = mb * 1024;
  return kb >= 1 ? `${Math.round(kb)} KB` : `${Math.max(1, Math.round(kb * 1024))} B`;
}

// ---- 10: where Add a Moment puts the new moment ---------------------------------------------------------------------
// The "+" under a moment sends after_post_id (that moment). The "+" at the very top of the timeline has no moment
// above it: it sends insert_at_start=1 so the moment goes first. The header's "Add a Moment" button sends neither and
// the moment goes at the end, as before.
export type PlusPlace = { atStart: true } | { afterWidgetId: string } | null | undefined;

export function momentInsertAtStart(afterPostId: string | null | undefined, place: PlusPlace): boolean {
  return (afterPostId === null || afterPostId === undefined || afterPostId === '') && !!place && 'atStart' in place;
}

// ---- 13a: the photo edit panel's "Choose a Moment" list -------------------------------------------------------------
// Never the photo's own moment (a moment can't go inside itself).
export function chooseMomentTargets<T extends { id: string | number }>(moments: readonly T[], photoId: string | number): T[] {
  return moments.filter((m) => String(m.id) !== String(photoId));
}

// ---- 12: Media panel 2 / 3 columns, remembered per viewer -------------------------------------------------------------
export type MediaColumns = 2 | 3;
export const MEDIA_COLUMNS_KEY = 'stasht_media_panel_columns';

export function readMediaColumns(storage?: Pick<Storage, 'getItem'> | null): MediaColumns {
  try {
    const s = storage === undefined ? globalThis.localStorage : storage;
    return s?.getItem(MEDIA_COLUMNS_KEY) === '3' ? 3 : 2;
  } catch {
    return 2;
  }
}

export function saveMediaColumns(columns: MediaColumns, storage?: Pick<Storage, 'setItem'> | null): void {
  try {
    const s = storage === undefined ? globalThis.localStorage : storage;
    s?.setItem(MEDIA_COLUMNS_KEY, String(columns));
  } catch {
    /* private window / blocked storage: the choice lasts this visit only */
  }
}

// ---- Media panel drag = the campaign's order (Chris, 19 Nov 2026: "properly organize by dragging images up and down") --
// The panel lists every photo of the campaign: each moment (top-level photo) and the photos inside it. Its default
// order is the campaign's own (the timeline), each moment followed by its sub-photos, so what he drags is what the
// timeline shows. Dropping a moment's photo on another photo puts that MOMENT right before it (dragged up) or right
// after it (dragged down) in the timeline and saves it (PUT /memories/{id}/moment-order { item, before | after }).
// A photo inside a moment can only be shuffled within its moment, on screen (sub-photos have no stored order).
export type TimelineRef = { type: 'post' | 'linked'; id: string };
export type MediaSortBy = 'order' | 'date' | 'name' | 'size';
export type MediaSortDir = 'asc' | 'desc';

type PanelPhoto = { id: string | number; parent_id?: string | number | null };
const sid = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));

/** The panel in campaign order: each timeline moment, then its sub-photos (in the given order); anything else last. */
export function mediaInTimelineOrder<T extends PanelPhoto>(items: readonly T[], timeline: readonly TimelineRef[] | null | undefined): T[] {
  const byParent = new Map<string, T[]>();
  const tops = new Map<string, T>();
  for (const it of items) {
    const p = sid(it.parent_id);
    if (p) byParent.set(p, [...(byParent.get(p) || []), it]);
    else tops.set(sid(it.id), it);
  }
  const out: T[] = [];
  const seen = new Set<T>();
  const push = (it: T | undefined) => { if (it && !seen.has(it)) { seen.add(it); out.push(it); } };
  for (const ref of timeline || []) {
    if (ref.type !== 'post') continue;
    push(tops.get(ref.id));
    (byParent.get(ref.id) || []).forEach(push);
  }
  for (const it of items) {
    if (sid(it.parent_id)) continue;
    push(it);
    (byParent.get(sid(it.id)) || []).forEach(push);
  }
  items.forEach(push); // sub-photos whose moment isn't listed
  return out;
}

/** The desktop panel's sort button: campaign order → newest first → oldest first → campaign order. */
export function nextMediaSort(by: MediaSortBy | string, dir: MediaSortDir): { by: MediaSortBy; dir: MediaSortDir } {
  if (by === 'order') return { by: 'date', dir: 'desc' };
  if (by === 'date' && dir === 'desc') return { by: 'date', dir: 'asc' };
  return { by: 'order', dir: 'asc' };
}

/** Put `item` right before / after `anchor` (both in the timeline); the timeline unchanged when either is missing. */
export function moveInTimeline(timeline: readonly TimelineRef[], item: TimelineRef, where: 'before' | 'after', anchor: TimelineRef): TimelineRef[] {
  const same = (a: TimelineRef, b: TimelineRef) => a.type === b.type && a.id === b.id;
  if (same(item, anchor) || !timeline.some((t) => same(t, item)) || !timeline.some((t) => same(t, anchor))) return [...timeline];
  const rest = timeline.filter((t) => !same(t, item));
  const at = rest.findIndex((t) => same(t, anchor)) + (where === 'after' ? 1 : 0);
  return [...rest.slice(0, at), { ...item }, ...rest.slice(at)];
}

export type MediaDrop =
  /** Save: the dragged moment goes right before / after the anchor moment; `order` = the new timeline. */
  | { kind: 'moment'; item: TimelineRef; where: 'before' | 'after'; anchor: TimelineRef; order: TimelineRef[] }
  /** On screen only: a photo inside a moment shuffled among its moment's photos. */
  | { kind: 'local' }
  /** Nothing to do: dropped on itself / its own moment, or a sub-photo dropped on another moment. */
  | { kind: 'none'; reason: 'same' | 'other-moment' | 'unknown' };

/**
 * What dropping `draggedId` on `targetId` means. `shown` = the panel as drawn (its order decides up / down);
 * `reversed` = the panel shows the campaign order bottom first.
 */
export function planMediaDrop<T extends PanelPhoto>(
  shown: readonly T[], timeline: readonly TimelineRef[] | null | undefined, draggedId: string | number, targetId: string | number, reversed = false,
): MediaDrop {
  const from = shown.findIndex((i) => sid(i.id) === sid(draggedId));
  const to = shown.findIndex((i) => sid(i.id) === sid(targetId));
  if (from === -1 || to === -1) return { kind: 'none', reason: 'unknown' };
  if (from === to) return { kind: 'none', reason: 'same' };
  const dragged = shown[from];
  const target = shown[to];
  const draggedParent = sid(dragged.parent_id);
  if (draggedParent) {
    return draggedParent === sid(target.parent_id) || draggedParent === sid(target.id)
      ? { kind: 'local' }
      : { kind: 'none', reason: 'other-moment' };
  }
  const item: TimelineRef = { type: 'post', id: sid(dragged.id) };
  const anchor: TimelineRef = { type: 'post', id: sid(target.parent_id) || sid(target.id) };
  if (anchor.id === item.id) return { kind: 'none', reason: 'same' };
  const list = timeline || [];
  if (!list.some((t) => t.type === 'post' && t.id === item.id) || !list.some((t) => t.type === 'post' && t.id === anchor.id)) {
    return { kind: 'local' }; // not in the campaign's saved order (nothing to save it to)
  }
  const up = from > to;
  const where: 'before' | 'after' = up !== reversed ? 'before' : 'after';
  return { kind: 'moment', item, where, anchor, order: moveInTimeline(list, item, where, anchor) };
}
