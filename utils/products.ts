// utils/products.ts — pure helpers for the Products page and editor (plan 2026-11-09-products-m1-m2, Tasks 11–15).
// No React and no requests: tests/products/products.test.mjs runs this file directly.
import type { ProductBadge, ProductDetail, ProductFilters, ProductStatus, ProductsStatus, ProductSummary, StockStatus } from '../services/productsAPI.ts';

export const PAGE_SIZE = 48;
export const UPGRADE_LINE = 'Products are available on the Teams and Business plans.';
export const WEBSITE_READ_ONLY_NOTE = 'This product comes from your website. You can change its status, categories, tags and notes here; everything else updates from your website.';

export const BADGE_LABEL: Record<ProductBadge, string> = { active: 'Active', draft: 'Draft', out_of_stock: 'Out of stock', archived: 'Archived' };
export const BADGE_CLASS: Record<ProductBadge, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  out_of_stock: 'bg-amber-50 text-amber-800 border-amber-200',
  archived: 'bg-slate-100 text-slate-600 border-slate-300',
};

export const WEBSITE_DELETE_HINT = "Products from your website can't be deleted. Archive them instead.";

/** The bulk bar's result line (Chris: messages at the bottom of the card), from POST /products/bulk's answer. */
export function bulkResultMessage(action: 'status' | 'category' | 'delete', r: { updated: number; deleted: number; skipped_ids: number[] }, websiteIds: readonly number[] = []): string {
  const done = action === 'delete' ? `${r.deleted} deleted` : `${r.updated} updated`;
  const skipped = r.skipped_ids.length;
  if (!skipped) return `${done}.`;
  // The API skips ids that aren't the account's own products, and (delete only) website products.
  const website = action === 'delete' && r.skipped_ids.every((id) => websiteIds.includes(id));
  const why = website ? "website products can't be deleted" : "they're no longer available to you";
  return `${done}, ${skipped} skipped (${why}).`;
}

/** A page that came back empty past the last page (after a bulk delete / archive) → the page to load instead, else null. */
export function pageToClampTo(page: number, pagination: { last_page: number }, itemCount: number): number | null {
  if (itemCount > 0 || page <= 1) return null;
  const last = Math.max(1, pagination.last_page || 1);
  return page > last ? last : null;
}

export const sourceLabel = (p: Pick<ProductSummary, 'origin'>): string => (p.origin === 'website' ? 'Website' : 'Manual');

/** The card's price: main line + struck-through compare-at ('' = none). */
export function priceLine(p: Pick<ProductSummary, 'price_label' | 'compare_at_label' | 'price_on_request' | 'show_price'>): { main: string; was: string } {
  if (p.price_on_request) return { main: 'Price on request', was: '' };
  if (!p.show_price) return { main: 'Price hidden', was: '' };
  return { main: p.price_label || '', was: p.price_label ? p.compare_at_label || '' : '' };
}

export function productQueryString(f: ProductFilters): string {
  const q = new URLSearchParams();
  if (f.q && f.q.trim()) q.set('q', f.q.trim());
  if (f.category_id) q.set('category_id', String(f.category_id));
  if (f.status && f.status.length) q.set('status', f.status.join(','));
  if (f.source) q.set('source', f.source);
  if (f.price_min !== undefined && String(f.price_min).trim() !== '') q.set('price_min', String(f.price_min).trim());
  if (f.price_max !== undefined && String(f.price_max).trim() !== '') q.set('price_max', String(f.price_max).trim());
  if (f.in_stock) q.set('in_stock', '1');
  if (f.sort && f.sort !== 'updated') q.set('sort', f.sort);
  q.set('page', String(f.page ?? 1));
  q.set('per_page', String(f.per_page ?? PAGE_SIZE));
  return q.toString();
}

export function productsGate(s: ProductsStatus | null | undefined): 'hidden' | 'upgrade' | 'ready' {
  if (!s || !s.pilot) return 'hidden';
  if (s.available) return 'ready';
  return s.reason === 'plan_required' ? 'upgrade' : 'hidden';
}

/** Website product cards leave the Campaigns grid only while the account's pilot switch is on (NEVER-REMOVE rule). */
export const campaignGridHidesCatalogue = (s: ProductsStatus | null | undefined): boolean => Boolean(s && s.pilot);

/** Sidebar / phone bar: the personal view, and a salesperson's own External view (read-only there). */
export function showsProductsNav(s: ProductsStatus | null | undefined, viewType: string, isOwnExternalView: boolean): boolean {
  return productsGate(s) !== 'hidden' && (viewType !== 'property' || isOwnExternalView);
}

/** Same list as the web API's ProductPresenter::MANUAL_FIELDS (media has its own routes and is never in the JSON body). */
export const MANUAL_FIELDS: readonly string[] = [
  'title', 'short_description', 'description_html', 'brand', 'product_type', 'price', 'compare_at_price', 'currency',
  'price_on_request', 'sku', 'barcode', 'stock_status', 'quantity', 'options', 'variants', 'attributes', 'weight',
  'weight_unit', 'dimensions', 'category_ids', 'tags', 'collections', 'status', 'show_enquire', 'show_price', 'slug',
  'seo_title', 'seo_description', 'share_image', 'buy_url', 'internal_notes',
];

/** null = a new manual product (every field). */
export function editableFor(detail: Pick<ProductDetail, 'editable_fields'> | null): readonly string[] {
  return detail ? detail.editable_fields.filter((f) => f !== 'media') : MANUAL_FIELDS;
}

export interface OptionDraft { name: string; values: string[] }
export interface VariantDraft {
  id?: number;
  options: Record<string, string>;
  sku: string;
  price: string;
  compare_at_price: string;
  stock_status: StockStatus;
  quantity: string;
  image_id: number | null;
}

export function variantCombinations(options: OptionDraft[], cap = 100): Array<Record<string, string>> {
  const usable = options
    .map((o) => ({ name: o.name.trim(), values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))] }))
    .filter((o) => o.name && o.values.length);
  if (!usable.length) return [];
  let combos: Array<Record<string, string>> = [{}];
  for (const o of usable) {
    combos = combos.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v })));
    if (combos.length > cap) return combos.slice(0, cap);
  }
  return combos;
}

const sameOptions = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

export function mergeVariants(existing: VariantDraft[], options: OptionDraft[]): VariantDraft[] {
  return variantCombinations(options).map((combo) => existing.find((v) => sameOptions(v.options, combo))
    ?? { options: combo, sku: '', price: '', compare_at_price: '', stock_status: 'in_stock', quantity: '', image_id: null });
}

export const variantLabel = (options: Record<string, string>): string => Object.values(options).join(' / ');

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface ProductForm {
  title: string; short_description: string; description_html: string; brand: string; product_type: string;
  price: string; compare_at_price: string; currency: string; price_on_request: boolean;
  sku: string; barcode: string; stock_status: StockStatus; quantity: string;
  options: OptionDraft[]; variants: VariantDraft[];
  attributes: Array<{ label: string; value: string }>;
  weight: string; weight_unit: string; dimensions: { length: string; width: string; height: string; unit: string };
  category_ids: number[]; tags: string[]; collections: string[];
  status: ProductStatus; show_enquire: boolean; show_price: boolean;
  slug: string; seo_title: string; seo_description: string; share_image: string; buy_url: string; internal_notes: string;
}

export function emptyProductForm(currency: string): ProductForm {
  return {
    title: '', short_description: '', description_html: '', brand: '', product_type: '',
    price: '', compare_at_price: '', currency: currency || 'CAD', price_on_request: false,
    sku: '', barcode: '', stock_status: 'in_stock', quantity: '',
    options: [], variants: [], attributes: [],
    weight: '', weight_unit: 'kg', dimensions: { length: '', width: '', height: '', unit: 'cm' },
    category_ids: [], tags: [], collections: [],
    status: 'active', show_enquire: true, show_price: true,
    slug: '', seo_title: '', seo_description: '', share_image: '', buy_url: '', internal_notes: '',
  };
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export function formFromDetail(d: ProductDetail): ProductForm {
  return {
    title: str(d.title), short_description: str(d.short_description), description_html: str(d.description_html), brand: str(d.brand), product_type: str(d.product_type),
    price: str(d.price), compare_at_price: str(d.compare_at_price), currency: str(d.currency) || 'CAD', price_on_request: Boolean(d.price_on_request),
    sku: str(d.sku), barcode: str(d.barcode), stock_status: d.stock_status || 'in_stock', quantity: str(d.quantity),
    options: (d.options || []).map((o) => ({ name: o.name, values: [...o.values] })),
    variants: (d.variants || []).map((v) => ({ id: v.id, options: { ...v.options }, sku: str(v.sku), price: str(v.price), compare_at_price: str(v.compare_at_price), stock_status: v.stock_status || 'in_stock', quantity: str(v.quantity), image_id: v.image_id ?? null })),
    attributes: (d.attributes || []).map((a) => ({ label: a.label, value: a.value })),
    weight: str(d.weight), weight_unit: str(d.weight_unit) || 'kg',
    dimensions: { length: str(d.dimensions?.length), width: str(d.dimensions?.width), height: str(d.dimensions?.height), unit: str(d.dimensions?.unit) || 'cm' },
    category_ids: (d.categories || []).map((c) => c.id), tags: [...(d.tags || [])], collections: [...(d.collections || [])],
    status: d.status || 'active', show_enquire: d.show_enquire !== false, show_price: d.show_price !== false,
    slug: str(d.seo?.slug), seo_title: str(d.seo?.title), seo_description: str(d.seo?.description), share_image: str(d.seo?.share_image),
    buy_url: str(d.buy_url), internal_notes: str(d.internal_notes),
  };
}

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s.trim()));
const text = (s: string): string | null => (s.trim() === '' ? null : s.trim());

/** The PATCH/POST body: only the fields the API says this product takes (detail.editable_fields). */
export function payloadFromForm(form: ProductForm, editable: readonly string[]): Record<string, unknown> {
  const all: Record<string, unknown> = {
    title: form.title.trim(),
    short_description: text(form.short_description),
    description_html: form.description_html.trim() === '' ? null : form.description_html,
    brand: text(form.brand),
    product_type: text(form.product_type),
    price: num(form.price),
    compare_at_price: num(form.compare_at_price),
    currency: form.currency.trim() ? form.currency.trim().toUpperCase() : null,
    price_on_request: form.price_on_request,
    sku: text(form.sku),
    barcode: text(form.barcode),
    stock_status: form.stock_status,
    quantity: num(form.quantity),
    options: form.options
      .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
      .filter((o) => o.name && o.values.length),
    variants: form.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      options: v.options,
      sku: text(v.sku),
      price: num(v.price),
      compare_at_price: num(v.compare_at_price),
      stock_status: v.stock_status,
      quantity: num(v.quantity),
      image_id: v.image_id,
    })),
    attributes: form.attributes.filter((a) => a.label.trim() && a.value.trim()).map((a) => ({ label: a.label.trim(), value: a.value.trim() })),
    weight: num(form.weight),
    weight_unit: form.weight ? form.weight_unit || null : null,
    dimensions: { length: num(form.dimensions.length), width: num(form.dimensions.width), height: num(form.dimensions.height), unit: form.dimensions.unit || null },
    category_ids: form.category_ids,
    tags: form.tags,
    collections: form.collections,
    status: form.status,
    show_enquire: form.show_enquire,
    show_price: form.show_price,
    slug: text(form.slug),
    seo_title: text(form.seo_title),
    seo_description: text(form.seo_description),
    share_image: text(form.share_image),
    buy_url: text(form.buy_url),
    internal_notes: text(form.internal_notes),
  };
  return Object.fromEntries(Object.entries(all).filter(([key]) => editable.includes(key)));
}

/** Same sentences as the API (ProductRules / ProductWriter), shown under each field. */
export function validateProductForm(form: ProductForm, editable: readonly string[]): Record<string, string> {
  const e: Record<string, string> = {};
  const can = (k: string) => editable.includes(k);
  if (can('title') && !form.title.trim()) e.title = 'Give the product a title.';
  for (const k of ['price', 'compare_at_price', 'weight'] as const) {
    if (can(k) && form[k].trim() && !(Number(form[k]) >= 0)) e[k] = 'Enter a number, like 49.99.';
  }
  if (can('quantity') && form.quantity.trim() && !/^\d+$/.test(form.quantity.trim())) e.quantity = 'Enter a whole number.';
  if (can('compare_at_price') && !e.price && !e.compare_at_price && form.price.trim() && form.compare_at_price.trim()
    && Number(form.compare_at_price) <= Number(form.price)) e.compare_at_price = 'The compare-at price should be higher than the price.';
  if (can('slug') && form.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) e.slug = 'Use lower-case letters, numbers and dashes only.';
  for (const k of ['buy_url', 'share_image'] as const) {
    if (can(k) && form[k].trim() && !/^https?:\/\/\S+$/i.test(form[k].trim())) e[k] = 'Use a web address starting with https://';
  }
  if (can('currency') && form.currency.trim() && !/^[A-Za-z]{3}$/.test(form.currency.trim())) e.currency = 'Use a three-letter currency code, like CAD.';
  // Variant rows, keyed like the API's errors (variants.N.price …) so each shows under its own field.
  if (can('variants')) {
    form.variants.forEach((v, i) => {
      for (const k of ['price', 'compare_at_price'] as const) {
        if (v[k].trim() && !(Number(v[k]) >= 0)) e[`variants.${i}.${k}`] = 'Enter a number, like 49.99.';
      }
      if (v.quantity.trim() && !/^\d+$/.test(v.quantity.trim())) e[`variants.${i}.quantity`] = 'Enter a whole number.';
      if (!e[`variants.${i}.price`] && !e[`variants.${i}.compare_at_price`] && v.price.trim() && v.compare_at_price.trim()
        && Number(v.compare_at_price) <= Number(v.price)) e[`variants.${i}.compare_at_price`] = 'The compare-at price should be higher than the price.';
    });
  }
  return e;
}

/** Laravel's {field: [messages]} → {field: first message}. */
export function fieldErrorsFrom(errors: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors || typeof errors !== 'object') return out;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first) out[key] = first;
  }
  return out;
}

export function slugFromTitle(title: string): string {
  return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 110).replace(/-+$/g, '');
}
