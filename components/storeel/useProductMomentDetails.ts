import { useEffect, useState } from 'react';
import { productsAPI, type ProductDetail } from '../../services/productsAPI';
import { catalogueAPI, type CatalogueItemDetail } from '../../services/catalogueAPI';
import { productBuyButton } from '../../utils/products';
import { plainText, shownPrice } from '../../utils/productMoment';
import type { PreviewMoment } from './lib/previewMoments';

/**
 * Chris 21 Nov 2026 (P3): the Storeel preview's product card shows what the saved moment will — the product's
 * description, its price as a badge, its buy button ("Add to Cart" / its own words) and "Enquire" when the product
 * offers it. The picker's list has none of those, so each product picked (catalogue key `catalog-<id>`) is read once
 * (GET /products/{id}, else GET /website-catalogue/items/{id}) and kept for this page session. A product that can't be
 * read keeps the list's title / price / photo, as before.
 */
export interface ProductMomentDetail {
  description: string;
  /** The buy link's words (productBuyButton); '' without a usable buy link. */
  buyLabel: string;
  /** A website product's page ("View on website"). */
  hasPage: boolean;
  enquire: boolean;
  /** A manual product (Products): no website behind it. */
  manual: boolean;
  /** Its first photo (by the product's order) — the picture the saved moment gets, also when the cover was removed. */
  image: string | null;
  /** The price a viewer may see (shownPrice), or null to keep the list's. */
  price: string | null;
}

const cache = new Map<string, ProductMomentDetail | null>();
const pending = new Map<string, Promise<ProductMomentDetail | null>>();

function fromProduct(d: ProductDetail): ProductMomentDetail {
  const photo = [...(d.media || [])].filter((m) => m.type !== 'video' && m.url).sort((a, b) => a.sort_order - b.sort_order)[0]?.url || null;
  return {
    description: plainText(d.description),
    buyLabel: productBuyButton(d)?.label || '',
    hasPage: d.origin !== 'manual' && Boolean(d.url),
    enquire: d.show_enquire !== false,
    manual: d.origin === 'manual',
    image: photo || d.main_image || null,
    price: shownPrice(d),
  };
}

function fromCatalogue(d: CatalogueItemDetail): ProductMomentDetail {
  const photo = [...((d as any).images || [])].filter((m: any) => m?.url).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]?.url || null;
  return {
    description: plainText(d.description),
    buyLabel: '',
    hasPage: Boolean(d.url),
    enquire: (d as any).show_enquire !== false && (d as any).show_enquire !== 0,
    manual: false,
    image: photo || d.main_image || null,
    price: null,
  };
}

async function load(id: string): Promise<ProductMomentDetail | null> {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  try {
    const p = await productsAPI.get(n);
    if (p.ok && p.data) return fromProduct(p.data);
    const c = await catalogueAPI.getItem(n);
    return c.ok && c.data ? fromCatalogue(c.data) : null;
  } catch {
    return null;
  }
}

function fetchOnce(id: string): Promise<ProductMomentDetail | null> {
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null);
  let p = pending.get(id);
  if (!p) {
    p = load(id).then((d) => { cache.set(id, d); pending.delete(id); return d; });
    pending.set(id, p);
  }
  return p;
}

/** Forget what was read (a product was edited on Products). */
export function clearProductMomentDetails(): void { cache.clear(); }

const CATALOG_KEY = /^catalog-(\d+)$/;

/** The product ids among the preview's moments (catalogue / Products items only, not Shopify collection products). */
export function productIdsOf(moments: ReadonlyArray<PreviewMoment>): string[] {
  const ids: string[] = [];
  for (const m of moments) {
    const hit = m.kind === 'product' ? CATALOG_KEY.exec(m.key) : null;
    if (hit && !ids.includes(hit[1])) ids.push(hit[1]);
  }
  return ids;
}

/** Reads the picked products' details (3 at a time) and returns what is known so far, by product id. */
export function useProductMomentDetails(ids: ReadonlyArray<string>): ReadonlyMap<string, ProductMomentDetail> {
  const [, bump] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    const missing = ids.filter((id) => !cache.has(id));
    if (!missing.length) return undefined;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < missing.length; i += 3) {
        await Promise.all(missing.slice(i, i + 3).map(fetchOnce));
        if (!cancelled) bump((n) => n + 1);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const out = new Map<string, ProductMomentDetail>();
  for (const id of ids) {
    const d = cache.get(id);
    if (d) out.set(id, d);
  }
  return out;
}

/** The preview's product moments with their details filled in (photo, price, description, buttons). */
export function withProductDetails(moments: PreviewMoment[], details: ReadonlyMap<string, ProductMomentDetail>): PreviewMoment[] {
  if (!details.size) return moments;
  return moments.map((m) => {
    if (m.kind !== 'product') return m;
    const hit = CATALOG_KEY.exec(m.key);
    const d = hit ? details.get(hit[1]) : undefined;
    if (!d) return m;
    return {
      ...m,
      image: m.image ?? d.image,
      price: d.price ?? m.price,
      description: d.description,
      buyLabel: d.buyLabel,
      cta: Boolean(d.buyLabel) || d.hasPage || m.cta,
      enquire: d.enquire,
      manual: d.manual,
    };
  });
}
