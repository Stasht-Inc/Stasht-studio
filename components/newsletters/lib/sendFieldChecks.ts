// Chris (7 Nov, points 9 and 9b): "Highlight should be on the subject line, not the card." / "Error messages always go at
// bottom not top of card." Studio's checks before Send / Schedule (the same rules as preSendProblems), filed by FIELD:
// the field is marked and its message goes under it. Only a problem that belongs to no single field stays with its step
// card (drawn at the card's bottom). Pure.
import type { AudienceCount } from '../../../services/newslettersAPI.ts';
import type { NewsletterDraft } from './draft.ts';
import type { ScheduleChoice } from './schedule.ts';
import { fieldProblems } from './draft.ts';
import { blocksProblems } from './blocks.ts';
import { reachable } from './audience.ts';
import { personSendProblem } from './person.ts';
import { localDateTimeToIso, scheduleProblem, textQuietHoursProblem } from './schedule.ts';
import { smsPartsInfo } from './smsParts.ts';
import { STEP_ORDER, type StepKey, type StepProblems } from './sendChecks.ts';

export type SendField = 'name' | 'subject' | 'preview_text' | 'audience' | 'channels' | 'sms_text' | 'from_name' | 'reply_to_email' | 'send_date' | 'send_time';
export interface SendProblems { fields: Partial<Record<SendField, string>>; steps: StepProblems }

/** Each step's fields, in the order they show on its card. */
export const STEP_FIELDS: Record<StepKey, SendField[]> = {
  name: ['name', 'subject', 'preview_text'],
  recipients: ['audience', 'channels', 'sms_text'],
  from: ['from_name', 'reply_to_email'],
  content: [],
  schedule: ['send_date', 'send_time'],
};

/** A scheduled time's problem belongs to the date (missing, not a real date, too far ahead) or else to the time. */
export function scheduleField(choice: ScheduleChoice): 'send_date' | 'send_time' {
  if (choice.mode !== 'later') return 'send_time';
  if (!choice.date) return 'send_date';
  if (!choice.time) return 'send_time';
  // A date that doesn't exist (or a whole day lost to a clock change) is the date's problem.
  if (!localDateTimeToIso(choice.date, '12:00')) return 'send_date';
  const at = Date.parse(localDateTimeToIso(choice.date, choice.time) ?? '');
  const yearAhead = new Date();
  yearAhead.setFullYear(yearAhead.getFullYear() + 1);
  return Number.isFinite(at) && at >= yearAhead.getTime() ? 'send_date' : 'send_time';
}

export function sendProblems(d: NewsletterDraft, counts: AudienceCount | null, schedule: ScheduleChoice, now: Date = new Date(), fallbackFromName = 'Stasht'): SendProblems {
  const fields: SendProblems['fields'] = {};
  const steps: StepProblems = {};
  const live = fieldProblems(d);
  const email = d.channels.includes('email');

  // Step 1: each field its own message (one card banner used to say both).
  if (!d.name.trim()) fields.name = 'Give your newsletter a name.';
  else if (live.name) fields.name = live.name;
  if (!d.subject.trim()) fields.subject = 'Add a subject line.';
  else if (live.subject) fields.subject = live.subject;
  if (live.preview_text) fields.preview_text = live.preview_text;

  // Step 2: Send to, Send by, the Message box. A Single person's box problem is under that box (PersonFields), and is
  // filed under Send to so the step is still flagged and focus goes there.
  if (!d.audience.length) fields.audience = 'Choose who gets this newsletter.';
  else if (!d.channels.length) fields.channels = 'Choose email, text or both.';
  else if (personSendProblem(d.audience, d.channels, counts)) fields.audience = personSendProblem(d.audience, d.channels, counts) as string;
  else if (d.channels.includes('sms') && !d.sms_text.trim()) fields.sms_text = 'Write the text message.';
  else if (live.sms_text) fields.sms_text = live.sms_text;
  else if (d.channels.includes('sms') && smsPartsInfo(d.from_name.trim() || fallbackFromName, d.sms_text).problem) {
    fields.sms_text = smsPartsInfo(d.from_name.trim() || fallbackFromName, d.sms_text).problem as string;
  }
  else if (counts && reachable(counts, d.channels) === 0) fields.audience = 'Nobody on these lists can get this newsletter yet.';

  // Step 3 (alignment decision 5: an empty from name or reply-to never blocks).
  if (email && live.from_name) fields.from_name = live.from_name;
  if (email && live.reply_to_email) fields.reply_to_email = live.reply_to_email;

  // Step 4: the sections are marked one by one in the preview; the card says so (at its bottom).
  if (!d.blocks.length) steps.content = 'Add at least one section to the email.';
  else if (Object.keys(blocksProblems(d.blocks)).length) steps.content = 'Finish or remove the sections marked in red.';

  // Step 5: under the date and time.
  const when = scheduleProblem(schedule, now) ?? textQuietHoursProblem(schedule, d.channels);
  if (when) fields[scheduleField(schedule)] = when;
  return { fields, steps };
}

/** Where to take the person first: the first step with a problem, and its first marked field (null: the card itself, or
 *  for Content the first marked section). */
export function firstProblem(p: SendProblems): { step: StepKey; field: SendField | null } | null {
  for (const step of STEP_ORDER) {
    const field = STEP_FIELDS[step].find((f) => p.fields[f]);
    if (field) return { step, field };
    if (p.steps[step]) return { step, field: null };
  }
  return null;
}
