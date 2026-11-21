// services/productsAPI.ts — Products (web API /api/react, plan 2026-11-09-products-m1-m2 in the web API repo).
// GET /products/status answers every account. Every other route is pilot switch + any paid plan, and apiRequest opens
// the upgrade modal on a 403 plan_required, so callers check useProductsStatus() first (productsGate === 'ready').
import { apiRequest, postFormData } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';
import { requestUpgrade } from '../utils/planEvents';
import { collectPickerPages, fieldErrorsFrom, leadShareManualItems, PICKER_FILTERS, productQueryString, productsGate, productsNavItems } from '../utils/products';
import { loadCatalogueForBrowsing, type CatalogueItemSummary } from './catalogueAPI';

export type ProductBadge = 'active' | 'draft' | 'out_of_stock' | 'archived';
export type ProductStatus = 'draft' | 'active' | 'archived';
export type StockStatus = 'in_stock' | 'out_of_stock';
export type ProductSort = 'updated' | 'newest' | 'title' | 'price_asc' | 'price_desc';

export interface ProductsStatus {
  pilot: boolean; // the account's pilot switch is on (Campaigns no longer shows website product cards)
  available: boolean;
  reason: 'not_available' | 'plan_required' | null;
  can_create: boolean; // false in a salesperson's External view
  counts: { total: number; manual: number; website: number; shopify?: number };
  default_currency: string;
  /** Chris 21 Nov 2026 (R2-2): the account's product button colour — color = what buttons use (its "Button colour",
   *  else the brand colour), text = the words on it, setting = the chosen one (null = brand), brand = the brand colour.
   *  Missing on an older web API: Studio purple. */
  button_color?: ProductButtonColorInfo;
}

export interface ProductButtonColorInfo { color: string; text: string; setting: string | null; brand: string }

export interface ProductCategoryRef { id: number; name: string; hidden?: boolean } // hidden: sent only when true (Show / Hide)

export interface ProductSummary {
  id: number;
  user_id: number;
  read_only: boolean;
  owner?: { id: number; name: string | null; profile_image: string | null; profile_color: string | null };
  origin: 'website' | 'manual' | 'shopify'; // shopify: copied from the connected Shopify store, read-only like website
  status: ProductStatus;
  stock_status: StockStatus;
  badge: ProductBadge;
  title: string;
  price: string | null;
  compare_at_price: string | null;
  currency: string | null;
  price_label: string;
  compare_at_label: string;
  price_on_request: boolean;
  show_price: boolean;
  main_image: string | null;
  /** Remove cover (Chris 20 Nov 2026, I10): the brand shows as the cover; the photos stay. Absent on an older web API. */
  cover_removed?: boolean;
  /** Chris 21 Nov 2026 (P11): the intro video when it is the product's cover (first media item); cards show its first
   *  frame, as campaign cards show an intro-video cover. null / absent (older web API) = main_image is the cover. */
  cover_video?: string | null;
  images_count: number;
  category: string | null;
  categories: ProductCategoryRef[];
  sku: string | null;
  brand: string | null;
  url: string | null; // website products: the product's page on the business's website
  updated_at: string | null;
}

export interface ProductVariant {
  id: number;
  title: string | null;
  options: Record<string, string>;
  sku: string | null;
  barcode: string | null;
  price: string | null;
  compare_at_price: string | null;
  price_label: string;
  stock_status: StockStatus;
  quantity: number | null;
  image_id: number | null;
  sort_order: number;
}

export interface ProductMediaItem { id: number; url: string; type: 'photo' | 'video'; sort_order: number }

export interface ProductDetail extends ProductSummary {
  short_description: string | null;
  description: string | null;
  description_html: string | null;
  product_type: string | null;
  barcode: string | null;
  quantity: number | null;
  availability: 'available' | 'retired';
  options: Array<{ name: string; values: string[] }>;
  variants: ProductVariant[];
  attributes: Array<{ label: string; value: string }>;
  weight: string | null;
  weight_unit: string | null;
  dimensions: { length?: number; width?: number; height?: number; unit?: string } | null;
  tags: string[];
  collections: string[];
  seo: { slug: string | null; title: string | null; description: string | null; share_image: string | null };
  buy_url: string | null;
  // Chris 20 Nov 2026: the buy link's button words. buy_label = what the owner typed (null = none); buy_button = what the
  // button says ("Buy now" when none). Both missing on an older web API: "Buy now".
  buy_label?: string | null;
  buy_button?: string;
  show_enquire: boolean;
  // Chris 21 Nov 2026 (R2-2): the product's buttons' colour. button_color = its own (null = "Use brand colour"),
  // button_style = what its buttons show, brand_button_color = the account's colour. Missing on an older web API.
  button_color?: string | null;
  button_style?: { background: string; text: string };
  brand_button_color?: string;
  // Chris 17 Nov 2026: "Show photos" off hides the photo area on the details page. can_hide_photos: the switch is
  // offered (the web API has the column). Both missing on an older web API: photos show, no switch.
  show_photos?: boolean;
  can_hide_photos?: boolean;
  media: ProductMediaItem[];
  editable_fields: string[];
  internal_notes?: string | null;
}

export interface ProductsPage {
  items: ProductSummary[];
  pagination: { current_page: number; per_page: number; total: number; last_page: number };
}

export interface ProductCategory { id: number; name: string; from_website: boolean; from_shopify?: boolean; product_count: number; read_only: boolean; hidden?: boolean }

export interface ProductFilters {
  q?: string;
  category_id?: number | null;
  status?: ProductBadge[];
  source?: 'website' | 'manual' | 'shopify' | '';
  price_min?: string;
  price_max?: string;
  in_stock?: boolean;
  sort?: ProductSort;
  page?: number;
  per_page?: number;
}

export interface ProductResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string; // not_available, plan_required, read_only, imported_read_only, website_category
  status?: number; // the HTTP status of a refusal (absent for a network error): 404 = an API without Products
  fieldErrors?: Record<string, string>;
  fields?: string[];
}

const GENERIC = 'Something went wrong. Please try again.';

function unwrap<T>(body: unknown): T | undefined {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in (body as object)) return (body as { data: T }).data;
  return body as T | undefined;
}

async function run<T>(request: Promise<ApiResponse<any>>): Promise<ProductResult<T>> {
  try {
    const res = await request;
    if (!res.success) {
      const raw = res as any;
      return {
        ok: false,
        error: res.message || res.error || GENERIC,
        code: typeof raw.code === 'string' ? raw.code : undefined,
        status: typeof raw.statusCode === 'number' ? raw.statusCode : undefined,
        fieldErrors: fieldErrorsFrom(res.errors),
        fields: Array.isArray(raw.fields) ? raw.fields : undefined,
      };
    }
    return { ok: true, data: unwrap<T>(res.data) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : GENERIC };
  }
}

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

// Multipart can't go through apiRequest (it forces JSON); postFormData shares its session handling.
async function uploadMedia(id: number, file: File): Promise<ProductResult<ProductDetail>> {
  const form = new FormData();
  form.append('file', file);
  let response: Response | null;
  try {
    // Never retried on a network error: the first attempt may have stored the file (Task 16, T11 review minor).
    response = await postFormData(`/products/${encodeURIComponent(String(id))}/media`, form, { networkRetries: 0 });
  } catch {
    return { ok: false, error: 'The file could not be uploaded. Check your connection and try again.' };
  }
  if (!response) return { ok: false, error: 'Your session has expired. Please log in again.' };
  let body: any = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (response.ok && body?.success) return { ok: true, data: body.data as ProductDetail };
  if (response.status === 403 && body?.code === 'plan_required') requestUpgrade(body?.message);
  const fieldErrors = fieldErrorsFrom(body?.errors);
  return { ok: false, error: fieldErrors.file || body?.message || 'The file could not be uploaded. Please try again.', code: body?.code, fieldErrors };
}

const path = (id: number) => `/products/${encodeURIComponent(String(id))}`;

export const productsAPI = {
  getStatus: (fresh = false) => run<ProductsStatus>(apiRequest('/products/status', { method: 'GET', ...(fresh ? { skipCache: true } : {}) } as RequestInit)),
  list: (filters: ProductFilters) => run<ProductsPage>(apiRequest(`/products?${productQueryString(filters)}`, { method: 'GET', skipCache: true } as RequestInit)),
  get: (id: number) => run<ProductDetail>(apiRequest(path(id), { method: 'GET', skipCache: true } as RequestInit)),
  create: (payload: Record<string, unknown>) => run<ProductDetail>(apiRequest('/products', json('POST', payload))),
  update: (id: number, payload: Record<string, unknown>) => run<ProductDetail>(apiRequest(path(id), json('PATCH', payload))),
  remove: (id: number) => run<{ deleted: boolean }>(apiRequest(path(id), json('DELETE'))),
  duplicate: (id: number) => run<ProductDetail>(apiRequest(`${path(id)}/duplicate`, json('POST', {}))),
  bulk: (body: { ids: number[]; action: 'status' | 'category' | 'delete'; status?: ProductStatus; category_id?: number; mode?: 'add' | 'replace' }) =>
    run<{ updated: number; deleted: number; skipped_ids: number[] }>(apiRequest('/products/bulk', json('POST', body))),
  uploadMedia,
  orderMedia: (id: number, ids: number[]) => run<ProductDetail>(apiRequest(`${path(id)}/media/order`, json('PUT', { ids }))),
  /** Remove cover (I10): DELETE /products/{id}/cover — every photo / video stays; the product shows the brand. */
  removeCover: (id: number) => run<ProductDetail>(apiRequest(`${path(id)}/cover`, json('DELETE'))),
  removeMedia: (id: number, mediaId: number) => run<ProductDetail>(apiRequest(`${path(id)}/media/${encodeURIComponent(String(mediaId))}`, json('DELETE'))),
  // can_hide: the API has product_categories.hidden (Show / Hide, 16 Nov); absent / false = no Show / Hide control.
  categories: () => run<{ categories: ProductCategory[]; total: number; can_hide?: boolean }>(apiRequest('/product-categories', { method: 'GET', skipCache: true } as RequestInit)),
  createCategory: (name: string) => run<{ category: ProductCategory }>(apiRequest('/product-categories', json('POST', { name }))),
  renameCategory: (id: number, name: string) => run<{ category: ProductCategory }>(apiRequest(`/product-categories/${id}`, json('PATCH', { name }))),
  setCategoryHidden: (id: number, hidden: boolean) => run<{ category: ProductCategory }>(apiRequest(`/product-categories/${id}`, json('PATCH', { hidden }))),
  deleteCategory: (id: number) => run<{ deleted: boolean }>(apiRequest(`/product-categories/${id}`, json('DELETE'))),
  /** The account's "Button colour" (Chris 21 Nov 2026, R2-2); null = the brand colour again. */
  setButtonColor: (color: string | null) => run<ProductButtonColorInfo>(apiRequest('/products/button-color', json('PUT', { color }))),
};

/** Add a Moment's Products tab: every product selectItems takes (PICKER_FILTERS), page by page. `complete` is false
 *  when a page failed or there were more pages than the cap (the list is then partial: don't reuse it). */
export async function loadProductsForPicker(): Promise<{ items: ProductSummary[]; complete: boolean }> {
  return collectPickerPages(async (page) => {
    const res = await productsAPI.list({ ...PICKER_FILTERS, page });
    return res.ok && res.data ? { items: res.data.items, last_page: res.data.pagination?.last_page || 1 } : null;
  });
}

/** Leads "+ Products" (16 Nov 2026 F1): the account's active manual products with a photo, as the picker lists them.
 *  Website products still come from the Website Catalogue, exactly as before. [] when Products can't be listed. */
export async function loadManualProductsForLeadShare(): Promise<ReturnType<typeof leadShareManualItems>> {
  try {
    const { items } = await collectPickerPages(async (page) => {
      const res = await productsAPI.list({ ...PICKER_FILTERS, source: 'manual', page });
      return res.ok && res.data ? { items: res.data.items, last_page: res.data.pagination?.last_page || 1 } : null;
    });
    return leadShareManualItems(items);
  } catch {
    return [];
  }
}

/**
 * The Campaigns sidebar's Products box (Chris 16 Nov 2026 point 6). With Products: every product the Add a Moment picker
 * lists — manual and website, not Shopify (its own box) — grouped like the catalogue's items. Each opens the same
 * `catalog_item:<id>` page (GET /website-catalogue/items/{id} answers manual products too). Without Products: exactly
 * today's Website Catalogue list. Never throws.
 */
export async function loadProductsNavItems(): Promise<CatalogueItemSummary[]> {
  try {
    const status = await productsAPI.getStatus();
    if (status.ok && productsGate(status.data) === 'ready') {
      const { items, complete } = await collectPickerPages(async (page) => {
        const res = await productsAPI.list({ ...PICKER_FILTERS, page });
        return res.ok && res.data ? { items: res.data.items, last_page: res.data.pagination?.last_page || 1 } : null;
      });
      if (items.length > 0 || complete) return productsNavItems(items);
    }
  } catch {
    // fall through to the Website Catalogue, as before Products
  }
  return loadCatalogueForBrowsing();
}
