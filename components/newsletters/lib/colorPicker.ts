// Chris (6 Nov, point 4): Studio's own colour picker behind "Custom" (HEX first, which the browser's picker can't be
// told to do) and the account's recent colours (newest first, no repeats, at most 8: the API's NewsletterRecentColors).
// Pure.

export const MAX_RECENT_COLORS = 8;

/**
 * Chris (7 Nov, point 1): the colour to keep as a recent one when the picker is unmounted while open (a click outside or
 * Done closes its panel with it): only a colour already applied and different from where it started; nothing typed but
 * not yet applied is applied then (review M2: the composer may be going away).
 */
export function unmountRecent(s: { open: boolean; changed: boolean; end: string; atOpen: string }): string | null {
  return s.open && s.changed && s.end !== s.atOpen ? s.end : null;
}

/** What was typed in the HEX field as #RRGGBB (uppercase), with or without the #; #RGB shorthand is expanded (review,
 *  6 Nov). Else null. */
export function parseHexInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${hex.toUpperCase()}`;
}

/** The HEX field's text with every space dropped (a pasted " #1F6F8B " stays whole). */
export function hexFieldText(text: string): string {
  return text.replace(/\s+/g, '');
}

/** color first, then the others without it (any case), at most MAX_RECENT_COLORS. A bad colour changes nothing. */
export function addRecentColor(list: readonly string[], color: string): string[] {
  const hex = parseHexInput(color);
  if (!hex) return [...list];
  return [hex, ...list.filter((c) => c.toUpperCase() !== hex)].slice(0, MAX_RECENT_COLORS);
}

/** The API's list, checked again. */
export function recentColorsFrom(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const c of raw) {
    const hex = typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : null;
    if (hex && !out.includes(hex)) out.push(hex);
  }
  return out.slice(0, MAX_RECENT_COLORS);
}

export interface Hsv { h: number; s: number; v: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));

/** #RRGGBB → hue 0–360, saturation and value 0–1 (rounded to 4 places). */
export function hexToHsv(hex: string): Hsv {
  const n = parseInt((parseHexInput(hex) ?? '#000000').slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const round = (x: number) => Math.round(x * 10000) / 10000;
  return { h: round(h), s: round(max ? d / max : 0), v: round(max) };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hh = ((clamp(h, 0, 360) % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const vv = clamp(v, 0, 1);
  const f = (k: number) => {
    const p = (k + hh / 60) % 6;
    return vv - vv * ss * Math.max(0, Math.min(p, 4 - p, 1));
  };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * The recent colours as the editor keeps them (review, 6 Nov): the list shown, the colours picked in this session, and
 * the number of the last save. A save's answer only counts when it is the latest one, so a late answer never drops a
 * newer pick; the account's list loading late keeps the picks made meanwhile first.
 */
export interface RecentState { colors: string[]; picked: string[]; seq: number }

export function recentStart(raw: unknown): RecentState {
  return { colors: recentColorsFrom(raw), picked: [], seq: 0 };
}

/** A colour picked with Custom: first now; `seq` numbers its save. */
export function recentPick(s: RecentState, color: string): { state: RecentState; seq: number } {
  const seq = s.seq + 1;
  return { state: { colors: addRecentColor(s.colors, color), picked: addRecentColor(s.picked, color), seq }, seq };
}

/** A save's answer (null: failed or an API without recent colours): taken only when it answers the latest save, with
 *  this session's picks kept first (the server may have handled the saves in another order; re-review, 6 Nov). */
export function recentFromServer(s: RecentState, raw: unknown, seq: number): RecentState {
  if (seq !== s.seq || !Array.isArray(raw)) return s;
  return recentFromBrand(s, raw);
}

/** The account's list (the brand GET): with this session's picks first. */
export function recentFromBrand(s: RecentState, raw: unknown): RecentState {
  return { ...s, colors: s.picked.reduceRight((list, c) => addRecentColor(list, c), recentColorsFrom(raw)) };
}
