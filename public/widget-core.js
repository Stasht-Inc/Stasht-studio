// public/widget-core.js
// Pure helpers for the embed page. No DOM, no network — unit-tested with `npm run test:widget`.

export const MESSAGE_MAX = 320;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function safeColor(value, fallback = '#2f5fac') {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

export function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Black or white text, whichever reads better on the given hex background. */
export function contrastInk(hex) {
  const h = safeColor(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

/** Best guess at the customer's page origin, sent to the API as host_origin. */
export function hostOrigin({ hostParam, referrer }) {
  for (const candidate of [hostParam, referrer]) {
    try {
      if (candidate) return new URL(candidate).origin;
    } catch {
      // try the next candidate
    }
  }
  return '';
}

/** Same rule as the server's PhoneCanonicalizer::toE164 — early feedback only, the server is authoritative. */
export function isPlausiblePhone(raw) {
  const value = String(raw || '').trim();
  const digits = value.replace(/\D+/g, '');
  if (value.startsWith('+')) return digits.length >= 8 && digits.length <= 15;
  if (digits.length === 10) return true;
  return digits.length === 11 && digits[0] === '1';
}

export function clampPosition(value) {
  return value === 'bottom-left' ? 'bottom-left' : 'bottom-right';
}

/** Panel width that fits the host page's viewport (passed in by the loader as ?vw=). */
export function panelWidth(viewportWidth) {
  const vw = Number(viewportWidth);
  if (!Number.isFinite(vw) || vw <= 0) return 360;
  return Math.max(280, Math.min(360, Math.floor(vw) - 32));
}

/** Max panel height so the panel scrolls inside the iframe instead of being clipped on short host viewports. */
export function panelMaxHeight(viewportHeight) {
  const vh = Number(viewportHeight);
  if (!Number.isFinite(vh) || vh <= 0) return 696;
  // The loader caps the iframe at min(720, vh - 32); #root adds 12px padding top and bottom.
  return Math.max(200, Math.min(720, Math.floor(vh) - 32) - 24);
}
