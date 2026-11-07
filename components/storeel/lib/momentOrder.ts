import type { PreviewMoment } from './previewMoments.ts';

// Chris, 7 Nov 2026 (point 6): the Storeel preview's "+" puts a moment at a place, and its ⋮ moves it. Pure, so
// `node --test` loads it.
//
// A campaign's order is the web API's chain of moments and linked campaigns (PUT /memories/{id}/moment-order). Vehicles
// and Shopify collections have no place in it — the campaign page shows them after everything else — so here too they
// always come last and don't move.
//
// Create: Studio keeps an order of moment keys until Save as Draft (`order`; empty = the API's own order: picked
// products, then photos, then linked items). A moment not in it yet (just picked in step 1) goes after the ordered ones.

export type OrderRef = { type: 'post' | 'linked_memory'; id: number };
export type SavedRef = OrderRef | { type: 'car'; id: number };

/** A photo / video, a product or a linked campaign has a place in the order; a vehicle or Shopify collection doesn't. */
export function isOrderable(m: PreviewMoment): boolean {
  if (m.kind === 'vehicle') return false;
  if (m.kind === 'campaign') return !m.key.startsWith('shopify-');
  return true;
}

/** The moments as shown: those in `order` first (in it), then the other placed ones, then vehicles / collections. */
export function orderMoments(moments: ReadonlyArray<PreviewMoment>, order: ReadonlyArray<string>): PreviewMoment[] {
  const placed = moments.filter(isOrderable);
  const fixed = moments.filter((m) => !isOrderable(m));
  const rank = new Map(order.map((key, i) => [key, i]));
  const listed = placed.filter((m) => rank.has(m.key)).sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
  const rest = placed.filter((m) => !rank.has(m.key));
  return [...listed, ...rest, ...fixed];
}

/**
 * `shown` (the placed keys as shown) with `added` right after `after`; `after` null = first (the + under the cover). An
 * `after` that isn't one of them (a vehicle card's +) means last. Keys already there aren't doubled.
 */
export function insertKeysAfter(shown: ReadonlyArray<string>, after: string | null, added: ReadonlyArray<string>): string[] {
  const fresh = added.filter((k, i) => !shown.includes(k) && added.indexOf(k) === i);
  const list = [...shown];
  const at = after === null ? 0 : list.includes(after) ? list.indexOf(after) + 1 : list.length;
  list.splice(at, 0, ...fresh);
  return list;
}

/** Swap `key` with its neighbour above / below; unchanged at the ends. */
export function moveKey(shown: ReadonlyArray<string>, key: string, direction: 'up' | 'down'): string[] {
  const list = [...shown];
  const i = list.indexOf(key);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return list;
  [list[i], list[j]] = [list[j], list[i]];
  return list;
}

/** Whether the shown order differs from the order the API makes on its own (so it must be sent after create). */
export function needsServerOrder(shown: ReadonlyArray<PreviewMoment>, byDefault: ReadonlyArray<PreviewMoment>): boolean {
  const a = shown.filter(isOrderable).map((m) => m.key);
  const b = orderMoments(byDefault, []).filter(isOrderable).map((m) => m.key);
  return a.length !== b.length || a.some((k, i) => k !== b[i]);
}

/**
 * Just created: the order to send for the new campaign. Its moments come back in the API's own order — products first,
 * then the photos, as sent (`sentPostKeys`) — so the n-th of them is the n-th sent; linked campaigns match by id.
 * Null when the counts differ (e.g. the API skipped a product with no usable photo): no guessing.
 */
export function serverOrderAfterCreate(shown: ReadonlyArray<PreviewMoment>, sentPostKeys: ReadonlyArray<string>, fresh: ReadonlyArray<PreviewMoment>): OrderRef[] | null {
  const posts = fresh.filter((m) => m.kind === 'photo' && typeof (m as { postId?: number }).postId === 'number');
  if (posts.length !== sentPostKeys.length) return null;
  const postIdOf = new Map(sentPostKeys.map((key, i) => [key, (posts[i] as { postId: number }).postId]));
  const linkedIds = new Set(fresh.filter((m) => m.kind === 'campaign').map((m) => (m as { sourceId: string }).sourceId));
  const out: OrderRef[] = [];
  for (const m of shown) {
    if (!isOrderable(m)) continue;
    if (m.kind === 'campaign') {
      if (!linkedIds.has(m.sourceId)) return null;
      out.push({ type: 'linked_memory', id: Number(m.sourceId) });
      continue;
    }
    const id = postIdOf.get(m.key);
    if (id === undefined) return null;
    out.push({ type: 'post', id });
  }
  return out;
}

/** A saved campaign's moment as the API names it: a moment (post), a linked campaign, or a linked vehicle. */
export function savedRef(m: PreviewMoment): SavedRef | null {
  if (m.kind === 'photo') return typeof m.postId === 'number' ? { type: 'post', id: m.postId } : null;
  if (m.kind === 'vehicle') return { type: 'car', id: Number(m.sourceId) };
  if (m.kind === 'campaign' && isOrderable(m)) return { type: 'linked_memory', id: Number(m.sourceId) };
  return null;
}

/** PUT /memories/{id}/moment-order's body for a saved campaign's moments as shown. */
export function savedOrderPayload(shown: ReadonlyArray<PreviewMoment>): OrderRef[] {
  return shown.filter(isOrderable).map(savedRef).filter((r): r is OrderRef => r !== null && r.type !== 'car');
}

/**
 * A moment's ⋮ menu. Edit Moment: a photo / video (create: the original moment editor; saved: its caption) — a picked
 * product's or vehicle's text comes from the website. Move up / down: between placed moments only. Delete: always
 * when it can be taken off (saved: a moment, a linked campaign or a vehicle).
 */
export function momentMenu(shown: ReadonlyArray<PreviewMoment>, index: number, { saved }: { saved: boolean }) {
  const m = shown[index];
  if (!m) return { edit: false, up: false, down: false, remove: false };
  const placed = isOrderable(m);
  const prev = shown[index - 1];
  const next = shown[index + 1];
  const edit = m.kind === 'photo' && (saved ? typeof m.postId === 'number' : m.index !== undefined);
  return {
    edit,
    up: placed && Boolean(prev && isOrderable(prev)),
    down: placed && Boolean(next && isOrderable(next)),
    remove: saved ? savedRef(m) !== null : true,
  };
}

const API_RANK: Record<string, number> = { product: 0, photo: 1, campaign: 2 };

/**
 * A new campaign's moments in the order the API makes them without being told (MemoriesController::store, then
 * buildUnifiedList): products (as sent), then photos (as sent), then linked campaigns; vehicles / collections last.
 */
export function apiDefaultOrder(moments: ReadonlyArray<PreviewMoment>): PreviewMoment[] {
  const placed = moments.filter(isOrderable).map((m, i) => ({ m, i }))
    .sort((a, b) => (API_RANK[a.m.kind] - API_RANK[b.m.kind]) || (a.i - b.i)).map(({ m }) => m);
  return [...placed, ...moments.filter((m) => !isOrderable(m))];
}

/** The keys of the moments Save as Draft makes as rows (products, then photos), in the order they are made. */
export function sentPostKeys(moments: ReadonlyArray<PreviewMoment>): string[] {
  return apiDefaultOrder(moments).filter((m) => m.kind === 'product' || m.kind === 'photo').map((m) => m.key);
}

/**
 * Whether the preview shows a "+" after the moment at `index` (review minor 5): only after a moment with a place —
 * vehicles / collections always show last, so a "+" between or below them would put the new moment somewhere else.
 */
export function plusAfter(shown: ReadonlyArray<PreviewMoment>, index: number): boolean {
  const m = shown[index];
  return Boolean(m && isOrderable(m));
}

/** Where focus goes once the moment `removed` is taken off (review minor 8): the next one, else the one before, else null. */
export function focusAfterRemove(keys: ReadonlyArray<string>, removed: string): string | null {
  const i = keys.indexOf(removed);
  if (i < 0) return null;
  return keys[i + 1] ?? keys[i - 1] ?? null;
}
