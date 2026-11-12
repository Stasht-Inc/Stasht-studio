// The campaign page's timeline (Chris, 8 Nov 2026, review I1): under each moment its widgets were drawn grouped by type
// — HTML, YouTube, Quote, Shopify product, AI Creator, then Calls to Action. Since 12 Nov 2026 they follow their saved
// widget_order (that type order only breaks ties), and pinned
// "Share Request a Moment" buttons (pinToBottom) are kept out of the timeline and shown after the last item. The
// campaign page and the Storeel preview both follow this. Pure, so `node --test` loads it.

export const TIMELINE_WIDGET_ORDER = ['html', 'youtube', 'quote', 'product', 'ai_creator', 'cta'] as const;
export type TimelineWidgetType = typeof TIMELINE_WIDGET_ORDER[number];

/** A pinned Call to Action: shown after the timeline's last item, not under its moment. */
export const isPinnedCta = (w: { pinToBottom?: unknown } | null | undefined): boolean => Boolean(w && w.pinToBottom);
/** A Call to Action drawn under its moment (not pinned). */
export const isTimelineCta = (w: { pinToBottom?: unknown } | null | undefined): boolean => !isPinnedCta(w);

/**
 * Widgets in the campaign page's order (Chris, 12 Nov 2026: a "+" after every widget inserts right after it, so the
 * order within a slot is the saved widget_order, as on the published page): widget_order, then the older widget (the
 * lower numeric id, as the API breaks ties), then the old type order (TIMELINE_WIDGET_ORDER), then the given order.
 */
export function orderTimelineWidgets<T extends { type: string; order?: number; id?: unknown }>(widgets: ReadonlyArray<T>): T[] {
  const rank = (t: string) => {
    const i = (TIMELINE_WIDGET_ORDER as ReadonlyArray<string>).indexOf(t);
    return i < 0 ? TIMELINE_WIDGET_ORDER.length : i;
  };
  const idNum = (id: unknown) => {
    const n = Number(id);
    return Number.isFinite(n) && String(id ?? '').trim() !== '' ? n : Number.MAX_SAFE_INTEGER; // unsaved (temp ids): last
  };
  return widgets.map((w, i) => ({ w, i }))
    .sort((a, b) => ((a.w.order ?? 0) - (b.w.order ?? 0)) || (idNum(a.w.id) - idNum(b.w.id)) || (rank(a.w.type) - rank(b.w.type)) || (a.i - b.i))
    .map(({ w }) => w);
}
