import { vehiclePrice, vehicleTags, type PickKind, type PreviewMoment } from './previewMoments.ts';

// Chris, 7 Nov 2026 (point 7): Add a Moment offers the account's Website Catalogue products and a dealer's vehicles.
// Pure, so `node --test` loads it.

/** A product or vehicle as Add a Moment's picker lists it (GET /website-catalogue/items, GET /cars). */
export interface InventoryPick {
  id: string | number;
  title?: string | null;
  main_image?: string | null;
  /** Products. */
  price_label?: string | null;
  url?: string | null;
  images_count?: number | null;
  category?: string | null;
  /** Vehicles. */
  price?: string | number | null;
  mileage?: string | number | null;
  stock_number?: string | null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const link = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const unique = <T,>(list: T[]): T[] => list.filter((v, i) => list.indexOf(v) === i);
const ints = (ids: ReadonlyArray<string>): number[] => unique(ids.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n)));

/**
 * What Save as Draft sends for the picks: step 1's picks by the category's kind (as before), and the products and
 * vehicles added with Add a Moment beside them — products as catalog_item_ids (the API makes them moments on a campaign
 * of any category), vehicles as car_ids on any category (review minor 1: never among linked_memory_ids, whose ids the
 * API matches against campaigns first).
 */
export function pickPayload({ pick, selectedIds, extraCatalog, extraCars }: {
  pick: PickKind;
  selectedIds: ReadonlyArray<string>;
  extraCatalog: ReadonlyArray<string>;
  extraCars: ReadonlyArray<string>;
}): Record<string, Array<string | number>> {
  const out: Record<string, Array<string | number>> = {};
  const catalog = pick === 'catalog' ? [...selectedIds, ...extraCatalog] : [...extraCatalog];
  if (pick === 'shopify' && selectedIds.length) out.shopify_collection_ids = [...selectedIds];
  if (pick === 'campaigns' && selectedIds.length) out.linked_memory_ids = ints(selectedIds);
  const cars = unique([...(pick === 'cars' ? selectedIds : []), ...extraCars].map(String));
  if (cars.length) out.car_ids = cars;
  if (catalog.length) out.catalog_item_ids = ints(catalog);
  return out;
}

/** GET /website-catalogue's answer for the account (null: none yet / failed). */
export interface CatalogStatusLike { available: boolean; reason: string | null; item_count: number }

/**
 * Add a Moment's Products choice: 'hidden' outside the Website Catalogue pilot, with no answer, or with no products;
 * 'upgrade' off the Business plan ("Available on the Business plan." + See plans); 'ready' to pick.
 */
export function catalogGate(status: CatalogStatusLike | null, isStarter: boolean): 'hidden' | 'upgrade' | 'ready' {
  if (!status || status.reason === 'not_available') return 'hidden';
  if (isStarter || status.reason === 'plan_required') return 'upgrade';
  return status.available && status.item_count > 0 ? 'ready' : 'hidden';
}

/** Products / vehicles picked in Add a Moment, as the live preview shows them (like step 1's picks). */
export function pickedPreviewMoments(kind: 'catalog' | 'cars', items: ReadonlyArray<InventoryPick>, location: string, today: string): PreviewMoment[] {
  return items.map((item): PreviewMoment => {
    const sourceId = String(item.id);
    const image = link(item.main_image);
    const title = text(item.title);
    if (kind === 'catalog') {
      return { kind: 'product', key: `catalog-${sourceId}`, sourceId, image, title, price: text(item.price_label), cta: Boolean(link(item.url)), location: text(location), date: today };
    }
    return { kind: 'vehicle', key: `car-${sourceId}`, sourceId, image, title, price: vehiclePrice(item), tags: vehicleTags(item) };
  });
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The toast after products / vehicles are added to a saved campaign: what was added, and how many were already in it. */
export function addedMessage({ products, vehicles, already = 0 }: { products: number; vehicles: number; already?: number }): string {
  const parts = [products ? count(products, 'product', 'products') : '', vehicles ? count(vehicles, 'vehicle', 'vehicles') : ''].filter(Boolean);
  if (!parts.length) return 'Those are already in this campaign.';
  return `${parts.join(' and ')} added to your campaign.${already ? ` ${already} ${already === 1 ? 'was' : 'were'} already in it.` : ''}`;
}

/**
 * Whether Add a Moment's products / vehicles load may be reused for a while (re-review N3): only when every answer came
 * back — a failure (or a catalogue with items that listed none) is asked again the next time the window opens.
 */
export function inventoryCacheable({ statusOk, carsOk, gate, products }: { statusOk: boolean; carsOk: boolean; gate: string; products: number }): boolean {
  return statusOk && carsOk && !(gate === 'ready' && products === 0);
}
