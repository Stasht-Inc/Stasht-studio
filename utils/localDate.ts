// "Today" as the person's own calendar day (4 Nov 2026 review). new Date().toISOString() is the UTC day: in Toronto
// after 19:00 it is already tomorrow, so new campaigns and moments got tomorrow's date. Pure, so `node --test` loads it.

const pad = (n: number) => String(n).padStart(2, '0');

/** The browser's local date as YYYY-MM-DD. */
export function localDateISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The calendar day a date value names, as YYYY-MM-DD ('' when it names none). A value written as YYYY-MM-DD or
 * YYYY:MM:DD (EXIF) keeps the day it says, whatever follows it: new Date('2026-11-04 22:30:00').toISOString() reads it as
 * local time then converts to UTC, which is 5 Nov in Toronto. Anything else is parsed and read as the LOCAL day.
 * Never toISOString.
 */
export function dayOf(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const m = /^(\d{4})[-:](\d{2})[-:](\d{2})/.exec(text);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : localDateISO(parsed);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A YYYY-MM-DD day as the create API reads it ("Nov 04, 2026", MemoriesController::store's 'M d, Y'), from its parts.
 * new Date('2026-11-04') is midnight UTC, which toLocaleDateString showed as Nov 3 west of Greenwich. '' when not a day.
 */
export function isoToApiDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? '').trim());
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1]} ${m[3]}, ${m[1]}`;
}
