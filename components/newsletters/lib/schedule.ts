import { userLocale } from './locale.ts';
export type ScheduleChoice = { mode: 'now' } | { mode: 'later'; date: string; time: string };

/** A scheduled send must be at least this far ahead (the API needs a future time; this leaves room to confirm). */
export const MIN_LEAD_MINUTES = 5;

export const DST_GAP_PROBLEM = 'That time is skipped when the clocks change. Pick another time.';

/** 'YYYY-MM-DD' + 'HH:MM' in the browser's time zone → ISO-8601 UTC, or null if that day/time doesn't exist
 *  (including a time the clocks skip, which Date would quietly move an hour). */
export function localDateTimeToIso(date: string, time: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  const tm = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  if (!dm || !tm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const h = Number(tm[1]);
  const mi = Number(tm[2]);
  if (h > 23 || mi > 59) return null;
  const local = new Date(y, mo - 1, d, h, mi, 0, 0);
  if (local.getFullYear() !== y || local.getMonth() !== mo - 1 || local.getDate() !== d) return null;
  if (local.getHours() !== h || local.getMinutes() !== mi) return null;
  return local.toISOString();
}

/** The API refuses a send more than a year ahead (scheduled_at before:+1 year). */
export function maxScheduleDate(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setFullYear(d.getFullYear() + 1);
  return dateInputValue(d);
}

export function scheduleProblem(choice: ScheduleChoice, now: Date = new Date()): string | null {
  if (choice.mode === 'now') return null;
  if (!choice.date || !choice.time) return 'Pick a date and a time.';
  const iso = localDateTimeToIso(choice.date, choice.time);
  if (!iso) return localDateTimeToIso(choice.date, '12:00') ? DST_GAP_PROBLEM : "That date doesn't exist. Pick another.";
  const at = new Date(iso).getTime();
  if (at < now.getTime() + MIN_LEAD_MINUTES * 60000) return `Pick a time at least ${MIN_LEAD_MINUTES} minutes from now.`;
  const yearAhead = new Date(now.getTime());
  yearAhead.setFullYear(yearAhead.getFullYear() + 1);
  if (at >= yearAhead.getTime()) return 'Pick a time within the next year.';
  return null;
}

export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time';
  } catch {
    return 'your local time';
  }
}

/** "Thu, Oct 22, 9:30 AM" in the user's time zone. */
export function formatSendTime(iso: string | null, locale: string = userLocale()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function dateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
