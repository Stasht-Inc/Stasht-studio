// Small pure helpers for the Contact Us widget manager/preview.
// contrastInk/safeColor/safeHttpsUrl are duplicated from public/widget-core.js on purpose:
// the embed page ships as plain static JS and is not importable from the app bundle. Keep in sync.

import type { BusinessHours, FormFieldKey, FormFieldSetting, FormFieldSettings, WeekdayKey } from '../../services/widgetsAPI';

// Mirrors public/widget-core.js (Chris's ContactWidget design).
export const DEFAULT_BRAND = '#6C60FF';
export const DEFAULT_CALLOUT = 'Hi there! Have a question?';
export const CALLOUT_SUBTEXT = 'Chat with us here.';
export const DEFAULT_WELCOME = 'Enter your question below and a representative will get right back to you.';
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

/** The input placeholder the widget shows ("Name *", "Business (optional)") — same as widget-core placeholderFor(). */
export function fieldPlaceholder(key: FormFieldKey, f: FormFieldSetting): string {
  const label = f.label.trim() || DEFAULT_FORM_FIELD_SETTINGS[key].label;
  if (key === 'message' && label === DEFAULT_FORM_FIELD_SETTINGS.message.label) return 'I want to know more...';
  return f.required ? `${label} *` : `${label} (optional)`;
}

export const CONSENT_LINE = 'By submitting you agree to receive messages for the provided channel. Rates may be applied.';

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

// --- After hours (mirrors WidgetBusinessHours.php; spec 2026-09-29 part 2 §2) -----------------

export const DAY_KEYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_NAMES: Record<WeekdayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
export const AI_NOTES_MAX = 2000;

export interface DayHours {
  open: boolean;
  from: string; // "HH:MM"
  to: string;
}
export type WeekHours = Record<WeekdayKey, DayHours>;

const WEEKDAY: DayHours = { open: true, from: '09:00', to: '17:00' };
const WEEKEND: DayHours = { open: false, from: '09:00', to: '17:00' };
export const DEFAULT_WEEK_HOURS: WeekHours = {
  mon: WEEKDAY, tue: WEEKDAY, wed: WEEKDAY, thu: WEEKDAY, fri: WEEKDAY, sat: WEEKEND, sun: WEEKEND,
};

/** 00:00, 00:15 … 23:45: the server accepts 15-minute steps only. */
export const TIME_OPTIONS: string[] = Array.from({ length: 96 }, (_, i) =>
  `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

/** "13:30" -> "1:30 PM". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Stored hours -> the builder's rows; null when the widget has no hours set. */
export function weekFromApi(stored: BusinessHours | null | undefined): WeekHours | null {
  if (!stored || typeof stored !== 'object') return null;
  const week = {} as WeekHours;
  for (const day of DAY_KEYS) {
    const range = stored[day];
    week[day] = Array.isArray(range) && range.length === 2
      ? { open: true, from: range[0], to: range[1] }
      : { ...DEFAULT_WEEK_HOURS[day], open: false };
  }
  return week;
}

export function weekToApi(week: WeekHours): BusinessHours {
  const out = {} as BusinessHours;
  for (const day of DAY_KEYS) out[day] = week[day].open ? [week[day].from, week[day].to] : null;
  return out;
}

/** The first open day whose closing time isn't after its opening time, as a message; else null. */
export function weekProblem(week: WeekHours): string | null {
  for (const day of DAY_KEYS) {
    const d = week[day];
    if (d.open && d.to <= d.from) return `Closing time must be after opening time on ${DAY_NAMES[day]}.`;
  }
  return null;
}

/** The owner's own timezone (IANA), used when business hours are first set. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
  } catch {
    return 'America/Toronto';
  }
}

const FALLBACK_ZONES = [
  'America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/New_York', 'America/Winnipeg', 'America/Chicago',
  'America/Regina', 'America/Edmonton', 'America/Denver', 'America/Phoenix', 'America/Vancouver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Asia/Kolkata', 'UTC',
];

/** Every IANA timezone the browser knows (the current one kept), A–Z. */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  const list = new Set(zones.length ? zones : FALLBACK_ZONES);
  if (current) list.add(current);
  return [...list].sort();
}
