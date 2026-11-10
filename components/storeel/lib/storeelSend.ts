// Step 3 Send of the Storeel flow (Chris, 4 Nov 2026, point 9): reading the web API's answers
// (POST /memories/{id}/storeel-audience-count, POST /memories/{id}/storeel-send) and what Studio checks before Send.
// Pure, so `node --test` loads it.
import type { AudienceCount, AudienceItem, NewsletterAllowance, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import { toResult, type ApiLikeResponse, type NlResult } from '../../newsletters/lib/apiResult.ts';
import { formatCount, reachable } from '../../newsletters/lib/audience.ts';
import { personSendProblem } from '../../newsletters/lib/person.ts';

/** 503 not_available: the tables the send needs aren't there yet (the SQL hasn't run on the server). */
export const NOT_AVAILABLE_ERROR = "Sending Storeels isn't available yet. Your campaign is saved; try again later.";

/** The per-send cap (storeels.broadcast.max_messages) as the count answers it. */
export interface StoreelLimit { max_messages: number; needed: number; over_limit: boolean }

export interface StoreelCount {
  counts: AudienceCount;
  limit: StoreelLimit | null;
  /** The newsletter monthly allowance Storeel sends share, when the API sends it with the count. */
  allowance: NewsletterAllowance | null;
}

export interface StoreelCountResult extends NlResult<StoreelCount> {
  /** 503 not_available (SQL not run). */
  unavailable?: boolean;
  /** 403: this account may not send this campaign (only its owner or the property's owner / admins may). */
  forbidden?: boolean;
}

const isAllowance = (a: unknown): a is NewsletterAllowance => {
  const o = a as Record<string, unknown> | null;
  return Boolean(o && typeof o === 'object' && typeof o.email_limit === 'number' && typeof o.sms_limit === 'number');
};

function limitFrom(v: unknown): StoreelLimit | null {
  const o = v as Record<string, unknown> | null;
  if (!o || typeof o !== 'object' || typeof o.max_messages !== 'number') return null;
  return { max_messages: o.max_messages, needed: Number(o.needed) || 0, over_limit: o.over_limit === true };
}

function failure<T>(res: NlResult<T>): Pick<StoreelCountResult, 'unavailable' | 'forbidden' | 'error'> {
  if (res.status === 503 && res.code === 'not_available') return { unavailable: true, error: NOT_AVAILABLE_ERROR };
  if (res.status === 403 && !res.planRequired) return { forbidden: true };
  return {};
}

/** apiRequest's answer for the count: {success, data: <server body {success, data, storeel, allowance?}>}. */
export function countFromResponse(res: ApiLikeResponse | null | undefined): StoreelCountResult {
  if (!res || !res.success) {
    const r = toResult<StoreelCount>(res);
    return { ...r, ...failure(r) };
  }
  const body = (res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, any>;
  const counts = (body.data && typeof body.data === 'object' ? body.data : body) as AudienceCount;
  const storeel = body.storeel && typeof body.storeel === 'object' ? body.storeel : null;
  const allowance = isAllowance(body.allowance) ? body.allowance : isAllowance(storeel?.allowance) ? storeel.allowance : null;
  return { ok: true, fieldErrors: {}, data: { counts, limit: limitFrom(storeel), allowance } };
}

export interface SendFailure {
  message: string;
  /** 422 field errors (message, audience, audience.N.email / phone, channels), shown under their fields. */
  fieldErrors: Record<string, string>;
  unavailable?: true;
  forbidden?: true;
  /** 422 allowance: over the plan's monthly emails / text parts (shown at the button with See plans). */
  allowance?: string;
}

export function sendFailure(res: NlResult<unknown>): SendFailure {
  const f = failure(res);
  if (f.unavailable) return { message: NOT_AVAILABLE_ERROR, fieldErrors: {}, unavailable: true };
  // The newsletter sending gate holds Storeel sends too (toResult words it for a newsletter draft).
  if (res.paused === 'all' || res.code === 'newsletters_paused') return { message: 'Sending is paused right now. Try again later.', fieldErrors: {} };
  if (res.paused === 'account' || res.code === 'newsletters_account_paused') return { message: 'Sending is paused for your account. Contact Stasht support to turn it back on.', fieldErrors: {} };
  const message = res.error ?? 'Something went wrong. Please try again.';
  if (f.forbidden) return { message, fieldErrors: {}, forbidden: true };
  if (res.fieldErrors?.allowance) return { message: res.fieldErrors.allowance, fieldErrors: {}, allowance: res.fieldErrors.allowance };
  return { message, fieldErrors: { ...(res.fieldErrors ?? {}) } };
}

/** Before Send now (the API checks again). null: nothing Studio can see is wrong. */
export function sendProblem({ audience, channels, message, counts, smsProblem, limit }: {
  audience: AudienceItem[];
  channels: NewsletterChannel[];
  message: string;
  counts: AudienceCount | null;
  smsProblem: string | null;
  limit: StoreelLimit | null;
}): string | null {
  if (!audience.length) return 'Choose who gets this Storeel.';
  if (!channels.length) return 'Choose email, text or both.';
  const person = personSendProblem(audience, channels, counts);
  if (person) return person;
  if (!message.trim()) return 'Write the message people will get with your campaign.';
  if (channels.includes('sms') && smsProblem) return smsProblem;
  if (counts && reachable(counts, channels) === 0) return 'Nobody here can get this Storeel yet.';
  if (limit?.over_limit) {
    return `This Storeel would go out as ${formatCount(limit.needed, 'en-US')} messages, more than the ${formatCount(limit.max_messages, 'en-US')} one send can make. Send it to fewer people at a time.`;
  }
  return null;
}

export interface ChannelCounts { sent: number; queued: number; failed: number }
export interface StoreelSendSummary {
  broadcast_id: string;
  memory_id: number;
  status: 'sending' | 'sent';
  channels: NewsletterChannel[];
  subject?: string;
  replayed: boolean;
  published_now: boolean;
  /** The mode it was sent in (Chris 9 Nov 2026): added by the Send step from the Publishing choice; absent = Public. */
  published_role?: 1 | 2 | 3;
  texts_wait_until: string | null;
  created_at?: string;
  finished_at?: string | null;
  counts: {
    recipients: number; sent: number; queued: number; failed: number;
    email: ChannelCounts; sms: ChannelCounts;
    skipped: Record<string, number>;
  };
}

const emails = (n: number) => `${formatCount(n, 'en-US')} ${n === 1 ? 'email' : 'emails'}`;
const texts = (n: number) => `${formatCount(n, 'en-US')} ${n === 1 ? 'text' : 'texts'}`;
const joinAnd = (parts: string[]) => parts.join(' and ');

/** The toast after Send now: what went, what is still going out, texts held for quiet hours, a campaign just published. */
export function sentMessage(s: StoreelSendSummary, locale = 'en-US', timeZone?: string): string {
  const c = s.counts;
  const email = c.email ?? { sent: 0, queued: 0, failed: 0 };
  const sms = c.sms ?? { sent: 0, queued: 0, failed: 0 };
  const out: string[] = [];
  if (s.texts_wait_until) {
    if (email.queued > 0) out.push(`Sending ${emails(email.sent + email.queued)}.`);
    else if (email.sent > 0) out.push(`Sent: ${emails(email.sent)}.`);
    const at = new Date(s.texts_wait_until);
    const time = Number.isNaN(at.getTime()) ? '' : new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }).format(at);
    out.push(`Texts go out${time ? ` at ${time}` : ' later'} (quiet hours).`);
  } else if (s.status === 'sending') {
    const parts = [email.sent + email.queued > 0 ? emails(email.sent + email.queued) : '', sms.sent + sms.queued > 0 ? texts(sms.sent + sms.queued) : ''].filter(Boolean);
    out.push(`Sending ${joinAnd(parts)}. It can take a few minutes.`);
  } else {
    const parts = [email.sent > 0 ? emails(email.sent) : '', sms.sent > 0 ? texts(sms.sent) : ''].filter(Boolean);
    out.push(parts.length ? `Sent: ${joinAnd(parts)}.` : 'Nothing was sent.');
  }
  if (c.failed > 0) out.push(`${formatCount(c.failed, 'en-US')} couldn't be sent.`);
  if (s.published_now) out.push(`Your campaign is now published (${s.published_role === 2 ? 'View Only' : 'Public'}).`);
  return out.join(' ');
}
