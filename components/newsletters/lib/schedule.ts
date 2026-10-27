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

/** [wdy2xh2p3f] Texts go out only between these hours, in the API's default timezone (users have no timezone yet). */
export const TEXT_HOURS = { start: 8, end: 21, timeZone: 'America/Toronto' } as const;

const hourWord = (h: number): string => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const easternSuffix = (browserTz: string): string => (browserTz === TEXT_HOURS.timeZone ? '' : ' Eastern time');

/** The line under Schedule when texts are on. */
export function textHoursNote(browserTz: string = timeZoneName()): string {
  return `Texts go out only between ${hourWord(TEXT_HOURS.start)} and ${hourWord(TEXT_HOURS.end)}${easternSuffix(browserTz)}.`;
}

/** NewsletterSendController::schedule refuses a newsletter with texts at a time outside 8:00 to 21:00 (422 scheduled_at). */
export function textQuietHoursProblem(choice: ScheduleChoice, channels: readonly string[], browserTz: string = timeZoneName()): string | null {
  if (choice.mode !== 'later' || !channels.includes('sms')) return null;
  const iso = localDateTimeToIso(choice.date, choice.time);
  if (!iso) return null;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: TEXT_HOURS.timeZone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso)));
  if (hour >= TEXT_HOURS.start && hour < TEXT_HOURS.end) return null;
  return `Texts can only go out between ${hourWord(TEXT_HOURS.start)} and ${hourWord(TEXT_HOURS.end)}${easternSuffix(browserTz)}. Pick a time in that window.`;
}

/** [wdy2xh2p3m] Schedule for later with a whole date and time is kept on the draft as planned_send_at. */
export function plannedFromSchedule(choice: ScheduleChoice): string | null {
  return choice.mode === 'later' ? localDateTimeToIso(choice.date, choice.time) : null;
}

/** A draft's planned_send_at back as the Schedule step's choice, in the person's time zone. */
export function scheduleFromPlanned(iso: string | null | undefined): ScheduleChoice {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { mode: 'now' };
  return { mode: 'later', date: dateInputValue(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

/** Two ISO times (or nulls) for the same moment: the API answers "…Z" for the "….000Z" Studio sends. */
export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  return Number.isNaN(ta) && Number.isNaN(tb) ? true : ta === tb;
}
