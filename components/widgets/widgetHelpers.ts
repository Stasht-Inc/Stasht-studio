// Small pure helpers for the Contact Us widget manager/preview.
// contrastInk/safeColor/safeHttpsUrl are duplicated from public/widget-core.js on purpose:
// the embed page ships as plain static JS and is not importable from the app bundle. Keep in sync.

export const DEFAULT_BRAND = '#2f5fac';
export const DEFAULT_CALLOUT = 'Chat with us';
export const MESSAGE_MAX = 320;
export const WELCOME_MAX = 500;
export const PRODUCTION_ORIGIN = 'https://studio.stasht.com';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value.trim());
}

export function safeColor(value: string | null | undefined, fallback = DEFAULT_BRAND): string {
  return typeof value === 'string' && isHexColor(value) ? value.trim() : fallback;
}

export function safeHttpsUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Black or white text, whichever reads better on the given hex background. */
export function contrastInk(hex: string | null | undefined): string {
  const h = safeColor(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

/**
 * Origin the loader script is served from. widget-loader.js derives its iframe base from the
 * script's own src, so the snippet must point at a real public Studio origin: never localhost.
 */
export function installOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  const { origin, hostname } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
  return local ? PRODUCTION_ORIGIN : origin;
}

export function installSnippet(widgetId: string): string {
  return `<script src="${installOrigin()}/widget-loader.js" data-widget-id="${widgetId}" async></script>`;
}

/** Best-effort clipboard write with a textarea fallback (non-secure contexts, older browsers). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** "https://www.RoyalWoodShop.com/contact" -> "royalwoodshop.com" (matches the server's WidgetHostMatcher). Returns '' if nothing usable. */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
}

export function isPlausibleDomain(domain: string): boolean {
  return /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}
