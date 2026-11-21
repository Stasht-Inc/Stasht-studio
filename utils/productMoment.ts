// Chris 21 Nov 2026 (P3): a product moment's card — in the Storeel preview and on the published campaign page the
// recipient opens — shows the product's price as a BADGE (the product page's yellow pill, e.g. "$65 CAD"), its
// description in the card's caption slot, and its buy button. Never a "Price: $65 CAD" text line.
//
// A product moment is made by the web API's CatalogSnapshotWriter: its memory_images.type_id starts with "catalog_",
// and its description is the product's description (its title when it has none), then "Price: …" (or "Price on
// request"), then up to four "Label: value" lines. Pure, so `node --test` loads it.

export const PRICE_ON_REQUEST = 'Price on request';

/** True for a moment the web API made from a product (Website Catalogue / Products item). */
export function isProductPost(post: { type_id?: unknown } | null | undefined): boolean {
  return typeof post?.type_id === 'string' && /^catalog_\d+_/.test(post.type_id);
}

/**
 * A product moment's description split for its card: the price (for the badge; '' when none) and the caption without
 * the price line — and without a first line that only repeats the title (the API writes the title when the product
 * has no description). The caption keeps everything else (the description, the "Label: value" details), line breaks
 * included. The LAST "Price: …" line is the API's (it comes after the description, which could itself mention one).
 */
export function splitProductCaption(description: unknown, title?: unknown): { price: string; caption: string } {
  const lines = (typeof description === 'string' ? description : '').replace(/\r\n?/g, '\n').split('\n');
  let priceAt = -1;
  let price = '';
  lines.forEach((line, i) => {
    const t = line.trim();
    const m = /^Price:\s*(.+)$/i.exec(t);
    if (m) { priceAt = i; price = m[1].trim(); }
    else if (t.toLowerCase() === PRICE_ON_REQUEST.toLowerCase()) { priceAt = i; price = PRICE_ON_REQUEST; }
  });
  const rest = lines.filter((_, i) => i !== priceAt);
  const name = typeof title === 'string' ? title.trim() : '';
  const firstText = rest.findIndex((l) => l.trim() !== '');
  if (name && firstText >= 0 && rest[firstText].trim() === name) rest.splice(firstText, 1);
  return { price, caption: rest.join('\n').replace(/^\s*\n+|\n+\s*$/g, '').trim() };
}

/** Plain text of a product description that may hold HTML (as the API's CatalogText::plain keeps line breaks). */
export function plainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The price a viewer may see, as the API's CatalogMomentText::shownPrice: hidden → '', on request → "Price on request". */
export function shownPrice(p: { price_label?: string | null; show_price?: boolean | null; price_on_request?: boolean | null }): string {
  if (p.show_price === false) return '';
  if (p.price_on_request) return PRICE_ON_REQUEST;
  return (p.price_label || '').trim();
}
