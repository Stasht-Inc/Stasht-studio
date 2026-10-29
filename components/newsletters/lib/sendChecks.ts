import type { AudienceCount, NewsletterAllowance, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import type { NewsletterDraft } from './draft.ts';
import type { ScheduleChoice } from './schedule.ts';
import { fieldProblems } from './draft.ts';
import { blocksProblems } from './blocks.ts';
import { formatCount, reachable } from './audience.ts';
import { scheduleProblem, textQuietHoursProblem } from './schedule.ts';
import { smsPartsInfo } from './smsParts.ts';
import { userLocale } from './locale.ts';

// Step 1 holds the name, subject line and preview text (Chris, 29 Oct), so those all point at 'name'.
export type StepKey = 'name' | 'recipients' | 'from' | 'content' | 'schedule';
export type StepProblems = Partial<Record<StepKey, string>>;

export const STEP_ORDER: StepKey[] = ['name', 'recipients', 'from', 'content', 'schedule'];
export const stepDomId = (key: StepKey): string => `nl-step-${key}`;

/** Spec §8 send/schedule 422 keys (and the editable fields) → the step that fixes them. */
const STEP_FOR_FIELD: Record<string, StepKey> = {
  name: 'name',
  audience: 'recipients', channels: 'recipients', sms_text: 'recipients', allowance: 'recipients',
  from_name: 'from', reply_to_email: 'from',
  subject: 'name', preview_text: 'name',
  blocks: 'content', header: 'content', template: 'content', business_address: 'content',
  scheduled_at: 'schedule',
};

export function stepErrorsFrom(fieldErrors: Record<string, string>): StepProblems {
  const out: StepProblems = {};
  for (const [key, message] of Object.entries(fieldErrors)) {
    const step = STEP_FOR_FIELD[key.split('.')[0]];
    if (step && !out[step]) out[step] = message;
  }
  return out;
}

/** Everything Studio can check before asking the API to send (the API checks again). fallbackFromName: the name the
 *  API puts before the text when the From name is empty (the owner's name). */
export function preSendProblems(d: NewsletterDraft, counts: AudienceCount | null, schedule: ScheduleChoice, now: Date = new Date(), fallbackFromName = 'Stasht'): StepProblems {
  const out: StepProblems = {};
  const live = fieldProblems(d);
  const email = d.channels.includes('email');

  // Step 1: the name's problem first, then the subject's (one message; both missing say so together).
  const noName = !d.name.trim();
  const noSubject = !d.subject.trim();
  if (noName && noSubject) out.name = 'Give your newsletter a name and a subject line.';
  else if (noName) out.name = 'Give your newsletter a name.';
  else if (live.name) out.name = live.name;
  else if (noSubject) out.name = 'Add a subject line.';
  else if (live.subject || live.preview_text) out.name = live.subject ?? live.preview_text;

  if (!d.audience.length) out.recipients = 'Choose who gets this newsletter.';
  else if (!d.channels.length) out.recipients = 'Choose email, text or both.';
  else if (d.channels.includes('sms') && !d.sms_text.trim()) out.recipients = 'Write the text message.';
  else if (live.sms_text) out.recipients = live.sms_text;
  else if (d.channels.includes('sms') && smsPartsInfo(d.from_name.trim() || fallbackFromName, d.sms_text).problem) {
    out.recipients = smsPartsInfo(d.from_name.trim() || fallbackFromName, d.sms_text).problem as string;
  }
  else if (counts && reachable(counts, d.channels) === 0) out.recipients = 'Nobody on these lists can get this newsletter yet.';

  // Alignment decision 5: an empty from name or reply-to never blocks (pre-filled, and the API fills them in on
  // send). Only what can't be sent is flagged; the API's 422 reply_to_email (account with no email) maps here too.
  if (email && (live.from_name || live.reply_to_email)) out.from = live.from_name ?? live.reply_to_email;

  if (!d.blocks.length) out.content = 'Add at least one section to the email.';
  else if (Object.keys(blocksProblems(d.blocks)).length) out.content = 'Finish or remove the sections marked in red.';

  const when = scheduleProblem(schedule, now) ?? textQuietHoursProblem(schedule, d.channels);
  if (when) out.schedule = when;
  return out;
}

export function firstProblemStep(problems: StepProblems): StepKey | null {
  return STEP_ORDER.find((key) => problems[key]) ?? null;
}

/** What is left this month: the limit, less what went out, less what newsletters sending or scheduled will use
 *  (email_pending / sms_pending; an older API without them counts as 0). */
export function allowanceLeft(a: NewsletterAllowance): { email: number; sms: number } {
  const pending = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    email: Math.max(0, a.email_limit - a.email_used - pending(a.email_pending)),
    sms: Math.max(0, a.sms_limit - a.sms_used - pending(a.sms_pending)),
  };
}

/** "1 email" / "2 emails", "1 text message part" / "2 text message parts" (as the API words them). */
export function allowanceUnits(n: number, channel: NewsletterChannel): string {
  const word = channel === 'email' ? 'email' : 'text message part';
  return `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;
}

/** smsParts: the parts one text takes (the text allowance counts parts, wdy2xh2p3f). */
export function allowanceProblem(a: NewsletterAllowance | null, counts: AudienceCount | null, channels: NewsletterChannel[], smsParts = 1): string | null {
  if (!a || !counts) return null;
  const left = allowanceLeft(a);
  if (channels.includes('email') && counts.email > left.email) {
    return `This needs ${allowanceUnits(counts.email, 'email')}, but your plan has ${formatCount(left.email)} left this month.`;
  }
  const sms = counts.sms * Math.max(1, smsParts);
  if (channels.includes('sms') && sms > left.sms) {
    return `This needs ${allowanceUnits(sms, 'sms')}, but your plan has ${formatCount(left.sms)} left this month.`;
  }
  return null;
}

/** The monthly reset is a calendar date: read it in UTC so it doesn't slip to the day before in the Americas. */
export function formatResetDate(iso: string, locale: string = userLocale()): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

/** POST /newsletters/{id}/preview's size_kb: from 80 KB, say Gmail cuts emails over about 100 KB. */
export function previewSizeHint(sizeKb: unknown): string | null {
  if (typeof sizeKb !== 'number' || !Number.isFinite(sizeKb) || sizeKb < 80) return null;
  return `About ${Math.round(sizeKb)} KB — Gmail hides the end of emails over about 100 KB.`;
}

export function allowanceLine(a: NewsletterAllowance, channels: NewsletterChannel[]): string {
  const left = allowanceLeft(a);
  const parts: string[] = [];
  if (channels.includes('email')) parts.push(allowanceUnits(left.email, 'email'));
  if (channels.includes('sms')) parts.push(allowanceUnits(left.sms, 'sms'));
  const reset = formatResetDate(a.resets_at);
  return `Your plan has ${parts.join(' and ')} left this month.${reset ? ` It resets on ${reset}.` : ''}`;
}

/** [wdy2xh2p3m] A newsletter scheduled for the monthly reset or later uses next month's allowance; the API checks that
 *  month, so Studio doesn't judge it against what is left this month. */
export function usesNextMonthAllowance(a: NewsletterAllowance | null, scheduledIso: string | null): boolean {
  if (!a || !scheduledIso) return false;
  const reset = Date.parse(a.resets_at);
  const at = Date.parse(scheduledIso);
  return Number.isFinite(reset) && Number.isFinite(at) && at >= reset;
}

export function nextMonthLine(a: NewsletterAllowance, locale: string = userLocale()): string {
  const reset = formatResetDate(a.resets_at, locale);
  return `It goes out after your plan resets${reset ? ` on ${reset}` : ''}, so it uses next month\u2019s allowance.`;
}

export interface SendAllowance {
  /** Why Send / Schedule can't go ahead (shown at the button), or null. */
  problem: string | null;
  /** Text messages that will be skipped because the plan has no text parts left for them. */
  skippedTexts: number;
  /** The note at the button when texts will be skipped but the emails still go out, or null. */
  note: string | null;
}

/**
 * Chris, 29 Oct (round 2), item 6 (Deepak's decision): when the emails can go (email chosen, at least one person
 * with an email address), Send / Schedule go ahead even with too few text parts; the API skips the texts beyond
 * what is left. When only texts would go out and they don't fit, it is refused as before (allowanceProblem). Too few
 * emails is always refused. A newer API may say how many texts it will skip (audience-count `sms_will_skip`);
 * when it does, that number is used. smsParts: the parts one text takes.
 */
export function sendAllowance(a: NewsletterAllowance | null, counts: AudienceCount | null, channels: NewsletterChannel[], smsParts = 1): SendAllowance {
  const none: SendAllowance = { problem: null, skippedTexts: 0, note: null };
  if (!a || !counts) return none;
  const left = allowanceLeft(a);
  const emailsGo = channels.includes('email') && counts.email > 0;
  if (channels.includes('email') && counts.email > left.email) return { ...none, problem: allowanceProblem(a, counts, channels, smsParts) };
  if (!channels.includes('sms') || counts.sms <= 0) return none;
  const parts = Math.max(1, smsParts);
  const textsThatFit = Math.floor(left.sms / parts);
  const serverSkip = (counts as AudienceCount & { sms_will_skip?: unknown }).sms_will_skip;
  const skipped = typeof serverSkip === 'number' && Number.isFinite(serverSkip) && serverSkip >= 0
    ? Math.min(Math.floor(serverSkip), counts.sms)
    : Math.max(0, counts.sms - textsThatFit);
  if (!skipped) return none;
  const why = textsThatFit === 0 || skipped >= counts.sms ? 'no text parts left this month' : 'not enough text parts left this month';
  const what = skipped === 1 ? '1 text message' : `${formatCount(skipped)} text messages`;
  if (!emailsGo) return { ...none, problem: allowanceProblem(a, counts, ['sms'], parts) ?? `${what} can't be sent: ${why}.` };
  return { problem: null, skippedTexts: skipped, note: `${what} won't be sent: ${why}. Emails will still go out.` };
}

/** Whenever Send / Schedule is off, the reason shown right at the button (busy shows its spinner instead). */
export function sendBlockedReason(s: { busy: boolean; countsLoading: boolean; problem: string | null; saved: boolean }): string | null {
  if (s.busy) return null;
  if (s.countsLoading) return 'Counting who gets it…';
  if (s.problem) return s.problem;
  if (!s.saved) return 'Save the newsletter first, then try again.';
  return null;
}
