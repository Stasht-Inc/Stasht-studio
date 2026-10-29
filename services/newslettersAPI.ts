import { apiRequest, fetchWithRateLimitRetry, getApiBaseUrl, tokenUtils, userUtils } from '../utils/authUtils';
import { STALE_TAB_MESSAGE, isTabStale } from '../utils/accountSwitch';
import { requestUpgrade } from '../utils/planEvents';
import { toResult, resultFromRaw, testSendResult, GENERIC_ERROR } from '../components/newsletters/lib/apiResult';
import type { NlResult, ApiLikeResponse } from '../components/newsletters/lib/apiResult';
import { filenameFromDisposition } from '../components/newsletters/lib/lists';

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

export type BlockType = 'image' | 'title' | 'text' | 'youtube' | 'button' | 'divider' | 'campaigns';
export type TitleSize = 'large' | 'medium' | 'small';
export type DividerStyle = 'line' | 'space';

export interface ImageBlockData { url: string; alt: string; link: string | null }
export interface TitleBlockData { text: string; size: TitleSize }
export interface TextBlockData { html: string }
export interface YoutubeBlockData { url: string }
export interface ButtonBlockData { label: string; url: string; color: string }
export interface DividerBlockData { style: DividerStyle }
/** What a Campaigns section can show (shared brief 2026-10-29): the owner's campaigns, Website Catalogue products
 *  and dealer vehicles. Products and vehicles link to their own page on the business's website. */
export type CampaignKind = 'campaign' | 'product' | 'vehicle';
export interface CampaignSelection { kind: CampaignKind; id: number }
/** One card as the API snapshots it on every save of a draft (frozen once sent). description: plain text, 160
 *  characters at most; cover_url: https or null; url: the campaign's public page, or the product's / vehicle's
 *  own page (http or https); price_text: e.g. "$129.99"; meta: a short plain line ("2021 · 45,000 km · Automatic"). */
export interface CampaignItem {
  kind: CampaignKind;
  id: number;
  title: string;
  description: string;
  cover_url: string | null;
  url: string;
  date: string | null;
  price_text: string | null;
  meta: string | null;
}
/** Studio sends selections (0–6, in order) and campaign_ids (the campaign-kind ids, for older readers; the API
 *  ignores them when selections is there). The API drops what the owner can't share and answers with `items`,
 *  built on the server, so the email never depends on what the browser sent. */
export interface CampaignsBlockData {
  selections: CampaignSelection[];
  campaign_ids: number[];
  items?: CampaignItem[];
  /** Cards side by side (2) or one under another (1). Absent: a section from before columns, which is 1 (shared brief
   *  2026-10-29 round 2). Studio sets 2 on a new section; phones always get 1 in the sent email. */
  columns?: CampaignColumns;
  /** Per-card edits for this newsletter only, keyed "<kind>:<id>" as in selections (shared brief 2026-10-29 round
   *  2). Every field is optional; empty or missing = the item's own value. The card's link can't be changed. */
  overrides?: CardOverrides;
}
export type CampaignColumns = 1 | 2;
/** One card's edits: image_url https (from POST /newsletters/images), title ≤ 120, description ≤ 300 (plain text,
 *  one paragraph), button_text ≤ 30. */
export interface CardOverride { image_url?: string | null; title?: string | null; description?: string | null; button_text?: string | null }
export type CardOverrides = Record<string, CardOverride>;
/** GET /newsletters/campaign-options rows, newest first. shareable: it has a page people can open from an email;
 *  otherwise `reason` says why ("This item has no web page"). public_url: that page. kind is missing from an
 *  older API (then it is the kind asked for). */
export interface CampaignOption {
  kind?: CampaignKind;
  id: number;
  title: string;
  description: string | null;
  cover_url: string | null;
  date: string | null;
  public_url: string | null;
  shareable: boolean;
  reason: string | null;
  price_text?: string | null;
  meta?: string | null;
  category?: string | null;
}

export type NewsletterBlock =
  | { id: string; type: 'image'; data: ImageBlockData }
  | { id: string; type: 'title'; data: TitleBlockData }
  | { id: string; type: 'text'; data: TextBlockData }
  | { id: string; type: 'youtube'; data: YoutubeBlockData }
  | { id: string; type: 'button'; data: ButtonBlockData }
  | { id: string; type: 'divider'; data: DividerBlockData }
  | { id: string; type: 'campaigns'; data: CampaignsBlockData };

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
  /** The time picked on a draft (Schedule for later), kept for the composer; null until the API has the column. */
  planned_send_at?: string | null;
  sent_at: string | null;
  /** Why a failed newsletter failed: too_late (over 6 hours late, nothing sent) or error (before it started). */
  failure_reason?: 'too_late' | 'error' | null;
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
  'name' | 'subject' | 'preview_text' | 'from_name' | 'reply_to_email' | 'channels' | 'sms_text' | 'template' | 'header' | 'blocks' | 'audience' | 'planned_send_at'>>;

export interface AudienceCount {
  email: number;
  sms: number;
  /** consent_expired (implied consent over 6 months old) and unsupported_number (not a Canadian or US mobile,
   *  texts only): newer API versions only. */
  skipped: { no_email: number; no_phone: number; unsubscribed: number; duplicate: number; consent_expired?: number; unsupported_number?: number };
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

/** counts: how many of each kind the owner has (a tab shows only when its count is above 0; an older API sends
 *  none). categories: the current kind's categories, sorted (none for campaigns). */
export interface CampaignOptionsMeta extends PageMeta { counts?: Partial<Record<CampaignKind, number>>; categories?: string[] }
export interface CampaignOptionsPage { data: CampaignOption[]; meta: CampaignOptionsMeta }
export interface CampaignOptionsQuery { kind?: CampaignKind; search?: string; category?: string; page?: number }

export interface NewsletterBrand { header: NewsletterHeader; business_address: string | null }
export interface NewsletterAllowance {
  plan: string;
  email_limit: number;
  sms_limit: number;
  email_used: number;
  sms_used: number;
  /** Held back for newsletters sending or scheduled (not sent yet). Optional: older API versions leave them out. */
  email_pending?: number;
  sms_pending?: number;
  resets_at: string;
}

/** manual: made empty on the Leads page's Lists tab (POST /contact-lists). */
export type ContactListSource = 'import' | 'leads' | 'lead_group' | 'manual';
/** CASL: express = they asked to hear from you; implied = customers and recent enquiries (expires after 6 months). */
export type ConsentType = 'express' | 'implied';
export interface ContactList {
  id: number;
  name: string;
  source: ContactListSource;
  member_count: number;
  email_count: number;
  sms_count: number;
  /** Null for lists made before consent was recorded (or before the API's consent columns exist). */
  consent_type?: ConsentType | null;
  /** When the list was imported or made. */
  created_at: string | null;
  /** When the list or anyone on it last changed (newer API versions). */
  updated_at?: string | null;
  /** People on it who unsubscribed, bounced, complained or replied STOP (newer API versions). */
  unsubscribed_count?: number;
}
/** consent_at: the date this person agreed, as written in the file (the API reads it; a bad or future date is ignored). */
export interface ImportRow { name?: string; email?: string; phone?: string; consent_at?: string }
export interface ImportInput { name: string; consent: true; consent_type: ConsentType; consent_source?: string; rows: ImportRow[] }
export type ImportResult = ContactList & { imported: number; skipped_invalid: number; merged_duplicates: number };
/** null: no email address (or no mobile number) on file. */
export type MemberEmailStatus = 'subscribed' | 'unsubscribed' | 'bounced' | 'complained';
export type MemberSmsStatus = 'subscribed' | 'stopped';
export interface ContactListMember {
  /** Newer API versions (the Lists tab needs it to edit or remove someone). */
  id?: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  email_status?: MemberEmailStatus | null;
  sms_status?: MemberSmsStatus | null;
  consent_type?: ConsentType | null;
  consent_source?: string | null;
  consent_at?: string | null;
  added_at?: string | null;
}
export type MemberStatusFilter = 'all' | 'subscribed' | 'unsubscribed';
/** counts: the whole list by status, whatever the search (newer API versions). */
export interface ContactListMembers { data: ContactListMember[]; meta: PageMeta & { counts?: Record<MemberStatusFilter, number> } }
export interface MembersQuery { page?: number; search?: string; status?: MemberStatusFilter }
export interface MemberInput { name?: string | null; email?: string | null; phone?: string | null }
export interface NewMemberInput extends MemberInput { consent_type: ConsentType; consent_source?: string }
/** POST /contact-lists/{id}/import and /members/copy: what the merge did, and the list as it is now. unchanged
 *  (import, newer API versions): people already on the list with nothing new to fill in. Add, edit, import and copy
 *  can also answer 409 "Someone changed this list at the same time. Please try again." (shown as the API words it). */
export interface MergeResult { added: number; updated: number; skipped: number; unchanged?: number; list: ContactList }
export interface ExportFile { blob: Blob; filename: string }

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
const write = <T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', endpoint: string, body?: unknown) =>
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

// GET /contact-lists/{id}/export answers a CSV file, not JSON, so it skips apiRequest. It keeps apiRequest's
// sign-in handling (an expired token is cleared before asking; a 401 clears it and goes to /login) and its
// 403 plan_required / 429 handling.
async function exportList(id: number, fallbackName: string): Promise<NlResult<ExportFile>> {
  const token = localStorage.getItem('stasht_token');
  if (token && tokenUtils.isTokenExpired(token)) {
    userUtils.clearAuthData();
    return { ok: false, error: 'Authentication token has expired. Please log in again.', fieldErrors: {}, status: 401 };
  }
  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(`${getApiBaseUrl()}${list(id)}/export`, {
      method: 'GET',
      headers: { Accept: 'text/csv, application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    // A tab that switched account elsewhere refuses API calls (utils/accountSwitch.ts): say so, not "connection".
    if (isTabStale()) return { ok: false, error: STALE_TAB_MESSAGE, fieldErrors: {} };
    return { ok: false, error: 'The file could not be downloaded. Check your connection and try again.', fieldErrors: {} };
  }
  if (response.status === 401) {
    userUtils.clearAuthData();
    window.setTimeout(() => { window.location.href = '/login'; }, 100);
    return { ok: false, error: 'Authentication failed. Please log in again.', fieldErrors: {}, status: 401 };
  }
  const type = response.headers.get('Content-Type') || '';
  if (response.ok && !type.includes('application/json')) {
    try {
      const blob = await response.blob();
      return { ok: true, data: { blob, filename: filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackName) }, fieldErrors: {} };
    } catch {
      return { ok: false, error: 'The file could not be downloaded. Check your connection and try again.', fieldErrors: {} };
    }
  }
  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const result = resultFromRaw<ExportFile>(response.ok ? 500 : response.status, body);
  if (result.planRequired) requestUpgrade(result.error);
  return result;
}

export const newslettersAPI = {
  list: (status?: NewsletterStatus) => get<NewsletterSummary[]>(`/newsletters${query({ status })}`),
  create: (name?: string) => write<Newsletter>('POST', '/newsletters', name ? { name } : {}),
  get: (id: number) => get<Newsletter>(nl(id)),
  // ifUnmodifiedSince: the draft's updated_at as this tab last saw it. The API answers 409 code `stale` when it
  // was saved elsewhere since (requests without it are still accepted).
  update: (id: number, input: NewsletterInput, ifUnmodifiedSince?: string | null) =>
    write<Newsletter>('PUT', nl(id), ifUnmodifiedSince ? { ...input, if_unmodified_since: ifUnmodifiedSince } : input),
  remove: (id: number) => write<Record<string, never>>('DELETE', nl(id)),
  duplicate: (id: number) => write<Newsletter>('POST', `${nl(id)}/duplicate`),
  audienceCount: (audience: AudienceItem[], channels: NewsletterChannel[]) =>
    write<AudienceCount>('POST', '/newsletters/audience-count', { audience, channels }),
  // size_kb: the rendered email's size (Gmail hides the end of emails over about 100 KB).
  preview: (id: number) => write<{ html: string; size_kb?: number }>('POST', `${nl(id)}/preview`),
  // The hourly test limit (429) is a real answer, not a blip: no retries, and say so plainly.
  sendTest: async (id: number, channel: NewsletterChannel) => testSendResult(
    await call<{ sent_to: string }>(`${nl(id)}/test`, { method: 'POST', body: JSON.stringify({ channel }), noRateLimitRetry: true } as RequestInit),
  ),
  send: (id: number) => write<Newsletter>('POST', `${nl(id)}/send`),
  schedule: (id: number, scheduledAt: string) => write<Newsletter>('POST', `${nl(id)}/schedule`, { scheduled_at: scheduledAt }),
  cancel: (id: number) => write<Newsletter>('POST', `${nl(id)}/cancel`),
  // Scheduled → draft so it can be edited (the time is kept in planned_send_at); 409 once sending has started.
  unschedule: (id: number) => write<Newsletter>('POST', `${nl(id)}/unschedule`),
  results: (id: number, q: ResultsQuery = {}) =>
    get<NewsletterResults>(`${nl(id)}/results${query({ channel: q.channel, status: q.status, page: q.page })}`),
  uploadImage,
  // What a Campaigns section can show, 20 a page (shared contracts 2026-10-28 and 2026-10-29). kind defaults to
  // campaign on the API, so it is sent only for products and vehicles.
  campaignOptions: (q: CampaignOptionsQuery = {}) =>
    get<CampaignOptionsPage>(`/newsletters/campaign-options${query({
      kind: q.kind && q.kind !== 'campaign' ? q.kind : undefined,
      search: q.search?.trim() || undefined,
      category: q.category || undefined,
      page: q.page,
    })}`),
  getBrand: () => get<NewsletterBrand>('/newsletter-brand'),
  // Only used to set business_address: a newsletter's header reaches the brand through PUT /newsletters/{id}.
  updateBrand: (input: { header?: NewsletterHeader; business_address?: string | null }) =>
    write<NewsletterBrand>('PUT', '/newsletter-brand', input),
  allowance: () => get<NewsletterAllowance>('/newsletter-allowance'),
  contactLists: () => get<ContactList[]>('/contact-lists'),
  importList: (input: ImportInput) =>
    write<ImportResult>('POST', '/contact-lists/import', input),
  listFromLeads: (input: { name: string; lead_group_id?: number }) => write<ContactList>('POST', '/contact-lists/from-leads', input),
  listMembers: (id: number, page = 1, q: Omit<MembersQuery, 'page'> = {}) =>
    get<ContactListMembers>(`${list(id)}/members${query({ page, search: q.search?.trim() || undefined, status: q.status && q.status !== 'all' ? q.status : undefined })}`),
  // Lists tab (Leads page). An empty list made here (source manual).
  createList: (name: string) => write<ContactList>('POST', '/contact-lists', { name }),
  // 409: the email or mobile number is already on this list. 422 keys: email, phone, consent_type, name.
  addMember: (id: number, input: NewMemberInput) => write<ContactListMember>('POST', `${list(id)}/members`, input),
  updateMember: (id: number, memberId: number, input: MemberInput) =>
    write<ContactListMember>('PATCH', `${list(id)}/members/${encodeURIComponent(String(memberId))}`, input),
  removeMembers: (id: number, ids: number[]) => write<{ removed: number; list: ContactList }>('POST', `${list(id)}/members/remove`, { ids }),
  // Same body as importList minus name; merges into the list.
  importIntoList: (id: number, input: Omit<ImportInput, 'name'>) => write<MergeResult>('POST', `${list(id)}/import`, input),
  duplicateList: (id: number, name?: string) => write<ContactList>('POST', `${list(id)}/duplicate`, name ? { name } : {}),
  copyMembers: (id: number, ids: number[], targetListId: number) =>
    write<MergeResult>('POST', `${list(id)}/members/copy`, { ids, target_list_id: targetListId }),
  exportList,
  // 409 while a scheduled or sending newsletter uses the list ("Cancel it first").
  deleteList: (id: number) => write<Record<string, never>>('DELETE', list(id)),
  renameList: (id: number, name: string) => write<ContactList>('PATCH', list(id), { name }),
};
