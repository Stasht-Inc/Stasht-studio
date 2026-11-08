// The campaign page's timeline (Chris, 8 Nov 2026, review I1): under each moment its widgets are drawn grouped by type
// — HTML, YouTube, Quote, Shopify product, AI Creator, then Calls to Action — each type in its own order, and pinned
// "Share Request a Moment" buttons (pinToBottom) are kept out of the timeline and shown after the last item. The
// campaign page and the Storeel preview both follow this. Pure, so `node --test` loads it.

export const TIMELINE_WIDGET_ORDER = ['html', 'youtube', 'quote', 'product', 'ai_creator', 'cta'] as const;
export type TimelineWidgetType = typeof TIMELINE_WIDGET_ORDER[number];

/** A pinned Call to Action: shown after the timeline's last item, not under its moment. */
export const isPinnedCta = (w: { pinToBottom?: unknown } | null | undefined): boolean => Boolean(w && w.pinToBottom);
/** A Call to Action drawn under its moment (not pinned). */
export const isTimelineCta = (w: { pinToBottom?: unknown } | null | undefined): boolean => !isPinnedCta(w);

/** Widgets in the campaign page's order: by type (TIMELINE_WIDGET_ORDER), then each type's own order. */
export function orderTimelineWidgets<T extends { type: string; order?: number }>(widgets: ReadonlyArray<T>): T[] {
  const rank = (t: string) => {
    const i = (TIMELINE_WIDGET_ORDER as ReadonlyArray<string>).indexOf(t);
    return i < 0 ? TIMELINE_WIDGET_ORDER.length : i;
  };
  return widgets.map((w, i) => ({ w, i }))
    .sort((a, b) => (rank(a.w.type) - rank(b.w.type)) || ((a.w.order ?? 0) - (b.w.order ?? 0)) || (a.i - b.i))
    .map(({ w }) => w);
}
