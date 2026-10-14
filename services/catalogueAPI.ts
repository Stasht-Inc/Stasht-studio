import { apiRequest } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';

// Website Catalogue API (web API /api/react, spec 2026-09-30 §8.3 / §9).
// GET /website-catalogue answers every account. Every other catalogue route is Business plan +
// pilot only, and apiRequest opens the upgrade modal on any 403 plan_required. So callers ask
// getStatus()/getOverview() first and touch the gated routes only when it says the catalogue is
// available (loadCatalogueForBrowsing does exactly that). The campaign status check is not gated.
// Connect-flow writes pass noRateLimitRetry: a 429 from them is a business answer ("5 checks an
// hour"), not a burst to retry, and the server's sentence arrives in `message`.

export type CatalogueUnavailableReason = 'not_available' | 'plan_required';

export interface CatalogueStatus {
  available: boolean;
  reason: CatalogueUnavailableReason | null;
  item_count: number;
}

export interface CatalogueItemSummary {
  id: number;
  title: string;
  price: string | null;
  currency: string | null;
  price_label: string; // "$1,299 CAD", '' when there is no price
  category: string | null; // the website's own category name
  url: string | null;
  main_image: string | null;
  images_count: number;
}

export interface CatalogueItemDetail extends CatalogueItemSummary {
  description: string | null;
  sku: string | null;
  brand: string | null;
  availability: 'available' | 'retired';
  attributes: Array<{ label: string; value: string }>;
  images: Array<{ id: number; url: string; sort_order: number }>;
}

export interface CatalogueItemsPage {
  items: CatalogueItemSummary[];
  pagination: { current_page: number; per_page: number; total: number; last_page: number };
}

// For a campaign's Refresh banner: how many linked items changed or left the website.
export interface CampaignCatalogueStatus {
  linked: number;
  changed: number;
  retired: number;
  can_refresh: boolean;
}

export interface CatalogueRefreshResult {
  refreshed: number;
  retired: number;
  unchanged: number;
  skipped_deleted: number;
}

// ── Connect flow (sub-project 3). Shapes mirror stasht-database App\Services\Catalog\CatalogPresenter. ──

export interface CatalogueDomain {
  id: number;
  host: string;
  status: 'pending' | 'verified' | 'lost';
  method: 'widget' | 'meta' | 'dns' | 'admin' | null;
  token: string;
  has_widget: boolean;
  meta_tag: string; // <meta name="stasht-site-verification" content="…">
  dns_name: string;
  dns_value: string; // stasht-site-verification=…
  verified_at: string | null;
  missing_since: string | null;
  pauses_on: string | null;
}

export type CatalogueScanStatus =
  | 'pending' | 'verifying' | 'running'
  | 'ready' | 'unverified' | 'blocked' | 'unsupported' | 'failed' | 'expired';

export interface CatalogueVerificationCheck {
  method: 'widget' | 'meta' | 'dns';
  label: string;
  looked_for: string;
  where: string;
  found: boolean;
  checked: boolean; // false: we couldn't look (page unreachable, DNS lookup failed)
  in_body: boolean; // the meta tag was found, but in <body>, where it doesn't count
  note: string | null; // the one fixed "couldn't load your homepage over https" sentence, else null
}

export interface CatalogueBlockedHelp {
  ip: string;
  user_agent: string;
  url: string;
  it_note: string;
}

export interface CataloguePreviewItem {
  title: string;
  price_label: string;
  image_url: string | null; // the website's own photo; nothing is copied before Connect
  url: string | null;
  category: string | null;
}

export interface CatalogueScanOutcome {
  // A fixed code: ready, blocked, expired, unknown (a reason the server has no copy for), or the engine's
  // unverified / unsupported / failed reason (not_found, claimed, redirected, unreachable, no_domain, javascript,
  // no_items, no_recipe, ai_budget, robots, busy, invalid_url, unsafe_url, interrupted, ai_error, error).
  reason: string;
  message: string; // our own sentence; '' when ready
  can_check_again: boolean; // re-check the same scan (unverified / blocked)
  can_try_again: boolean; // start a new scan of the same address (failed)
  can_start_over: boolean; // back to the address step (redirected, expired, unknown, invalid / unsafe address, …)
  checks: CatalogueVerificationCheck[];
  blocked: CatalogueBlockedHelp | null;
  redirect_host: string | null;
  preview: CataloguePreviewItem[];
  estimated_items: number | null;
  estimated_items_is_minimum: boolean;
  item_limit: number;
  over_limit: boolean;
  site_kind: 'retail' | 'vehicles' | 'property' | 'other' | null;
}

export interface CatalogueScan {
  id: number;
  url: string;
  host: string;
  status: CatalogueScanStatus;
  in_progress: boolean;
  progress_step: 'verifying' | 'checking' | 'discovering' | 'learning' | 'preview' | null;
  step_label: string | null;
  created_at: string | null;
  expires_at: string | null;
  outcome: CatalogueScanOutcome | null; // null while in progress
  domain: CatalogueDomain | null;
  rendering?: boolean; // true: website needs a browser to read; takes up to 10 minutes
}

export type CatalogueSourceStatus = 'active' | 'paused' | 'blocked' | 'needs_attention' | 'unverified' | 'plan_required';

export interface CatalogueSource {
  id: number;
  url: string;
  host: string;
  status: CatalogueSourceStatus;
  status_reason: string | null;
  message: string | null; // our own sentence for a paused / attention state
  warning: string | null; // the 7-day "verification code missing" warning
  item_count: number;
  last_sync_at: string | null;
  last_success_at: string | null;
  connected_at: string | null;
  // true: a sync is queued for the engine. After Resume or Connect it can be false when the account's
  // once-per-15-minutes allowance was in use: the website is back, and sync_now_available_in says when Sync now opens.
  sync_requested: boolean;
  sync_now_available_in: number; // seconds until Sync now is allowed again
  can_sync_now: boolean;
  can_pause: boolean;
  can_resume: boolean;
  blocked: CatalogueBlockedHelp | null;
  domain: CatalogueDomain | null;
}

// GET /website-catalogue: SP1's status plus the connected website (null until one is connected or
// after a Disconnect) and the latest unexpired scan (Business accounts without a website only).
export interface CatalogueOverview extends CatalogueStatus {
  source: CatalogueSource | null;
  scan: CatalogueScan | null;
  limits: { item_limit: number; sync_now_minutes: number };
}

export interface CatalogueResult<T> {
  ok: boolean;
  data?: T;
  // The server's refusal code. 409: already_connected, claimed, invalid_state, scan_expired, scan_not_ready,
  // not_verified, paused_by_support. 422: invalid_url. 429: rate_limited. 404: not_found, not_connected.
  // 403: not_available.
  code?: string;
  error?: string;
}

// Items per website are capped at 500 (spec §10), so one page of 500 is the whole catalogue.
export const CATALOGUE_PAGE_SIZE = 500;

// Server bodies are {success, data}; apiRequest wraps a successful body as {success: true, data: <body>}.
function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T | undefined;
}

async function run<T>(request: Promise<ApiResponse<any>>): Promise<CatalogueResult<T>> {
  try {
    const res = await request;
    if (!res.success) {
      // apiRequest spreads the server's body into a failure, so `code` is there for 409 / 422 / 429. After a final
      // 429 it puts a generic sentence in `error` and the server's own in `message`, so `message` goes first.
      const code = (res as { code?: unknown }).code;
      return {
        ok: false,
        error: res.message || res.error || 'Request failed. Please try again.',
        code: typeof code === 'string' ? code : undefined,
      };
    }
    return { ok: true, data: unwrap<T>(res.data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.' };
  }
}

const memoryPath = (memoryId: string | number) => `/memories/${encodeURIComponent(String(memoryId))}`;
const scanPath = (scanId: number) => `/website-catalogue/scans/${encodeURIComponent(String(scanId))}`;

// A connect-flow write: never retried on 429 (see the note at the top).
function post<T>(path: string, body?: Record<string, unknown>): Promise<CatalogueResult<T>> {
  return run<T>(apiRequest(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}), noRateLimitRetry: true } as RequestInit));
}

export const catalogueAPI = {
  // Cached briefly by apiRequest: the sidebar browser and the Connectors badge read it.
  getStatus: () => run<CatalogueOverview>(apiRequest('/website-catalogue', { method: 'GET' })),

  // Always fresh: the Connectors card.
  getOverview: () => run<CatalogueOverview>(apiRequest('/website-catalogue', { method: 'GET', skipCache: true } as RequestInit)),

  getItems: (params: { q?: string; category?: string; page?: number; perPage?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    qs.set('page', String(params.page ?? 1));
    qs.set('per_page', String(params.perPage ?? CATALOGUE_PAGE_SIZE));
    return run<CatalogueItemsPage>(apiRequest(`/website-catalogue/items?${qs.toString()}`, { method: 'GET' }));
  },

  getItem: (id: number) =>
    run<CatalogueItemDetail>(apiRequest(`/website-catalogue/items/${encodeURIComponent(String(id))}`, { method: 'GET' })),

  // Always fresh: the banner must reflect a Refresh (or a sync) straight away.
  getCampaignStatus: (memoryId: string | number) =>
    run<CampaignCatalogueStatus>(apiRequest(`${memoryPath(memoryId)}/catalogue-status`, { method: 'GET', skipCache: true } as RequestInit)),

  refreshCampaign: (memoryId: string | number) =>
    run<CatalogueRefreshResult>(apiRequest(`${memoryPath(memoryId)}/refresh-from-catalogue`, { method: 'POST' })),

  // Connect modal, step 1: the website's ownership record (token, and whether the widget method is offered).
  registerDomain: (url: string) => post<{ url: string; domain: CatalogueDomain }>('/website-catalogue/domains', { url }),

  // Step 2 → 3. `authorized` is the "I own this website or am authorised to import its catalogue" tick of step 1.
  startScan: (url: string) => post<{ scan: CatalogueScan }>('/website-catalogue/scans', { url, authorized: true }),

  // Step 3: polled every 3 s, always fresh.
  getScan: (scanId: number) => run<{ scan: CatalogueScan }>(apiRequest(scanPath(scanId), { method: 'GET', skipCache: true } as RequestInit)),

  checkAgain: (scanId: number) => post<{ scan: CatalogueScan }>(`${scanPath(scanId)}/check-again`),

  connect: (scanId: number) => post<CatalogueOverview>('/website-catalogue/connect', { scan_id: scanId }),
  syncNow: () => post<CatalogueOverview>('/website-catalogue/sync-now'),
  pause: () => post<CatalogueOverview>('/website-catalogue/pause'),
  resume: () => post<CatalogueOverview>('/website-catalogue/resume'),
  disconnect: () => post<CatalogueOverview>('/website-catalogue/disconnect'),
};

// Every available item of the account's Website Catalogue, or [] when the account can't use it,
// has no items, or anything fails. Never throws.
export async function loadCatalogueForBrowsing(): Promise<CatalogueItemSummary[]> {
  try {
    const status = await catalogueAPI.getStatus();
    if (!status.ok || !status.data?.available || !status.data.item_count) return [];
    const page = await catalogueAPI.getItems();
    return page.ok && Array.isArray(page.data?.items) ? page.data!.items : [];
  } catch {
    return [];
  }
}
