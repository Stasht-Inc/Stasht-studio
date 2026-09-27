// Small pure helpers for the Contact Us widget manager/preview.
// contrastInk/safeColor/safeHttpsUrl are duplicated from public/widget-core.js on purpose:
// the embed page ships as plain static JS and is not importable from the app bundle. Keep in sync.

import type { FormFieldKey, FormFieldSetting, FormFieldSettings } from '../../services/widgetsAPI';

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

/** "https://www.Example.com/contact" -> "example.com" (matches the server's WidgetHostMatcher). Returns '' if nothing usable. */
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

/** Days without a page load after which an install is shown as possibly removed. */
export const STALE_INSTALL_DAYS = 7;

/** "just now", "5 minutes ago", "3 hours ago", "12 days ago". */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return 'a while ago';
  const minutes = Math.max(0, Math.floor((now - t) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** True when the most recent sighting is older than STALE_INSTALL_DAYS. */
export function isStaleInstall(lastSeenIso: string | null | undefined, now: number = Date.now()): boolean {
  const t = lastSeenIso ? Date.parse(lastSeenIso) : NaN;
  return Number.isNaN(t) || now - t > STALE_INSTALL_DAYS * 24 * 60 * 60 * 1000;
}

// --- Form fields (mirrors WidgetFormFields.php and public/widget-core.js) --------------------

export const FORM_FIELD_KEYS: FormFieldKey[] = ['name', 'mobile', 'email', 'company', 'message'];
export const FORM_FIELD_LABEL_MAX = 40;

/** What each field is, for the builder's rows (the visitor-facing label is editable). */
export const FORM_FIELD_NAMES: Record<FormFieldKey, string> = {
  name: 'Name', mobile: 'Mobile number', email: 'Email', company: 'Company', message: 'Message',
};

export const DEFAULT_FORM_FIELD_SETTINGS: FormFieldSettings = {
  name: { show: true, required: true, label: 'Name' },
  mobile: { show: true, required: true, label: 'Mobile Number' },
  email: { show: false, required: false, label: 'Email' },
  company: { show: true, required: false, label: 'Company Name' },
  message: { show: true, required: true, label: 'Message' },
};

export function resolveFormFields(stored: Partial<FormFieldSettings> | null | undefined): FormFieldSettings {
  const out = {} as FormFieldSettings;
  for (const key of FORM_FIELD_KEYS) {
    const f = { ...DEFAULT_FORM_FIELD_SETTINGS[key], ...(stored?.[key] || {}) };
    out[key] = { show: !!f.show, required: !!f.show && !!f.required, label: f.label ?? '' };
  }
  return out;
}

/** A visitor must always leave a mobile number or an email, or nobody can reply. */
export function formCanReply(fields: FormFieldSettings): boolean {
  return (fields.mobile.show && fields.mobile.required) || (fields.email.show && fields.email.required);
}

export function fieldDisplayLabel(key: FormFieldKey, f: FormFieldSetting): string {
  const label = f.label.trim() || DEFAULT_FORM_FIELD_SETTINGS[key].label;
  return f.required ? label : `${label} (optional)`;
}

export function consentLine(fields: FormFieldSettings): string {
  if (fields.mobile.show && fields.email.show) {
    return 'By submitting, you authorize this business to contact you by text or email using the details you provided. Message and data rates may apply.';
  }
  if (fields.email.show) return 'By submitting, you authorize this business to contact you at the email you provided.';
  return 'By submitting, you authorize this business to send messages to the number you provided. Message and data rates may apply.';
}

/** Crops an image to a centred square and shrinks it (default 256px) before upload. */
export async function squareAvatarDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  // PNG keeps transparency; everything else becomes a small JPEG.
  return file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
}
