// Helpers for rendering Shopify product data (descriptions, variants, price) in the UI.

// Shopify product descriptions arrive as HTML (e.g. "<b>PREMIUM</b> <i>snowboard</i>").
// Sanitize to a safe allowlist of inline/list tags so we can render real bold/italic
// via dangerouslySetInnerHTML without exposing an XSS surface from the store content.
const RICH_TEXT_ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'ul', 'ol', 'li', 'span']);

export function sanitizeRichText(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
    const name = String(tag).toLowerCase();
    if (!RICH_TEXT_ALLOWED_TAGS.has(name)) return '';
    return match.startsWith('</') ? `</${name}>` : `<${name}>`;
  });
}

// Plain-text version of a description (all tags stripped) — for titles, alt text, previews.
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// A selectable variant option: the label shown on the chip + the id used for deep-linking.
export interface VariantOption {
  id: string | number | null;
  label: string;
}

// Extract renderable variants, skipping Shopify's "Default Title" single-variant placeholder.
export function getVariantOptions(variants?: any[]): VariantOption[] {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((v) => {
      const label = typeof v === 'string' ? v : (v?.title || v?.option1 || '');
      const id = typeof v === 'string' ? null : (v?.id ?? null);
      return { id, label: String(label).trim() };
    })
    .filter((o) => o.label !== '' && o.label.toLowerCase() !== 'default title');
}

// Minimal currency-symbol map; falls back to the currency code prefix.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', CAD: '$', AUD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥',
};

export function formatShopifyPrice(price?: string | number | null, currency?: string | null): string {
  if (price === null || price === undefined || price === '') return '';
  const num = typeof price === 'number' ? price : parseFloat(price);
  const amount = Number.isFinite(num) ? num.toFixed(2) : String(price);
  const code = (currency || '').toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount}` : (code ? `${code} ${amount}` : amount);
}
