// Chris, 8 Nov 2026 (point 3): "we don't need to create a separate card for this button. Let's just add the View on
// website, right inside the card under product details. It's redundant to put the title twice."
//
// A Website Catalogue product moment's "View on website" button is still its own CTA widget row (the web API's
// CatalogSnapshotWriter makes it; it holds the link, and the app still draws it). The widget lists mark it
// `in_card: true` (CatalogProductButtons); new rows also carry widget_data.placement "in_card". Such a button is drawn
// inside the moment card it follows instead of as a card of its own. Every other widget — a Call to Action the owner
// made (even one that says "View on website"), Share Request a Moment, HTML, quote… — renders exactly as before.
// Pure, so `node --test` loads it.

/** A raw API widget ({ widget_type, after_post_id, widget_data, in_card }) or the campaign page's mapped CTA ({ afterPostId, inCard, mode }). */
type AnyWidget = Record<string, any> | null | undefined;

const hasPost = (v: unknown) => v !== null && v !== undefined && v !== '' && v !== 0 && v !== '0';

/** The moment this widget follows (its post id as a string), or null at the top of the timeline. */
function afterPost(w: Record<string, any>): string | null {
  const v = w.afterPostId !== undefined ? w.afterPostId : w.after_post_id;
  return hasPost(v) ? String(v) : null;
}

/** True when this widget is a product's "View on website" button that belongs inside the moment card it follows. */
export function isInCardProductButton(w: AnyWidget): boolean {
  if (!w || typeof w !== 'object') return false;
  if (w.is_visible === false || w.is_visible === 0 || w.is_visible === '0') return false;
  if (afterPost(w) === null) return false; // at the very top there is no card to put it in
  // The campaign page's mapped CTA (already only CTAs).
  if (w.inCard !== undefined) return w.inCard === true && w.mode !== 'request_moment';
  if (w.widget_type !== 'cta') return false;
  const data = w.widget_data || {};
  if (data.mode === 'request_moment') return false;
  return w.in_card === true || data.placement === 'in_card';
}

/**
 * Splits widgets into each moment's in-card button (first one per moment, keyed by its post id) and the rest, which
 * render where they always did. A second marked button on the same moment (not expected) stays a card: never dropped.
 */
export function productButtonsByPost<T extends Record<string, any>>(widgets: ReadonlyArray<T>): { byPost: Map<string, T>; rest: T[] } {
  const byPost = new Map<string, T>();
  const rest: T[] = [];
  for (const w of widgets) {
    const post = isInCardProductButton(w) ? afterPost(w) : null;
    if (post !== null && !byPost.has(post)) byPost.set(post, w);
    else rest.push(w);
  }
  return { byPost, rest };
}
