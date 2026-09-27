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

/** Config URL for the embed page. `host` (the customer page origin) lets the server show owners where the widget is installed. */
export function configUrl(api, widgetId, host) {
  const base = `${api}/widget-embed/${encodeURIComponent(widgetId)}/config`;
  return host ? `${base}?host=${encodeURIComponent(host)}` : base;
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

/**
 * Transparent space around the launcher/panel inside the iframe, so their shadows fade out before
 * the iframe edge instead of being cut into a hard grey box. Bottom is largest: shadows fall down.
 */
export const ROOT_PAD = { top: 12, x: 16, bottom: 24 };

/** Panel width that fits the host page's viewport (passed in by the loader as ?vw=). */
export function panelWidth(viewportWidth) {
  const vw = Number(viewportWidth);
  if (!Number.isFinite(vw) || vw <= 0) return 360;
  // The loader caps the iframe at vw - 32; the panel plus its side padding has to fit in that.
  return Math.max(240, Math.min(360, Math.floor(vw) - 32 - ROOT_PAD.x * 2));
}

/** Max panel height so the panel scrolls inside the iframe instead of being clipped on short host viewports. */
export function panelMaxHeight(viewportHeight) {
  const vh = Number(viewportHeight);
  const cap = !Number.isFinite(vh) || vh <= 0 ? 720 : Math.min(720, Math.floor(vh) - 32);
  // The loader caps the iframe at min(720, vh - 32); #root adds the top and bottom padding.
  return Math.max(200, cap - ROOT_PAD.top - ROOT_PAD.bottom);
}

// --- Form fields -----------------------------------------------------------------------------
// The server sends the shown fields (in order) as config.form_fields; see WidgetFormFields.php.

const FIELD_KEYS = ['name', 'mobile', 'email', 'company', 'message'];
const DEFAULT_LABELS = { name: 'Name', mobile: 'Mobile Number', email: 'Email', company: 'Company Name', message: 'Message' };

/** The original form, used when the API predates configurable fields. */
export const DEFAULT_FORM_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'mobile', label: 'Mobile Number', required: true },
  { key: 'company', label: 'Company Name', required: false },
  { key: 'message', label: 'Message', required: true },
];

export function formFieldsFrom(config) {
  const list = Array.isArray(config?.form_fields)
    ? config.form_fields.filter((f) => f && FIELD_KEYS.includes(f.key))
    : [];
  if (!list.length) return DEFAULT_FORM_FIELDS;
  return list.map((f) => ({ key: f.key, label: String(f.label || DEFAULT_LABELS[f.key]), required: Boolean(f.required) }));
}

export function fieldLabel(field) {
  return field.required ? field.label : `${field.label} (optional)`;
}

/** Early feedback only; the server's `email` rule decides. */
export function isPlausibleEmail(raw) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw || '').trim());
}

const REQUIRED_MESSAGES = {
  name: 'Enter your name.',
  mobile: 'Enter a valid phone number, including the area code.',
  email: 'Enter your email address.',
  company: 'Enter your company name.',
  message: 'Enter a message.',
};

/** Errors keyed by field for the shown fields only. */
export function validateValues(fields, values) {
  const errors = {};
  for (const field of fields) {
    const value = String(values[field.key] || '').trim();
    if (!value) {
      if (field.required) errors[field.key] = REQUIRED_MESSAGES[field.key];
    } else if (field.key === 'mobile' && !isPlausiblePhone(value)) {
      errors.mobile = 'Enter a valid phone number, including the area code.';
    } else if (field.key === 'email' && !isPlausibleEmail(value)) {
      errors.email = 'Enter a valid email address.';
    }
  }
  return errors;
}

export function consentText(fields) {
  const phone = fields.some((f) => f.key === 'mobile');
  const email = fields.some((f) => f.key === 'email');
  if (phone && email) {
    return 'By submitting, you authorize this business to contact you by text or email using the details you provided. Message and data rates may apply.';
  }
  if (email) return 'By submitting, you authorize this business to contact you at the email you provided.';
  return 'By submitting, you authorize this business to send messages to the number you provided. Message and data rates may apply.';
}

export function thanksText(values) {
  if (String(values.mobile || '').trim()) return "Your message was sent. We'll text you shortly.";
  if (String(values.email || '').trim()) return "Your message was sent. We'll email you shortly.";
  return "Your message was sent. We'll be in touch shortly.";
}
