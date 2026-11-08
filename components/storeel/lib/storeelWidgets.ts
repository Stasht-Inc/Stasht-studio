import type { PreviewMoment } from './previewMoments.ts';
import type { AddWidgetKind } from '../../widgets/addWidgetOptions.ts';

// Chris, 8 Nov 2026 (point 1): the Storeel preview's "+" opens the campaign page's Add Widget chooser. Pure, so
// `node --test` loads it.
//
// A widget (Call to Action, HTML, YouTube, Quote, AI Creator, Shopify product …) hangs after a MOMENT on the campaign
// page (memory_widgets.after_post_id; null = the top group, before the first moment), not in the moments / linked
// campaigns order chain. So the "+" it was added from maps to a moment: the "+" under the cover → top; after a moment →
// that moment; after a linked campaign → the nearest moment above it (top when there is none).

/** The top group (after_post_id null) and widgets whose moment isn't shown (a sub-photo, deleted): last. */
export const WIDGET_TOP = '__top__';
export const WIDGET_END = '__end__';

export type PreviewWidgetType = 'html' | 'youtube' | 'quote' | 'cta' | 'ai_creator' | 'product';

/** A saved campaign's widget as the preview draws it (from the campaign page's own widget lists). */
export interface PreviewWidget {
  id: string;
  type: PreviewWidgetType;
  afterPostId: string | null;
  order: number;
  title?: string;
  content?: string;
  videoId?: string;
  text?: string;
  author?: string;
  buttonText?: string;
  buttonColor?: string;
  textColor?: string;
  borderRadius?: number;
  mode?: string;
  background?: string;
  imageUrl?: string | null;
  price?: string;
  image?: string | null;
}

/**
 * The moment a widget added from the "+" after `anchor` hangs after. `anchor` null: the "+" under the cover (top);
 * undefined (the Moments card) or a key no longer shown: after the last moment. `postIdOf` gives a moment's id.
 */
export function widgetAnchorPostId(
  shown: ReadonlyArray<PreviewMoment>,
  anchor: string | null | undefined,
  postIdOf: (m: PreviewMoment) => number | undefined,
): number | null {
  if (anchor === null) return null;
  let i = anchor === undefined ? -1 : shown.findIndex((m) => m.key === anchor);
  if (i < 0) i = shown.length - 1;
  for (; i >= 0; i -= 1) {
    const id = postIdOf(shown[i]);
    if (typeof id === 'number' && Number.isFinite(id)) return id;
  }
  return null;
}

/**
 * Just created: the new id of each moment Save as Draft sent (`sentKeys`, in the order the API made them). The
 * campaign's top-level moments get rising ids in that order, so the n-th smallest id is the n-th sent. Empty when the
 * counts differ (no guessing).
 */
export function postIdsAfterCreate(sentKeys: ReadonlyArray<string>, fresh: ReadonlyArray<PreviewMoment>): Map<string, number> {
  const ids = fresh
    .map((m) => (m.kind === 'photo' && typeof m.postId === 'number' ? m.postId : null))
    .filter((id): id is number => id !== null)
    .sort((a, b) => a - b);
  if (ids.length !== sentKeys.length) return new Map();
  return new Map(sentKeys.map((key, i) => [key, ids[i]]));
}

/** The preview's widgets grouped by where they show: WIDGET_TOP, a moment's key, or WIDGET_END; each group in order. */
export function widgetsByAnchor(moments: ReadonlyArray<PreviewMoment>, widgets: ReadonlyArray<PreviewWidget>): Map<string, PreviewWidget[]> {
  const keyOfPost = new Map<string, string>();
  for (const m of moments) if (m.kind === 'photo' && typeof m.postId === 'number') keyOfPost.set(String(m.postId), m.key);
  const out = new Map<string, PreviewWidget[]>();
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  for (const w of sorted) {
    const key = w.afterPostId === null || w.afterPostId === '' ? WIDGET_TOP : keyOfPost.get(String(w.afterPostId)) ?? WIDGET_END;
    out.set(key, [...(out.get(key) ?? []), w]);
  }
  return out;
}

/** The "View on website" card the web API makes beside each catalogue product (CatalogSnapshotWriter::CTA_BUTTON_TEXT). */
const PRODUCT_CTA_TEXT = 'View on website';

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const num = (v: unknown, d = 0): number => (Number.isFinite(Number(v)) ? Number(v) : d);
const anchorOf = (w: any): string | null => (w?.afterPostId === null || w?.afterPostId === undefined || w?.afterPostId === '' ? null : String(w.afterPostId));

/**
 * The campaign page's widget lists (its fetchWidgets states) as preview widgets. A catalogue product's auto-made
 * "View on website" card is left out: its button belongs in the product's own card (Chris, 8 Nov 2026, point 3).
 */
export function previewWidgetsFrom(lists: {
  html?: ReadonlyArray<any>; youtube?: ReadonlyArray<any>; quote?: ReadonlyArray<any>; cta?: ReadonlyArray<any>;
  aiCreator?: ReadonlyArray<any>; product?: ReadonlyArray<any>;
}): PreviewWidget[] {
  const base = (w: any, type: PreviewWidgetType): PreviewWidget => ({ id: str(w.id), type, afterPostId: anchorOf(w), order: num(w.widget_order) });
  return [
    ...(lists.html ?? []).map((w) => ({ ...base(w, 'html'), title: str(w.title), content: str(w.content) })),
    ...(lists.youtube ?? []).map((w) => ({ ...base(w, 'youtube'), title: str(w.title), videoId: str(w.videoId) })),
    ...(lists.quote ?? []).map((w) => ({ ...base(w, 'quote'), text: str(w.text), author: str(w.author) })),
    ...(lists.cta ?? []).filter((w) => str(w.buttonText).trim() !== PRODUCT_CTA_TEXT).map((w) => ({
      ...base(w, 'cta'), title: str(w.title), buttonText: str(w.buttonText), buttonColor: str(w.buttonColor), textColor: str(w.textColor),
      borderRadius: num(w.borderRadius, 12), mode: str(w.mode) || 'link',
    })),
    ...(lists.aiCreator ?? []).map((w) => ({ ...base(w, 'ai_creator'), text: str(w.text), background: str(w.background), imageUrl: w.imageUrl ? str(w.imageUrl) : null })),
    ...(lists.product ?? []).map((w) => ({
      ...base(w, 'product'), title: str(w.title), image: w.image ? str(w.image) : null,
      price: w.price ? (w.currency ? `${str(w.currency)} ${str(w.price)}` : str(w.price)) : '',
    })),
  ];
}

// ── Create: a widget picked before the Storeel exists ────────────────────────────────────────────────────────────
// Its editor needs a saved campaign and lives on the campaign page, so Save as Draft runs first and then the campaign
// page opens Edit Storeel with that editor at the same place. The hand-off is one sessionStorage entry, taken once.

export interface WidgetIntent { memoryId: number; kind: AddWidgetKind; afterPostId: number | null }
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const INTENT_KEY = 'stasht_storeel_widget_intent';
const INTENT_MS = 5 * 60 * 1000;
const sessionOrNull = (): StorageLike | null => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
};

export function saveWidgetIntent(intent: WidgetIntent, storage: StorageLike | null = sessionOrNull(), now = Date.now()): void {
  try { storage?.setItem(INTENT_KEY, JSON.stringify({ ...intent, at: now })); } catch { /* blocked storage: the page just opens */ }
}

/** The widget to open on this campaign's page (once), else null. */
export function takeWidgetIntent(memoryId: number, storage: StorageLike | null = sessionOrNull(), now = Date.now()): WidgetIntent | null {
  try {
    const raw = storage?.getItem(INTENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (Number(v?.memoryId) !== Number(memoryId)) return null;
    storage?.removeItem(INTENT_KEY);
    if (!(now - Number(v.at) < INTENT_MS)) return null;
    return { memoryId: Number(v.memoryId), kind: v.kind, afterPostId: v.afterPostId === null || v.afterPostId === undefined ? null : Number(v.afterPostId) };
  } catch {
    return null;
  }
}
