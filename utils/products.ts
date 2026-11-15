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

/**
 * Add a Moment's Products tab with Products on: every product the API's selectItems takes — website items as the
 * catalogue lists them today (in stock or not) and active manual ones. The badge `active` alone means "active and not
 * out of stock" (ProductQuery::whereBadge), so out-of-stock products need their own badge (final review I1).
 */
export const PICKER_FILTERS: ProductFilters = { status: ['active', 'out_of_stock'], sort: 'title', per_page: 200 };
export const PICKER_MAX_PAGES = 15;

/** Pages 1..last_page (at most maxPages). `complete` is false when a page failed or the cap cut the list short. */
export async function collectPickerPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; last_page: number } | null>, maxPages = PICKER_MAX_PAGES,
): Promise<{ items: T[]; complete: boolean }> {
  const items: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetchPage(page).catch(() => null);
    if (!res) return { items, complete: false };
    items.push(...res.items);
    if (page >= (res.last_page || 1)) return { items, complete: true };
  }
  return { items, complete: false }; // more pages than the cap: a partial list
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

/** key: the name the variant rows use for this option while its name is being retyped (renameOption); absent = name. */
export interface OptionDraft { name: string; values: string[]; key?: string }
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

/** The name the variant rows use for an option: its key while one is set (a cleared or clashing name), else its name. */
const optionKey = (o: OptionDraft): string => (o.key ?? o.name).trim();

export function variantCombinations(options: OptionDraft[], cap = 100): Array<Record<string, string>> {
  const usable = options
    .map((o) => ({ name: optionKey(o), values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))] }))
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

/** Every option of `small` is in `big` with the same value, and `big` has more options. */
const extends_ = (big: Record<string, string>, small: Record<string, string>): boolean => {
  const keys = Object.keys(small);
  return keys.length > 0 && keys.length < Object.keys(big).length && keys.every((k) => big[k] === small[k]);
};

/** One row per combination. A combination keeps its own row; after an option is REMOVED it takes the first old row it
 *  was part of (that row's id, price, SKU, stock …); after an option is ADDED every combination extending an old row
 *  copies that row, and only the first copy keeps the row's id (the others are new variants). Final review I2. */
export function mergeVariants(existing: VariantDraft[], options: OptionDraft[]): VariantDraft[] {
  const taken = new Set<VariantDraft>(); // old rows whose id a combination already holds
  return variantCombinations(options).map((combo): VariantDraft => {
    const same = existing.find((v) => sameOptions(v.options, combo));
    if (same) { taken.add(same); return same; }
    const wider = existing.find((v) => !taken.has(v) && extends_(v.options, combo)); // an option was removed
    if (wider) { taken.add(wider); return { ...wider, options: combo }; }
    const narrower = existing.find((v) => extends_(combo, v.options)); // an option was added
    if (narrower) {
      if (!taken.has(narrower)) { taken.add(narrower); return { ...narrower, options: combo }; }
      const { id: _id, ...copy } = narrower;
      return { ...copy, options: combo };
    }
    return { options: combo, sku: '', price: '', compare_at_price: '', stock_status: 'in_stock', quantity: '', image_id: null };
  });
}

/** Option i gets a new name: the variant rows keep everything (ids, prices, SKUs, stock, photos) under the new name.
 *  While the name is empty, or the same as another option's, the rows keep the name they had (o.key). */
export function renameOption(options: OptionDraft[], variants: VariantDraft[], i: number, name: string): { options: OptionDraft[]; variants: VariantDraft[] } {
  const prev = optionKey(options[i]);
  const next = name.trim();
  const clash = options.some((o, j) => j !== i && optionKey(o).toLowerCase() === next.toLowerCase());
  const usable = next !== '' && !clash && next !== prev;
  const key = usable || next === prev ? next : prev;
  // key only while it differs from the name, so typing a name back to what it was leaves the form unchanged.
  const nextOptions = options.map((o, j) => (j === i ? { name, values: o.values, ...(key !== next ? { key } : {}) } : o));
  if (!usable) return { options: nextOptions, variants };
  const renamed = variants.map((v) => (prev in v.options
    ? { ...v, options: Object.fromEntries(Object.entries(v.options).map(([k, val]) => [k === prev ? next : k, val])) }
    : v));
  return { options: nextOptions, variants: mergeVariants(renamed, nextOptions) };
}

/** After any options change: every option still holding an old key tries its visible name again, so a clash that has
 *  cleared re-keys its rows and no stale key is left. Settles in at most one pass per option. */
export function settleOptions(options: OptionDraft[], variants: VariantDraft[]): { options: OptionDraft[]; variants: VariantDraft[] } {
  let state = { options, variants };
  for (let pass = 0; pass < options.length; pass += 1) {
    let changed = false;
    state.options.forEach((o, j) => {
      if (o.key === undefined) return;
      const next = renameOption(state.options, state.variants, j, state.options[j].name);
      if (optionKey(next.options[j]) !== optionKey(state.options[j]) || next.options[j].key !== state.options[j].key) changed = true;
      state = next;
    });
    if (!changed) break;
  }
  return rekeyAll(state.options, state.variants);
}

/** Names swapped or rotated in one go (paste / autofill: Size→Colour while Colour→Size): no single rename can go first,
 *  as each wants a name another option's rows still use. When every option's visible name is set and they are all
 *  different, every row is re-keyed at once (old key → that option's name) and the keys are cleared. Otherwise the keys
 *  stay (validateProductForm refuses them). */
function rekeyAll(options: OptionDraft[], variants: VariantDraft[]): { options: OptionDraft[]; variants: VariantDraft[] } {
  const pending = options.filter((o) => o.key !== undefined && o.key.trim() !== o.name.trim());
  if (!pending.length || pending.some((o) => !o.name.trim())) return { options, variants };
  const targets = options.map((o) => (o.key !== undefined ? o.name.trim() : optionKey(o)));
  // A new option not named yet (keyless, blank) holds no rows, so it takes no part in the distinct-name rule:
  // two or more of them must not stop a swap (Task 16, T14 minor). Keyed targets are never blank here (checked above).
  const named = targets.filter((t, j) => options[j].key !== undefined || t !== '');
  if (new Set(named.map((t) => t.toLowerCase())).size !== named.length) return { options, variants };
  const map = new Map(options.map((o, j) => [optionKey(o), targets[j]]));
  const nextOptions = options.map((o) => ({ name: o.name, values: o.values }));
  const rekeyed = variants.map((v) => ({ ...v, options: Object.fromEntries(Object.entries(v.options).map(([k, val]) => [map.get(k) ?? k, val])) }));
  return { options: nextOptions, variants: mergeVariants(rekeyed, nextOptions) };
}

/** A row's React key: its option values by the rows' option names (unique per combination, unlike the label). */
export const variantRowKey = (options: Record<string, string>): string => Object.entries(options).map(([k, v]) => `${k}=${v}`).join('|');

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

/** A price-like number: finite (1e999 is Infinity, which JSON sends as null) and not negative. Final review M2. */
const isAmount = (s: string): boolean => { const n = Number(s.trim()); return Number.isFinite(n) && n >= 0; };

/** Same sentences as the API (ProductRules / ProductWriter), shown under each field. */
export function validateProductForm(form: ProductForm, editable: readonly string[]): Record<string, string> {
  const e: Record<string, string> = {};
  const can = (k: string) => editable.includes(k);
  if (can('title') && !form.title.trim()) e.title = 'Give the product a title.';
  for (const k of ['price', 'compare_at_price', 'weight'] as const) {
    if (can(k) && form[k].trim() && !isAmount(form[k])) e[k] = 'Enter a number, like 49.99.';
  }
  for (const d of ['length', 'width', 'height'] as const) {
    if (can('dimensions') && form.dimensions[d].trim() && !isAmount(form.dimensions[d])) e[`dimensions.${d}`] = 'Enter a number, like 49.99.';
  }
  if (can('quantity') && form.quantity.trim() && !/^\d+$/.test(form.quantity.trim())) e.quantity = 'Enter a whole number.';
  if (can('compare_at_price') && !e.price && !e.compare_at_price && form.price.trim() && form.compare_at_price.trim()
    && Number(form.compare_at_price) <= Number(form.price)) e.compare_at_price = 'The compare-at price should be higher than the price.';
  if (can('slug') && form.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) e.slug = 'Use lower-case letters, numbers and dashes only.';
  for (const k of ['buy_url', 'share_image'] as const) {
    if (can(k) && form[k].trim() && !/^https?:\/\/\S+$/i.test(form[k].trim())) e[k] = 'Use a web address starting with https://';
  }
  if (can('currency') && form.currency.trim() && !/^[A-Za-z]{3}$/.test(form.currency.trim())) e.currency = 'Use a three-letter currency code, like CAD.';
  if (can('options')) {
    form.options.forEach((o, i) => {
      const name = o.name.trim().toLowerCase();
      if (!name && o.values.some((v) => v.trim())) e[`options.${i}.name`] = 'Give each option a name.';
      else if (name && form.options.some((x, j) => j !== i && x.name.trim().toLowerCase() === name)) e[`options.${i}.name`] = 'Each option needs its own name.';
      // Safety net: rows still keyed to another name (settleOptions couldn't re-key them) would not match the options.
      else if (o.key !== undefined && o.key.trim() !== o.name.trim()) e[`options.${i}.name`] = 'Each option needs its own name.';
    });
  }
  // Variant rows, keyed like the API's errors (variants.N.price …) so each shows under its own field.
  if (can('variants')) {
    form.variants.forEach((v, i) => {
      for (const k of ['price', 'compare_at_price'] as const) {
        if (v[k].trim() && !isAmount(v[k])) e[`variants.${i}.${k}`] = 'Enter a number, like 49.99.';
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

/**
 * The Products page's status filter (pre-merge D1, 15 Nov): a salesperson's External view (can_create false) lists only
 * the main account's ACTIVE products, so Draft and Archived could never match there. Out of stock is still active.
 */
export function filterStatusesFor(canCreate: boolean): ProductBadge[] {
  return canCreate ? ['active', 'draft', 'out_of_stock', 'archived'] : ['active', 'out_of_stock'];
}

/**
 * The campaign page's Refresh banner and its dialog (pre-merge D3, 15 Nov). `manual_pending` = how many of the changed
 * and retired items are manual products (Products pilot). Missing or 0 → website items only, worded exactly as before.
 */
export function refreshBannerCopy(s: { changed: number; retired: number; manual_pending?: number }): {
  line: string; button: string; title: string; body: string; toast: (updated: number) => string;
} {
  const n = s.changed + s.retired;
  const manual = Math.min(Math.max(Number(s.manual_pending) || 0, 0), n);
  const moments = (k: number) => `${k} ${k === 1 ? 'moment' : 'moments'}`;
  const whose = n === 1 ? "that moment's" : "those moments'";
  const overwrite = `Any changes you made to ${whose} descriptions will be overwritten.`;
  const websiteGone = 'Items no longer on your website are marked "No longer available" and their "View on website" button is hidden.';
  if (manual === 0) {
    return {
      line: `${n} ${n === 1 ? 'item' : 'items'} changed on your website since this campaign was made`,
      button: 'Refresh', // post-live P3: was "Refresh from catalogue"
      title: 'Refresh from your website?',
      body: `${moments(n)} will be updated with the latest photos, price and details from your website. ${overwrite} ${websiteGone}`,
      toast: (u) => `Updated ${moments(u)} from your website`,
    };
  }
  const productsGone = 'Products no longer available are marked "No longer available".';
  if (manual === n) {
    return {
      line: `${n} ${n === 1 ? 'product' : 'products'} changed since this campaign was made`,
      button: 'Refresh',
      title: 'Refresh products?',
      body: `${moments(n)} will be updated with the latest photos, price and details from your products. ${overwrite} ${productsGone}`,
      toast: (u) => `Updated ${moments(u)} from your products`,
    };
  }
  return {
    line: `${n} items changed since this campaign was made`,
    button: 'Refresh',
    title: 'Refresh products?',
    body: `${moments(n)} will be updated with the latest photos, price and details from your website and products. ${overwrite} ${websiteGone} ${productsGone}`,
    toast: (u) => `Updated ${moments(u)} from your website and products`,
  };
}

// ── Post-live (15 Nov): the read-only product details view and "Products" in place of "Website Catalogue". ──

/** The details view's line for a website product (it has no Edit). */
export const WEBSITE_SYNC_NOTE = 'This product comes from your website and updates each time it syncs.';

/**
 * What the details view's header offers (P1). Manual: Edit + ⋯ (Duplicate, Archive / Unarchive, Delete). Website: no
 * Edit; ⋯ keeps today's Duplicate and Archive / Unarchive, plus "Edit settings" (today's editor, where only its status,
 * categories, tags, notes and visibility can change — NEVER-REMOVE). A salesperson's External view: nothing.
 */
export function detailActions(d: Pick<ProductDetail, 'read_only' | 'origin' | 'editable_fields' | 'status'>): {
  edit: boolean; settings: boolean; duplicate: boolean; archive: 'archive' | 'unarchive' | null; remove: boolean; menu: boolean;
} {
  if (d.read_only) return { edit: false, settings: false, duplicate: false, archive: null, remove: false, menu: false };
  const manual = d.origin === 'manual';
  const canStatus = d.editable_fields.includes('status');
  const archive = canStatus ? (d.status === 'archived' ? 'unarchive' : 'archive') : null;
  const settings = !manual && d.editable_fields.some((f) => f !== 'media');
  return { edit: manual, settings, duplicate: true, archive, remove: manual, menu: true };
}

/** The details view's facts list: only what the product has. */
export function detailFacts(d: Pick<ProductDetail, 'sku' | 'brand' | 'product_type' | 'barcode' | 'quantity' | 'weight' | 'weight_unit' | 'dimensions'>): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: unknown) => { const v = value == null ? '' : String(value).trim(); if (v) out.push({ label, value: v }); };
  add('SKU', d.sku);
  add('Brand', d.brand);
  add('Product type', d.product_type);
  add('Barcode / UPC', d.barcode);
  add('Quantity', d.quantity);
  if (d.weight != null && String(d.weight).trim()) add('Weight', `${d.weight} ${d.weight_unit || ''}`);
  const dim = d.dimensions;
  if (dim && (dim.length != null || dim.width != null || dim.height != null)) {
    add('Dimensions', `${[dim.length, dim.width, dim.height].map((x) => (x == null ? '–' : String(x))).join(' × ')} ${dim.unit || ''}`);
  }
  return out;
}

/** The account's real campaign category for catalogue campaigns is stored as this name (web API config catalog.category_name). */
export const CATALOGUE_CATEGORY_NAME = 'Website Catalogue';
/** Shown wherever that category's name is shown (P2/P3). Display only: the stored name, lookups and filters are unchanged. */
export const PRODUCTS_LABEL = 'Products';
export function categoryDisplayName<T>(name: T): T | string {
  return typeof name === 'string' && name.trim().toLowerCase() === CATALOGUE_CATEGORY_NAME.toLowerCase() ? PRODUCTS_LABEL : name;
}
