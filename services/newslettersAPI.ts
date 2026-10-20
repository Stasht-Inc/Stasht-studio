import { apiRequest, fetchWithRateLimitRetry, getApiBaseUrl } from '../utils/authUtils';
import { requestUpgrade } from '../utils/planEvents';
import { toResult, resultFromRaw, testSendResult, GENERIC_ERROR } from '../components/newsletters/lib/apiResult';
import type { NlResult, ApiLikeResponse } from '../components/newsletters/lib/apiResult';

// Newsletter campaigns API (spec 2026-10-13 §8). Every route is under /api/react behind auth:react_api and
// RequirePaidPlan. apiRequest wraps the server body {success, data}, so each call peels one envelope (toResult).
// Call these only once the Newsletter tab or the Newsletters view is open on a paid plan: a Starter account gets
// 403 plan_required, and apiRequest then opens the upgrade modal (contract note 1).
// Every time is UTC ISO-8601 with a Z (contract note 5); show it with Intl in the person's time zone.

export type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
export type NewsletterChannel = 'email' | 'sms';
export type NewsletterTemplate = 'basic';

export interface NewsletterHeader {
  logo_url: string | null;
  banner_url: string | null;
  background_color: string | null;
  title: string | null;
}

export type BlockType = 'image' | 'title' | 'text' | 'youtube' | 'button' | 'divider';
export type TitleSize = 'large' | 'medium' | 'small';
export type DividerStyle = 'line' | 'space';

export interface ImageBlockData { url: string; alt: string; link: string | null }
export interface TitleBlockData { text: string; size: TitleSize }
export interface TextBlockData { html: string }
export interface YoutubeBlockData { url: string }
export interface ButtonBlockData { label: string; url: string; color: string }
export interface DividerBlockData { style: DividerStyle }

export type NewsletterBlock =
  | { id: string; type: 'image'; data: ImageBlockData }
  | { id: string; type: 'title'; data: TitleBlockData }
  | { id: string; type: 'text'; data: TextBlockData }
  | { id: string; type: 'youtube'; data: YoutubeBlockData }
  | { id: string; type: 'button'; data: ButtonBlockData }
  | { id: string; type: 'divider'; data: DividerBlockData };

export type AudienceItem = { type: 'all_leads' } | { type: 'lead_group'; id: number } | { type: 'list'; id: number };

export interface NewsletterCounts {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  failed: number;
  skipped: number;
}

export interface Newsletter {
  id: number;
  name: string | null;
  subject: string | null;
  preview_text: string | null;
  from_name: string | null;
  reply_to_email: string | null;
  channels: NewsletterChannel[];
  sms_text: string | null;
  template: NewsletterTemplate;
  header: NewsletterHeader;
  blocks: NewsletterBlock[];
  audience: AudienceItem[];
  status: NewsletterStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  public_url: string | null;
  counts: NewsletterCounts;
  created_at: string;
  updated_at: string;
}

/** GET /newsletters rows: the same object without blocks. */
export type NewsletterSummary = Omit<Newsletter, 'blocks'>;

/** PUT /newsletters/{id}: any editable field (only drafts can be edited). Unfinished sections are accepted;
 *  send / schedule reject them (contract note 6). Saving `header` also saves the account's brand header (note 8). */
export type NewsletterInput = Partial<Pick<Newsletter,
  'name' | 'subject' | 'preview_text' | 'from_name' | 'reply_to_email' | 'channels' | 'sms_text' | 'template' | 'header' | 'blocks' | 'audience'>>;

export interface AudienceCount {
  email: number;
  sms: number;
  skipped: { no_email: number; no_phone: number; unsubscribed: number; duplicate: number };
}

export type RecipientStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped';
/** The results `status` filter also takes what happened after delivery (contract note 3). */
export type ResultsStatusFilter = RecipientStatus | 'opened' | 'clicked' | 'unsubscribed';
export interface RecipientRow {
  name: string | null;
  address: string;
  channel: NewsletterChannel;
  status: RecipientStatus;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribed_at: string | null;
}
export interface PageMeta { page: number; total_pages: number; total: number }
/** Results totals plus the same eight numbers per channel (contract note 2). */
export interface NewsletterResultCounts extends NewsletterCounts { email: NewsletterCounts; sms: NewsletterCounts }
export interface NewsletterResults { counts: NewsletterResultCounts; recipients: { data: RecipientRow[]; meta: PageMeta } }
export interface ResultsQuery { channel?: NewsletterChannel; status?: ResultsStatusFilter; page?: number }

export interface NewsletterBrand { header: NewsletterHeader; business_address: string | null }
export interface NewsletterAllowance {
  plan: string;
  email_limit: number;
  sms_limit: number;
  email_used: number;
  sms_used: number;
  resets_at: string;
}

export type ContactListSource = 'import' | 'leads' | 'lead_group';
export interface ContactList {
  id: number;
  name: string;
  source: ContactListSource;
  member_count: number;
  email_count: number;
  sms_count: number;
  created_at: string;
}
export interface ImportRow { name?: string; email?: string; phone?: string }
export type ImportResult = ContactList & { imported: number; skipped_invalid: number; merged_duplicates: number };
export interface ContactListMember { name: string | null; email: string | null; phone: string | null }
export interface ContactListMembers { data: ContactListMember[]; meta: PageMeta }

// Lists and drafts must never be stale right after a write, so reads skip apiRequest's 15 s GET cache.
const FRESH = { method: 'GET', skipCache: true } as RequestInit;
const nl = (id: number) => `/newsletters/${encodeURIComponent(String(id))}`;
const list = (id: number) => `/contact-lists/${encodeURIComponent(String(id))}`;

async function call<T>(endpoint: string, init: RequestInit): Promise<NlResult<T>> {
  try {
    return toResult<T>((await apiRequest(endpoint, init)) as unknown as ApiLikeResponse);
  } catch {
    return { ok: false, error: GENERIC_ERROR, fieldErrors: {} };
  }
}

const get = <T>(endpoint: string) => call<T>(endpoint, FRESH);
const write = <T>(method: 'POST' | 'PUT' | 'DELETE', endpoint: string, body?: unknown) =>
  call<T>(endpoint, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// Multipart can't go through apiRequest (it forces Content-Type: application/json). Mirrors its 403/429 handling.
async function uploadImage(file: File): Promise<NlResult<{ url: string }>> {
  const token = localStorage.getItem('stasht_token');
  const form = new FormData();
  form.append('file', file);
  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(`${getApiBaseUrl()}/newsletters/images`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
  } catch {
    return { ok: false, error: 'The image could not be uploaded. Check your connection and try again.', fieldErrors: {} };
  }
  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const result = resultFromRaw<{ url: string }>(response.status, body);
  if (result.planRequired) requestUpgrade(result.error);
  return result;
}

export const newslettersAPI = {
  list: (status?: NewsletterStatus) => get<NewsletterSummary[]>(`/newsletters${query({ status })}`),
  create: (name?: string) => write<Newsletter>('POST', '/newsletters', name ? { name } : {}),
  get: (id: number) => get<Newsletter>(nl(id)),
  update: (id: number, input: NewsletterInput) => write<Newsletter>('PUT', nl(id), input),
  remove: (id: number) => write<Record<string, never>>('DELETE', nl(id)),
  duplicate: (id: number) => write<Newsletter>('POST', `${nl(id)}/duplicate`),
  audienceCount: (audience: AudienceItem[], channels: NewsletterChannel[]) =>
    write<AudienceCount>('POST', '/newsletters/audience-count', { audience, channels }),
  preview: (id: number) => write<{ html: string }>('POST', `${nl(id)}/preview`),
  // The hourly test limit (429) is a real answer, not a blip: no retries, and say so plainly.
  sendTest: async (id: number, channel: NewsletterChannel) => testSendResult(
    await call<{ sent_to: string }>(`${nl(id)}/test`, { method: 'POST', body: JSON.stringify({ channel }), noRateLimitRetry: true } as RequestInit),
  ),
  send: (id: number) => write<Newsletter>('POST', `${nl(id)}/send`),
  schedule: (id: number, scheduledAt: string) => write<Newsletter>('POST', `${nl(id)}/schedule`, { scheduled_at: scheduledAt }),
  cancel: (id: number) => write<Newsletter>('POST', `${nl(id)}/cancel`),
  results: (id: number, q: ResultsQuery = {}) =>
    get<NewsletterResults>(`${nl(id)}/results${query({ channel: q.channel, status: q.status, page: q.page })}`),
  uploadImage,
  getBrand: () => get<NewsletterBrand>('/newsletter-brand'),
  // Only used to set business_address: a newsletter's header reaches the brand through PUT /newsletters/{id}.
  updateBrand: (input: { header?: NewsletterHeader; business_address?: string | null }) =>
    write<NewsletterBrand>('PUT', '/newsletter-brand', input),
  allowance: () => get<NewsletterAllowance>('/newsletter-allowance'),
  contactLists: () => get<ContactList[]>('/contact-lists'),
  importList: (input: { name: string; consent: true; rows: ImportRow[] }) =>
    write<ImportResult>('POST', '/contact-lists/import', input),
  listFromLeads: (input: { name: string; lead_group_id?: number }) => write<ContactList>('POST', '/contact-lists/from-leads', input),
  listMembers: (id: number, page = 1) => get<ContactListMembers>(`${list(id)}/members${query({ page })}`),
  deleteList: (id: number) => write<Record<string, never>>('DELETE', list(id)),
};
