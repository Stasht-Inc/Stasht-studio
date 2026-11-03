// "Single person" typed in (Chris, 3 Nov 2026): "If this is for a single person, then we need the email address here,
// or phone number if chosen. It has to be simple. We aren't going to send them to the leads page to add 1 email address
// or phone number. Make sure Phone number has Country Code and Phone number like we have on all other views."
//
// The audience is [{type: 'person', email?, phone?}] made from the boxes that follow Send by: Email address when Email
// is ticked, Phone number (the Studio country-code picker + number, saved E.164: memberPhone.ts / utils/phoneUtils) when
// Text message is ticked. The API finds the account's lead with that email or phone when it is sent, or creates one
// (NewsletterPerson). A box that is half typed stays in the draft but is held back from autosave (draft.fieldProblems)
// and not counted. Drafts that saved a lead ({type: 'lead', id}) keep it until a box is changed. Pure: `node --test`.
import type { AudienceCount, AudienceItem, LeadOption, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import { MEMBER_DIAL_CODE, memberPhoneParts, memberPhoneProblem, memberPhoneValue } from '../../leads/lists/memberPhone.ts';
import { isPlausibleEmail } from './rules.ts';
import { formatCount } from './audience.ts';
import { formatSentTo } from './phoneDisplay.ts';

/** What the two boxes hold: the email as typed, and the phone's country code and number as typed. */
export interface PersonFields { email: string; phoneCode: string; phone: string }

export type PersonEntry = Extract<AudienceItem, { type: 'person' }>;

// The same words as the Lists person form (lists.ts BAD_EMAIL) and the API (NewsletterAudience::BAD_EMAIL).
export const PERSON_BAD_EMAIL = 'Enter an email address like name@example.com.';
// The API's send / schedule refusals (NewsletterPerson), shown under the box before Send too.
export const EMAIL_UNSUBSCRIBED = "This email address has unsubscribed, so it can't get your newsletters.";
export const PHONE_UNSUBSCRIBED = "This phone number has unsubscribed, so it can't get your texts.";

export const EMPTY_PERSON: PersonFields = { email: '', phoneCode: MEMBER_DIAL_CODE, phone: '' };

export function personEntry(audience: readonly AudienceItem[]): PersonEntry | null {
  const item = audience.find((a) => a.type === 'person');
  return item && item.type === 'person' ? item : null;
}

/** The boxes for a saved audience: its person, else empty on +1 (a saved lead is filled in once read back). */
export function fieldsFromAudience(audience: readonly AudienceItem[]): PersonFields {
  const p = personEntry(audience);
  if (!p) return { ...EMPTY_PERSON };
  const parts = memberPhoneParts(p.phone);
  return { email: p.email ?? '', phoneCode: parts.countryCode, phone: parts.number };
}

/** A suggestion picked (or a saved lead read back): both boxes take that lead's email and mobile number. */
export function fieldsFromLead(lead: Pick<LeadOption, 'email' | 'phone'>): PersonFields {
  const parts = memberPhoneParts(lead.phone);
  return { email: lead.email ?? '', phoneCode: parts.countryCode, phone: parts.number };
}

/** The audience the boxes showing make ([] while both are empty): email trimmed, phone in E.164 with its code. */
export function audienceFromFields(fields: PersonFields, channels: readonly NewsletterChannel[]): AudienceItem[] {
  const email = channels.includes('email') ? fields.email.trim() : '';
  const phone = channels.includes('sms') ? memberPhoneValue(fields.phoneCode, fields.phone) : '';
  if (!email && !phone) return [];
  return [{ type: 'person', ...(email ? { email } : {}), ...(phone ? { phone } : {}) }];
}

/** What is wrong with the boxes showing (nothing for an empty or hidden one). */
export function personBoxProblems(fields: PersonFields, channels: readonly NewsletterChannel[]): { email?: string; phone?: string } {
  const out: { email?: string; phone?: string } = {};
  const email = fields.email.trim();
  if (channels.includes('email') && email && !isPlausibleEmail(email)) out.email = PERSON_BAD_EMAIL;
  const phone = channels.includes('sms') ? memberPhoneProblem(fields.phoneCode, fields.phone) : null;
  if (phone) out.phone = phone;
  return out;
}

/** A saved person that would not pass (half typed), else null: autosave holds the audience back meanwhile. */
export function personEntryProblem(audience: readonly AudienceItem[]): string | null {
  const p = personEntry(audience);
  if (!p) return null;
  if (p.email && !isPlausibleEmail(p.email.trim())) return PERSON_BAD_EMAIL;
  if (p.phone) {
    const parts = memberPhoneParts(p.phone);
    const problem = memberPhoneProblem(parts.countryCode, parts.number);
    if (problem) return problem;
  }
  return null;
}

/** What Estimated recipients counts: a half-typed person counts as nobody yet (the API would refuse it). */
export function countableAudience(audience: AudienceItem[]): AudienceItem[] {
  return personEntryProblem(audience) ? audience.filter((a) => a.type !== 'person') : audience;
}

/** "1 email", "1 text", "1 email · 1 text" (and "0 emails" while nobody is typed yet). */
export function personCountSummary(counts: AudienceCount | null, channels: readonly NewsletterChannel[]): string {
  if (!counts) return '—';
  const emails = `${formatCount(counts.email)} ${counts.email === 1 ? 'email' : 'emails'}`;
  const texts = `${formatCount(counts.sms)} ${counts.sms === 1 ? 'text' : 'texts'}`;
  if (channels.includes('email') && channels.includes('sms')) return `${emails} · ${texts}`;
  return channels.includes('sms') ? texts : emails;
}

/** The API's word on the typed addresses (audience-count `person`): an unsubscribed one, per box. */
export function personStatusProblems(counts: AudienceCount | null, channels: readonly NewsletterChannel[]): { email?: string; phone?: string } {
  const status = counts?.person;
  const out: { email?: string; phone?: string } = {};
  if (!status) return out;
  if (channels.includes('email') && status.email === 'unsubscribed') out.email = EMAIL_UNSUBSCRIBED;
  if (channels.includes('sms') && status.sms === 'unsubscribed') out.phone = PHONE_UNSUBSCRIBED;
  return out;
}

/** Before Send: what stops a typed person (half typed, or unsubscribed), else null. */
export function personSendProblem(audience: readonly AudienceItem[], channels: readonly NewsletterChannel[], counts: AudienceCount | null): string | null {
  if (!personEntry(audience)) return null;
  const typed = personEntryProblem(audience);
  if (typed) return typed;
  const status = personStatusProblems(counts, channels);
  return status.email ?? status.phone ?? null;
}

/** How the person reads in the step's summary: the email, else the number (null while a box is half typed). */
export function personSummary(audience: readonly AudienceItem[]): string | null {
  const p = personEntry(audience);
  if (!p || personEntryProblem(audience)) return null;
  return p.email?.trim() || (p.phone ? formatSentTo(p.phone) : '') || null;
}
