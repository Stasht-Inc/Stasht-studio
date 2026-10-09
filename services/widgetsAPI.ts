import { apiRequest, fetchWithRateLimitRetry, API_BASE_URL } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';
import { requestUpgrade } from '../utils/planEvents';

// Contact Us widget management API (authenticated, /api/react/widgets).
// The public embed endpoints (/widget-embed/*, /widgets/{id}/submit) are called by
// public/widget-embed.js directly and are intentionally not wrapped here.

export type WidgetStatus = 'draft' | 'live' | 'paused';
export type WidgetBubblePosition = 'bottom-left' | 'bottom-right';

// Business hours as stored (WidgetBusinessHours.php): each day null (closed) or [opens, closes] as "HH:MM".
export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type BusinessHours = Record<WeekdayKey, [string, string] | null>;

export interface WidgetTheme {
  primary_color: string | null;
  logo_url: string | null;
  bubble_position: WidgetBubblePosition;
}

// Built-in form fields (see WidgetFormFields.php). Mobile or Email must be shown + required.
export type FormFieldKey = 'name' | 'mobile' | 'email' | 'company' | 'message';
export interface FormFieldSetting {
  show: boolean;
  required: boolean;
  label: string;
}
export type FormFieldSettings = Record<FormFieldKey, FormFieldSetting>;

// A website the widget has been loaded on, as reported by the embed page (most recent first).
export interface WidgetInstall {
  host: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

// "Who gets this widget's leads" (spec 2026-09-30). Order from the API: owner, then Admins, then
// Partial Admins, then the property team (owner/admins/reps mixed), each group by name.
export type LeadRecipientRole = 'owner' | 'admin' | 'partial_admin' | 'property_owner' | 'property_admin' | 'rep';

export type LeadRecipientStatus = 'active' | 'pending';

export interface LeadRecipient {
  key: string; // 'u:<external_user_id>' (has an account) or 'e:<lowercased email>' (invited, no account)
  name: string;
  email: string | null; // lowercased; null only if an account has no email
  avatar_url: string | null; // https:// photo or null
  initials: string;
  color: string; // always '#rrggbb'
  role: LeadRecipientRole;
  // 'pending' = invited but not accepted yet (decided like the Users tab). Pending people are listed
  // and their tick saves, but they get no lead emails or access until they accept.
  status: LeadRecipientStatus;
  connected: boolean;
  locked: boolean; // true only for the owner row (always connected, can't be unticked)
}

export interface ContactWidget {
  id: string; // 'w_' + 10 chars, used directly in the embed snippet
  name: string;
  status: WidgetStatus;
  agent_name: string | null;
  callout_text: string | null;
  welcome_subtext: string | null;
  theme: WidgetTheme;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
  leads_count: number;
  installs?: WidgetInstall[]; // absent from older API builds
  form_fields?: FormFieldSettings; // absent from older API builds -> the original form
  // The dealership whose team takes over this widget's leads; null = the owner alone.
  property_id?: number | null;
  // The property a widget belongs to (its owner and admins can manage it); null = personal.
  property?: { id: number; name: string } | null;
  // After hours (spec 2026-09-29 part 2); absent from older API builds.
  business_hours?: BusinessHours | null; // null = no hours set: always open (the AI answers at any hour either way)
  timezone?: string | null; // IANA name
  faq_notes?: string | null; // "Notes for the AI"
  ai_enabled?: boolean;
  // "Don't show on these pages": "/checkout", "/account/*". Absent from older API builds.
  hidden_paths?: string[];
  // "Who gets this widget's leads"; absent from the list endpoint and from older API builds.
  lead_recipients?: LeadRecipient[];
}

// A dealership a widget's leads can go to (GET /widgets team_options).
export interface WidgetTeamOption {
  id: number;
  name: string;
}

// Widget AI knowledge (spec 2026-10-02 §5): files + one website, feeding the after-hours AI
// alongside "Notes for the AI". Fallback used if the server ever omits limit_chars.
export const KNOWLEDGE_CHAR_LIMIT = 60000;
export const KNOWLEDGE_MAX_FILES = 5;

export type KnowledgeSourceKind = 'file' | 'website';
export type KnowledgeSourceStatus = 'ready' | 'failed' | 'blocked' | 'importing';

export interface KnowledgeSource {
  id: number;
  kind: KnowledgeSourceKind;
  name: string;
  status: KnowledgeSourceStatus;
  error: string | null;
  chars: number;
  pages: number | null;
  imported_at: string | null;
}

export interface KnowledgeData {
  sources: KnowledgeSource[];
  used_chars: number;
  limit_chars: number;
}

interface SourceWithUsage {
  source: KnowledgeSource;
  used_chars: number;
  limit_chars: number;
}

// website/start's two shapes (no import started on blocked/failed).
export interface WebsiteImportStarted {
  status: 'importing';
  import_id: string;
  pages: string[];
  source: KnowledgeSource;
}
export interface WebsiteImportStopped {
  status: 'blocked' | 'failed';
  message: string;
  source: KnowledgeSource;
}
export type WebsiteStartResult = WebsiteImportStarted | WebsiteImportStopped;

export interface WebsitePageResult {
  url: string;
  chars: number;
  status: 'ok' | 'blocked' | 'failed';
}

// Fields editable in this phase. Every field is optional so PATCH can send a partial body.
export interface ContactWidgetInput {
  name?: string;
  status?: WidgetStatus;
  agent_name?: string | null;
  callout_text?: string | null;
  welcome_subtext?: string | null;
  theme?: Partial<WidgetTheme>;
  allowed_domains?: string[];
  form_fields?: Partial<Record<FormFieldKey, Partial<FormFieldSetting>>>;
  property_id?: number | null;
  business_hours?: BusinessHours | null;
  timezone?: string | null;
  faq_notes?: string | null;
  ai_enabled?: boolean;
  hidden_paths?: string[];
  // Keys of unticked, unlocked lead_recipients rows. [] = everyone ticked; omit = no change.
  excluded_recipients?: string[];
}

// Server bodies are {success, data}. apiRequest wraps a successful body as
// {success: true, data: <body>}, so the payload is one `.data` deeper than the
// contract reads; unwrap defensively so either shape works.
function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T | undefined;
}

export interface WidgetResult<T> {
  ok: boolean;
  data?: T;
  // Human-readable summary for a toast.
  error?: string;
  // Laravel 422 errors flattened to one message per field ('theme.primary_color' style keys kept;
  // 'allowed_domains.N' folded into 'allowed_domains').
  fieldErrors: Record<string, string>;
}

function flattenFieldErrors(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors || typeof errors !== 'object') return out;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const message = Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');
    if (!message) continue;
    const field = key.replace(/\.\d+$/, '');
    if (!out[field]) out[field] = message;
  }
  return out;
}

// apiRequest's own 429 copy ("Too many requests right now...") is generic; the AI knowledge spec
// asks for this exact wording, so both run() and the raw multipart upload below normalize to it.
const TOO_MANY_REQUESTS = 'Too many requests — try again in a minute.';
const isRateLimitedError = (message: string | undefined): boolean =>
  typeof message === 'string' && message.toLowerCase().includes('too many requests');

async function run<T>(request: Promise<ApiResponse<any>>): Promise<WidgetResult<T>> {
  try {
    const res = await request;
    if (!res.success) {
      const message = res.error || res.message || 'Request failed. Please try again.';
      return {
        ok: false,
        error: isRateLimitedError(message) ? TOO_MANY_REQUESTS : message,
        fieldErrors: flattenFieldErrors(res.errors),
      };
    }
    return { ok: true, data: unwrap<T>(res.data), fieldErrors: {} };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
  }
}

// website/start and website/page each hold a per-user lock server-side (one page fetch at a
// time) and answer 429 {code: 'import_busy', message: 'Another page is still being read. Try
// again in a moment.'} instead of queueing — expected whenever Studio's own sequential
// page-by-page loop (or a retry of it) briefly overlaps another request, not a real overload.
//
// This can't go through apiRequest: its built-in 429 retry (fetchWithRateLimitRetry) treats every
// 429 as the generic per-minute throttle, retries blind to the `code` field with its own backoff,
// and on giving up discards the body — so `code` and the specific message would already be lost
// by the time control returned here. A plain fetch with its own loop keeps this deterministic:
// retry the same call up to 5 times, ~2s apart, before falling back to the generic 429 copy.
const IMPORT_BUSY_MAX_RETRIES = 5;
const IMPORT_BUSY_WAIT_MS = 2000;

function authHeadersJson(): Record<string, string> {
  const token = localStorage.getItem('stasht_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function postKnowledgeJson(path: string, body: unknown): Promise<{ status: number; data: any }> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: authHeadersJson(), body: JSON.stringify(body) });
  let data: any = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    // leave data null; handled as a generic failure below
  }
  return { status: response.status, data };
}

function knowledgeResultFrom<T>(status: number, data: any): WidgetResult<T> {
  if (status === 429 && data?.code !== 'import_busy') {
    return { ok: false, error: TOO_MANY_REQUESTS, fieldErrors: {} };
  }
  if (status === 403 && data?.code === 'plan_required') {
    requestUpgrade(data.message);
    return { ok: false, error: data.message || 'Upgrade your plan to use this.', fieldErrors: {} };
  }
  if (status < 200 || status >= 300 || !data?.success) {
    return {
      ok: false,
      error: data?.message || data?.error || `Request failed (${status}).`,
      fieldErrors: flattenFieldErrors(data?.errors),
    };
  }
  return { ok: true, data: data.data as T, fieldErrors: {} };
}

async function postKnowledgeWithImportBusyRetry<T>(path: string, body: unknown): Promise<WidgetResult<T>> {
  for (let attempt = 0; ; attempt++) {
    let status: number, data: any;
    try {
      ({ status, data } = await postKnowledgeJson(path, body));
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
    }
    const busy = status === 429 && data?.code === 'import_busy';
    if (busy && attempt < IMPORT_BUSY_MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, IMPORT_BUSY_WAIT_MS));
      continue;
    }
    return knowledgeResultFrom<T>(status, data);
  }
}

// GET /knowledge, files-upload, website/finish and delete all echo {used_chars, limit_chars}
// alongside (or instead of) a `data` source, which run()'s unwrap() would otherwise strip —
// it only ever returns the inner `data` field. This keeps both.
async function runSourceWithUsage(request: Promise<ApiResponse<any>>): Promise<WidgetResult<SourceWithUsage>> {
  try {
    const res = await request;
    if (!res.success) {
      const message = res.error || res.message || 'Request failed. Please try again.';
      return {
        ok: false,
        error: isRateLimitedError(message) ? TOO_MANY_REQUESTS : message,
        fieldErrors: flattenFieldErrors(res.errors),
      };
    }
    const body = res.data as { data?: KnowledgeSource; used_chars?: number; limit_chars?: number } | undefined;
    if (!body || !body.data) {
      return { ok: false, error: 'Request failed. Please try again.', fieldErrors: {} };
    }
    return {
      ok: true,
      data: { source: body.data, used_chars: body.used_chars ?? 0, limit_chars: body.limit_chars ?? KNOWLEDGE_CHAR_LIMIT },
      fieldErrors: {},
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
  }
}

const listPath = (propertyId?: number | null) =>
  propertyId ? `/widgets?property_id=${encodeURIComponent(String(propertyId))}` : '/widgets';

// Multipart upload can't go through apiRequest: it always sets Content-Type: application/json,
// which would stomp the multipart boundary FormData needs. Mirrors performApiRequest's handling
// of plan_required (403) and rate limiting (429) by hand instead.
async function uploadKnowledgeFile(publicId: string, file: File): Promise<WidgetResult<SourceWithUsage>> {
  const token = localStorage.getItem('stasht_token');
  const formData = new FormData();
  formData.append('file', file);

  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(`${API_BASE_URL}/widgets/${encodeURIComponent(publicId)}/knowledge/files`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
  }

  let data: any = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch {
    // leave data null; handled as a generic failure below
  }

  if (response.status === 429) {
    return { ok: false, error: TOO_MANY_REQUESTS, fieldErrors: {} };
  }
  if (response.status === 403 && data?.code === 'plan_required') {
    requestUpgrade(data.message);
    return { ok: false, error: data.message || 'Upgrade your plan to use this.', fieldErrors: {} };
  }
  if (!response.ok || !data?.success) {
    return {
      ok: false,
      error: data?.message || data?.error || `Request failed (${response.status}).`,
      fieldErrors: flattenFieldErrors(data?.errors),
    };
  }
  if (!data.data) {
    return { ok: false, error: 'Request failed. Please try again.', fieldErrors: {} };
  }
  return {
    ok: true,
    data: { source: data.data, used_chars: data.used_chars ?? 0, limit_chars: data.limit_chars ?? KNOWLEDGE_CHAR_LIMIT },
    fieldErrors: {},
  };
}

export const widgetsAPI = {
  // A list must never be stale right after create/delete, so it bypasses apiRequest's short
  // GET cache (writes also clear that cache). propertyId = property view: that property's widgets.
  list: (opts?: { propertyId?: number | null }) =>
    run<ContactWidget[]>(apiRequest(listPath(opts?.propertyId), { method: 'GET', skipCache: true } as RequestInit)),

  // The list plus the dealerships a widget can route leads to (the builder's Team picker).
  listWithTeams: async (opts?: { propertyId?: number | null }): Promise<WidgetResult<{ widgets: ContactWidget[]; teamOptions: WidgetTeamOption[] }>> => {
    try {
      const res = await apiRequest<any>(listPath(opts?.propertyId), { method: 'GET', skipCache: true } as RequestInit);
      if (!res.success) {
        return { ok: false, error: res.error || res.message || 'Request failed. Please try again.', fieldErrors: {} };
      }
      const body: any = res.data;
      const widgets = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      const teamOptions = Array.isArray(body?.team_options) ? body.team_options : [];
      return { ok: true, data: { widgets, teamOptions }, fieldErrors: {} };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.', fieldErrors: {} };
    }
  },

  get: (id: string) =>
    run<ContactWidget>(apiRequest(`/widgets/${encodeURIComponent(id)}`, { method: 'GET', skipCache: true } as RequestInit)),

  create: (input: ContactWidgetInput) =>
    run<ContactWidget>(apiRequest('/widgets', { method: 'POST', body: JSON.stringify(input) })),

  update: (id: string, input: ContactWidgetInput) =>
    run<ContactWidget>(apiRequest(`/widgets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })),

  // Agent avatar: a (pre-cropped) image data URL in, a public https link out (save it as theme.logo_url).
  uploadAvatar: (image: string) =>
    run<{ url: string }>(apiRequest('/widgets/avatar', { method: 'POST', body: JSON.stringify({ image }) })),

  remove: (id: string) =>
    run<unknown>(apiRequest(`/widgets/${encodeURIComponent(id)}`, { method: 'DELETE' })),

  // ── AI knowledge (spec 2026-10-02 §5) ─────────────────────────────────────
  getKnowledge: (publicId: string) =>
    run<KnowledgeData>(apiRequest(`/widgets/${encodeURIComponent(publicId)}/knowledge`, { method: 'GET', skipCache: true } as RequestInit)),

  uploadKnowledgeFile: (publicId: string, file: File) => uploadKnowledgeFile(publicId, file),

  removeKnowledgeSource: (publicId: string, sourceId: number) =>
    run<{ used_chars: number; limit_chars: number }>(
      apiRequest(`/widgets/${encodeURIComponent(publicId)}/knowledge/${sourceId}`, { method: 'DELETE' }),
    ),

  startWebsiteImport: (publicId: string, url: string) =>
    postKnowledgeWithImportBusyRetry<WebsiteStartResult>(`/widgets/${encodeURIComponent(publicId)}/knowledge/website/start`, { url }),

  importWebsitePage: (publicId: string, importId: string, url: string) =>
    postKnowledgeWithImportBusyRetry<WebsitePageResult>(`/widgets/${encodeURIComponent(publicId)}/knowledge/website/page`, {
      import_id: importId,
      url,
    }),

  finishWebsiteImport: (publicId: string, importId: string) =>
    runSourceWithUsage(
      apiRequest(`/widgets/${encodeURIComponent(publicId)}/knowledge/website/finish`, {
        method: 'POST',
        body: JSON.stringify({ import_id: importId }),
      }),
    ),
};
