// Chris 21 Nov 2026 (R2-2): "we need ability to color button … so it matches their brand. By default maybe it can use
// the color it chooses from the default background. It doesn't look nice when you open up the Royal Woodshop Storeels
// and the visit buttons are purple." A product's buttons (its buy button, a website product's "View on website", the
// outlined Enquire) use a colour the web API works out (ProductButtonColor): the product's own, else the account's
// "Button colour", else the brand colour — sent as button_style / button_color / button_text_color. These helpers only
// read those answers and keep the words readable. Pure, so `node --test` loads it.

/** Studio purple: what a button showed before, and still shows when the web API sends no colour (an older API). */
export const DEFAULT_BUTTON_COLOR = '#6C60FF';

/** "#RRGGBB" in capitals, also from "rrggbb" / "#rgb"; null for anything else. */
export function hexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let v = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(v)) v = v.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(v) ? `#${v.toUpperCase()}` : null;
}

/** White or near-black words, whichever reads on `bg` (the web API's ProductButtonColor::textOn). */
export function buttonTextOn(bg: string): string {
  const hex = hexColor(bg);
  if (!hex) return '#FFFFFF';
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * (((n >> 16) & 255) / 255) + 0.7152 * (((n >> 8) & 255) / 255) + 0.0722 * ((n & 255) / 255);
  return lum > 0.6 ? '#1F2937' : '#FFFFFF';
}

/** A button's colours: `color` (else `fallback`, else purple) and its words (`text` when given, else readable on it). */
export function buttonColors(color: unknown, text?: unknown, fallback?: unknown): { background: string; text: string } {
  const background = hexColor(color) ?? hexColor(fallback) ?? DEFAULT_BUTTON_COLOR;
  return { background, text: hexColor(text) ?? buttonTextOn(background) };
}

/** The outlined Enquire button: its border in the colour, its words too unless the colour is too light to read. */
export function outlineColors(color: unknown): { border: string; text: string } {
  const border = hexColor(color) ?? DEFAULT_BUTTON_COLOR;
  return { border, text: buttonTextOn(border) === '#FFFFFF' ? border : '#1F2937' };
}
