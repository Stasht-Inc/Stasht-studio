// Pure response helpers for services/newslettersAPI.ts. No imports, so `node --test` loads this file directly.

export interface NlResult<T> {
  ok: boolean;
  data?: T;
  /** One plain sentence for a toast. */
  error?: string;
  /** Laravel 422 errors: the full key ('blocks.2.data.url') and its first part ('blocks'), all messages joined. */
  fieldErrors: Record<string, string>;
  /** 409: the newsletter is no longer a draft, or can't be deleted in its status. */
  conflict?: boolean;
  /** 403 plan_required: the account is on the free Starter plan. */
  planRequired?: boolean;
  /** 429: still throttled (apiRequest's own retries, if any, are spent). */
  rateLimited?: boolean;
  /** 422 allowance: which channel ran out, what this send needs, what is left (contract note 4). */
  allowance?: AllowanceShortfall;
  /** The server's `code`, when it sent one. */
  code?: string;
  /** 409 stale: the draft was saved from another tab or device since this one loaded it. */
  stale?: boolean;
  /** Sending is switched off: for everyone (`all`) or for this account (`account`). */
  paused?: 'all' | 'account';
  /** The HTTP status when the server answered (none: the request never got an answer). */
  status?: number;
}

export interface AllowanceShortfall {
  channel: 'email' | 'sms';
  needed: number;
  remaining: number;
}

/** What apiRequest (utils/authUtils.ts) resolves with. */
export interface ApiLikeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  errors?: unknown;
  conflict?: boolean;
  code?: string;
  statusCode?: number;
  /** apiRequest sets this (with statusCode 429) when the throttle still answers 429 after its retries. */
  rateLimited?: boolean;
  [key: string]: unknown;
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const RATE_LIMITED_ERROR = 'Too many requests. Wait a minute and try again.';
export const PLAN_REQUIRED_ERROR = 'Newsletters are available on paid plans.';
export const TEST_LIMIT_ERROR = "You've sent the most test messages for this hour. Try again later.";
export const STALE_ERROR = 'This newsletter was changed in another tab. Reload to see the latest.';
export const PAUSED_ERROR = 'Newsletters are paused right now. Your draft is saved. Try again later.';
export const ACCOUNT_PAUSED_ERROR = 'Sending is paused for your account. Contact support.';

/** The codes that get their own words and flags (they are 409s or 503s, but never "no longer a draft"). */
function special(code: unknown): Partial<NlResult<never>> | null {
  if (code === 'stale') return { code, stale: true, conflict: false, error: STALE_ERROR };
  if (code === 'newsletters_paused') return { code, paused: 'all', conflict: false, error: PAUSED_ERROR };
  if (code === 'newsletters_account_paused') return { code, paused: 'account', conflict: false, error: ACCOUNT_PAUSED_ERROR };
  return null;
}

/** The server body is {success, data}; apiRequest wraps it once more. Peel exactly one envelope. */
export function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'success' in body && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T | undefined;
}

export function flattenFieldErrors(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return out;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const messages = (Array.isArray(value) ? value : [value]).map((m) => String(m ?? '').trim()).filter(Boolean);
    const message = [...new Set(messages)].join(' ');
    if (!message) continue;
    if (!out[key]) out[key] = message;
    const root = key.split('.')[0];
    if (!out[root]) out[root] = message;
  }
  return out;
}

/** The top-level `allowance` object of a 422 (contract note 4), if it has the agreed shape. */
function allowanceFrom(value: unknown): AllowanceShortfall | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const a = value as Record<string, unknown>;
  if ((a.channel !== 'email' && a.channel !== 'sms') || typeof a.needed !== 'number' || typeof a.remaining !== 'number') return undefined;
  return { channel: a.channel, needed: a.needed, remaining: a.remaining };
}

const mentionsRateLimit = (message: string): boolean => message.toLowerCase().includes('too many requests');

export function toResult<T>(res: ApiLikeResponse | null | undefined): NlResult<T> {
  if (!res) return { ok: false, error: GENERIC_ERROR, fieldErrors: {} };
  if (res.success) return { ok: true, data: unwrap<T>(res.data), fieldErrors: {} };
  const fieldErrors = flattenFieldErrors(res.errors);
  const planRequired = res.code === 'plan_required';
  const raw = String(res.error || res.message || Object.values(fieldErrors)[0] || GENERIC_ERROR);
  // apiRequest flags a 429 with rateLimited + statusCode; the message check covers older paths.
  const rateLimited = res.rateLimited === true || res.statusCode === 429 || mentionsRateLimit(raw);
  // A 429: the server's own words when it sent some (apiRequest keeps them as `message`), never Laravel's default.
  const serverWords = typeof res.message === 'string' && res.message.trim() && !/^too many attempts\.?$/i.test(res.message.trim()) ? res.message.trim() : '';
  return {
    ok: false,
    error: planRequired ? String(res.message || PLAN_REQUIRED_ERROR) : rateLimited ? (res.rateLimited === true || res.statusCode === 429 ? serverWords || RATE_LIMITED_ERROR : RATE_LIMITED_ERROR) : raw,
    fieldErrors,
    conflict: res.conflict === true || res.statusCode === 409,
    planRequired,
    ...(rateLimited ? { rateLimited: true } : {}),
    allowance: allowanceFrom(res.allowance),
    ...(typeof res.code === 'string' && res.code ? { code: res.code } : {}),
    ...(typeof res.statusCode === 'number' ? { status: res.statusCode } : {}),
    ...special(res.code),
  };
}

/** A failed save worth trying again by itself (back online, tab shown again): no answer at all, or a server error. */
export function retryableSaveFailure(r: NlResult<unknown>): boolean {
  if (r.ok || r.stale || r.planRequired || r.rateLimited || r.paused) return false;
  if (Object.keys(r.fieldErrors ?? {}).length) return false;
  return r.status === undefined || r.status >= 500;
}

/** POST /newsletters/{id}/test answers 429 when the hourly test limit is reached (NewsletterTestSendController);
 *  apiRequest replaces the server's words with a generic "too many requests", so say what happened. */
export function testSendResult<T>(r: NlResult<T>): NlResult<T> {
  return !r.ok && r.rateLimited ? { ...r, error: TEST_LIMIT_ERROR } : r;
}

/** Same mapping for a raw fetch (the multipart image upload), which skips apiRequest. */
export function resultFromRaw<T>(status: number, body: unknown): NlResult<T> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (status === 429) return { ok: false, error: RATE_LIMITED_ERROR, fieldErrors: {}, rateLimited: true };
  if (status === 403 && b.code === 'plan_required') {
    return { ok: false, error: String(b.message || PLAN_REQUIRED_ERROR), fieldErrors: {}, planRequired: true };
  }
  if (status < 200 || status >= 300 || b.success !== true) {
    const fieldErrors = flattenFieldErrors(b.errors);
    return { ok: false, error: String(b.message || b.error || Object.values(fieldErrors)[0] || GENERIC_ERROR), fieldErrors, conflict: status === 409, status, ...special(b.code) };
  }
  return { ok: true, data: b.data as T, fieldErrors: {} };
}
