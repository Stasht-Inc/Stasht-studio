import { apiRequest } from '../utils/authUtils';
import type { CatalogueItemDetail, CatalogueItemSummary, CatalogueItemsPage } from './catalogueAPI';

// Shopify products, served by the web API in exactly the Website Catalogue's item shape (ticket
// wdy2xh1320), so the catalogue's browser, product cards, product page and pickers show them unchanged.
// GET /integrations/shopify/status answers every account; /shopify/items is paid-only, and apiRequest
// opens the upgrade modal on its 403 — so callers check `available` first (loadShopifyForBrowsing does).

export interface ShopifyStatus {
  connected: boolean;
  available: boolean; // connected and on a paid plan: the items routes may be called
  shop_domain: string | null;
  connected_at: string | null;
  item_count: number; // active products Stasht holds
  last_synced_at: string | null; // when the store was last read in full (nightly, Sync now, or on connect)
}

export interface ShopifySyncResult {
  added: number;
  updated: number;
  total: number;
}

// The product page marker, like `catalog_item:<id>` (MemoryDetailsPage, MemoriesPage cards, the sidebar box).
export const SHOPIFY_PRODUCT_MARKER = 'shopify_product:';
// Products per page (the route's max) and the browse cap: 10 × 500.
const PAGE_SIZE = 500;
const MAX_BROWSE_PAGES = 10;

export interface ShopifyResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Server bodies are {success, data}; apiRequest wraps a successful body as {success: true, data: <body>}.
function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T | undefined;
}

async function run<T>(request: Promise<any>, unwrapData = true): Promise<ShopifyResult<T>> {
  try {
    const res = await request;
    if (!res?.success) return { ok: false, error: res?.message || res?.error || 'Request failed. Please try again.' };
    return { ok: true, data: unwrapData ? unwrap<T>(res.data) : (res.data as T) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed. Please try again.' };
  }
}

export const shopifyItemsAPI = {
  // Not wrapped in {data}: the status body is the object itself.
  getStatus: (fresh = false) =>
    run<ShopifyStatus>(apiRequest('/integrations/shopify/status', { method: 'GET', ...(fresh ? { skipCache: true } : {}) } as RequestInit), false),

  getItems: (params: { q?: string; category?: string; page?: number; perPage?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category) qs.set('category', params.category);
    qs.set('page', String(params.page ?? 1));
    qs.set('per_page', String(params.perPage ?? PAGE_SIZE));
    return run<CatalogueItemsPage>(apiRequest(`/shopify/items?${qs.toString()}`, { method: 'GET' }));
  },

  getItem: (id: number) =>
    run<CatalogueItemDetail>(apiRequest(`/shopify/items/${encodeURIComponent(String(id))}`, { method: 'GET' })),

  // "Sync now": re-reads the whole store (also adds new products and removes deleted ones). Not unwrapped.
  syncNow: () => run<ShopifySyncResult>(apiRequest('/shopify/sync', { method: 'POST', noRateLimitRetry: true } as RequestInit), false),
};

// Every active product of the connected store, or [] when the account can't browse Shopify (not connected,
// free plan), has no products, or the first page fails. Same contract as loadCatalogueForBrowsing: pages are
// fetched one after another; a later page failing returns what was loaded. Never throws.
export async function loadShopifyForBrowsing(): Promise<CatalogueItemSummary[]> {
  const items: CatalogueItemSummary[] = [];
  try {
    const status = await shopifyItemsAPI.getStatus();
    if (!status.ok || !status.data?.available || !status.data.item_count) return [];
    for (let page = 1; page <= MAX_BROWSE_PAGES; page += 1) {
      const res = await shopifyItemsAPI.getItems({ page, perPage: PAGE_SIZE });
      if (!res.ok || !Array.isArray(res.data?.items)) break;
      items.push(...res.data!.items);
      const lastPage = Number(res.data!.pagination?.last_page) || 1;
      if (page >= lastPage || res.data!.items.length === 0) break;
    }
    return items;
  } catch {
    return items;
  }
}
