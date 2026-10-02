import { apiRequest } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';

// Website Catalogue API (web API /api/react, spec 2026-09-30 §8.3 / §9).
// GET /website-catalogue answers every account; the items routes and Refresh are Business plan +
// pilot only, and apiRequest opens the upgrade modal on any 403 plan_required — so callers ask
// getStatus() first and touch the gated routes only when it says the catalogue is available
// (loadCatalogueForBrowsing does exactly that). The campaign status check is not gated.

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

export interface CatalogueResult<T> {
  ok: boolean;
  data?: T;
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
    if (!res.success) return { ok: false, error: res.error || res.message || 'Request failed. Please try again.' };
    return { ok: true, data: unwrap<T>(res.data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.' };
  }
}

const memoryPath = (memoryId: string | number) => `/memories/${encodeURIComponent(String(memoryId))}`;

export const catalogueAPI = {
  getStatus: () => run<CatalogueStatus>(apiRequest('/website-catalogue', { method: 'GET' })),

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
