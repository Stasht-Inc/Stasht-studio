import type { AudienceCount, NewsletterAllowance, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import type { NewsletterDraft } from './draft.ts';
import type { ScheduleChoice } from './schedule.ts';
import { fieldProblems } from './draft.ts';
import { blocksProblems } from './blocks.ts';
import { formatCount, reachable } from './audience.ts';
import { scheduleProblem } from './schedule.ts';

export type StepKey = 'name' | 'recipients' | 'from' | 'subject' | 'content' | 'schedule';
export type StepProblems = Partial<Record<StepKey, string>>;

export const STEP_ORDER: StepKey[] = ['name', 'recipients', 'from', 'subject', 'content', 'schedule'];
export const stepDomId = (key: StepKey): string => `nl-step-${key}`;

/** Spec §8 send/schedule 422 keys (and the editable fields) → the step that fixes them. */
const STEP_FOR_FIELD: Record<string, StepKey> = {
  name: 'name',
  audience: 'recipients', channels: 'recipients', sms_text: 'recipients', allowance: 'recipients',
  from_name: 'from', reply_to_email: 'from',
  subject: 'subject', preview_text: 'subject',
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

/** Everything Studio can check before asking the API to send (the API checks again). */
export function preSendProblems(d: NewsletterDraft, counts: AudienceCount | null, schedule: ScheduleChoice, now: Date = new Date()): StepProblems {
  const out: StepProblems = {};
  const live = fieldProblems(d);
  const email = d.channels.includes('email');

  if (!d.name.trim()) out.name = 'Give your newsletter a name.';
  else if (live.name) out.name = live.name;

  if (!d.audience.length) out.recipients = 'Choose who gets this newsletter.';
  else if (!d.channels.length) out.recipients = 'Choose email, text or both.';
  else if (d.channels.includes('sms') && !d.sms_text.trim()) out.recipients = 'Write the text message.';
  else if (live.sms_text) out.recipients = live.sms_text;
  else if (counts && reachable(counts, d.channels) === 0) out.recipients = 'Nobody on these lists can get this newsletter yet.';

  // Alignment decision 5: an empty from name or reply-to never blocks (pre-filled, and the API fills them in on
  // send). Only what can't be sent is flagged; the API's 422 reply_to_email (account with no email) maps here too.
  if (email && (live.from_name || live.reply_to_email)) out.from = live.from_name ?? live.reply_to_email;

  if (!d.subject.trim()) out.subject = 'Add a subject line.';
  else if (live.subject || live.preview_text) out.subject = live.subject ?? live.preview_text;

  if (!d.blocks.length) out.content = 'Add at least one section to the email.';
  else if (Object.keys(blocksProblems(d.blocks)).length) out.content = 'Finish or remove the sections marked in red.';

  const when = scheduleProblem(schedule, now);
  if (when) out.schedule = when;
  return out;
}

export function firstProblemStep(problems: StepProblems): StepKey | null {
  return STEP_ORDER.find((key) => problems[key]) ?? null;
}

export function allowanceLeft(a: NewsletterAllowance): { email: number; sms: number } {
  return { email: Math.max(0, a.email_limit - a.email_used), sms: Math.max(0, a.sms_limit - a.sms_used) };
}

export function allowanceProblem(a: NewsletterAllowance | null, counts: AudienceCount | null, channels: NewsletterChannel[]): string | null {
  if (!a || !counts) return null;
  const left = allowanceLeft(a);
  if (channels.includes('email') && counts.email > left.email) {
    return `This needs ${formatCount(counts.email)} emails, but your plan has ${formatCount(left.email)} left this month.`;
  }
  if (channels.includes('sms') && counts.sms > left.sms) {
    return `This needs ${formatCount(counts.sms)} texts, but your plan has ${formatCount(left.sms)} left this month.`;
  }
  return null;
}

/** The monthly reset is a calendar date: read it in UTC so it doesn't slip to the day before in the Americas. */
export function formatResetDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
}

export function allowanceLine(a: NewsletterAllowance, channels: NewsletterChannel[]): string {
  const left = allowanceLeft(a);
  const parts: string[] = [];
  if (channels.includes('email')) parts.push(`${formatCount(left.email)} emails`);
  if (channels.includes('sms')) parts.push(`${formatCount(left.sms)} texts`);
  const reset = formatResetDate(a.resets_at);
  return `Your plan has ${parts.join(' and ')} left this month.${reset ? ` It resets on ${reset}.` : ''}`;
}
