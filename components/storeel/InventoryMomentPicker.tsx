import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search } from 'lucide-react';
import { catalogueAPI, loadCatalogueForBrowsing } from '../../services/catalogueAPI';
import { dashboardAPI } from '../../utils/authUtils';
import { useIsStarterPlan } from '../../hooks/usePlan';
import { requestUpgrade } from '../../utils/planEvents';
import { catalogGate, type InventoryPick } from './lib/momentPicks';
import { vehiclePrice, vehicleTags } from './lib/previewMoments';

/** Add a Moment's sources: photos & videos (the modal's own), the Website Catalogue's products, a dealer's vehicles. */
export type MomentSource = 'media' | 'product' | 'vehicle';

/** Add a Moment's products / vehicles (Chris, 7 Nov 2026), for whoever opened it (the Storeel page, the campaign page). */
export interface MomentInventory {
  /** Add the picks. False keeps the window open (the caller has said why). */
  onAdd(picks: { products: InventoryPick[]; vehicles: InventoryPick[] }): Promise<boolean> | boolean;
  /** Already in the campaign: shown ticked and not pickable again. */
  alreadyAdded?: { products?: ReadonlyArray<string>; vehicles?: ReadonlyArray<string> };
  /** "See plans" (off the Business plan). Default: ask App to open the plans. */
  onSeePlans?(): void;
}

/** At most this many products per Add all (the web API's per-request limit). */
export const MAX_PRODUCTS_PER_ADD = 50;
const BUSINESS_PLAN_LINE = 'Available on the Business plan.';
const PLAN_MESSAGE = 'Adding Website Catalogue products is available on the Business plan.';

export interface InventorySources {
  loading: boolean;
  /** Products: hidden (no catalogue), the plan note, or ready with its items. */
  productGate: 'hidden' | 'upgrade' | 'ready';
  products: InventoryPick[];
  vehicles: InventoryPick[];
}

/**
 * What the account can add: GET /website-catalogue first (the items route is Business-only, and its 403 would open the
 * upgrade window by itself), then its items; GET /cars for a dealer's vehicles. Loaded when Add a Moment opens.
 */
export function useInventorySources(enabled: boolean): InventorySources {
  const { isStarter } = useIsStarterPlan();
  const [state, setState] = useState<InventorySources>({ loading: false, productGate: 'hidden', products: [], vehicles: [] });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const status = await catalogueAPI.getStatus().catch(() => null);
      const gate = catalogGate(status && status.ok && status.data ? status.data : null, isStarter);
      const [products, cars] = await Promise.all([
        gate === 'ready' ? loadCatalogueForBrowsing() : Promise.resolve([]),
        dashboardAPI.carsGetCatalog().catch(() => null),
      ]);
      const raw = (cars as any)?.data?.data?.cars || (cars as any)?.data?.cars || [];
      const vehicles: InventoryPick[] = (Array.isArray(raw) ? raw : []).filter((c: any) => c?.id != null).map((c: any) => ({
        id: c.id, title: c.title || 'Untitled vehicle', main_image: c.main_image || null, price: c.price ?? null, mileage: c.mileage ?? null, stock_number: c.stock_number ?? null,
      }));
      if (!cancelled) {
        setState({
          loading: false,
          productGate: gate === 'ready' && products.length === 0 ? 'hidden' : gate,
          products: products.map((p) => ({ id: p.id, title: p.title || 'Untitled product', main_image: p.main_image, price_label: p.price_label, url: p.url, images_count: p.images_count, category: p.category })),
          vehicles,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, isStarter]);
  return state;
}

/**
 * Add a Moment's Products / Vehicles list: search, the website's categories (products), tick any number. As the
 * Create Campaign picker shows them: photo, title, price (products: · category; vehicles: · mileage · stock #).
 */
export default function InventoryMomentPicker({ kind, gate = 'ready', items, loading, picked, onToggle, alreadyAdded, onSeePlans }: {
  kind: 'product' | 'vehicle';
  gate?: 'upgrade' | 'ready' | 'hidden';
  items: InventoryPick[];
  loading: boolean;
  picked: ReadonlyArray<string>;
  onToggle(id: string): void;
  alreadyAdded?: ReadonlyArray<string>;
  onSeePlans?(): void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const words = kind === 'product' ? { plural: 'products', search: 'Search products' } : { plural: 'vehicles', search: 'Search vehicles' };
  const categories = useMemo(
    () => (kind === 'product' ? [...new Set(items.map((i) => (i.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []),
    [items, kind],
  );
  const shown = items.filter((item) => {
    const q = search.trim().toLowerCase();
    const hay = `${item.title || ''} ${item.stock_number || ''}`.toLowerCase();
    return (!q || hay.includes(q)) && (!category || (item.category || '').trim() === category);
  });
  const done = new Set((alreadyAdded ?? []).map(String));
  const full = kind === 'product' && picked.length >= MAX_PRODUCTS_PER_ADD;

  if (kind === 'product' && gate === 'upgrade') {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center" data-testid="moment-products-upgrade">
        <p className="text-sm text-gray-700">{BUSINESS_PLAN_LINE}</p>
        <button type="button" onClick={() => (onSeePlans ? onSeePlans() : requestUpgrade(PLAN_MESSAGE))} className="mt-3 inline-flex h-10 items-center rounded-lg bg-[#6C60FF] px-4 text-sm font-medium text-white hover:bg-[#5B50E0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 focus-visible:ring-offset-2">
          See plans
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid={`moment-${kind}-picker`}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={words.search} aria-label={words.search}
            className="h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-base md:h-10 md:text-sm focus:border-[#6C60FF] focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20"
          />
        </div>
        {categories.length ? (
          <select
            value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"
            className="h-11 w-[40%] min-w-0 rounded-lg border border-gray-300 bg-white px-2 text-base md:h-10 md:text-sm focus:border-[#6C60FF] focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : null}
      </div>
      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading {words.plural}…</p>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-gray-200 py-8 text-center text-sm text-gray-500">{items.length ? `No ${words.plural} match.` : `No ${words.plural} yet.`}</p>
      ) : (
        <ul aria-label={kind === 'product' ? 'Products' : 'Vehicles'} className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {shown.map((item) => {
            const id = String(item.id);
            const added = done.has(id);
            const on = added || picked.includes(id);
            const meta = kind === 'product'
              ? [item.price_label, item.category].filter(Boolean).join(' · ')
              : [vehiclePrice(item), ...vehicleTags(item)].filter(Boolean).join(' · ');
            return (
              <li key={id}>
                <button
                  type="button" role="checkbox" aria-checked={on} disabled={added || (!on && full)}
                  onClick={() => onToggle(id)}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6C60FF]/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-[#6C60FF] bg-[#6C60FF] text-white' : 'border-gray-300 bg-white'}`} aria-hidden="true">
                    {on ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {item.main_image ? <img src={item.main_image} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{item.title}</span>
                    {added ? <span className="block truncate text-xs text-gray-500">Already in this campaign</span>
                      : meta ? <span className="block truncate text-xs text-gray-500">{meta}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {full ? <p className="text-xs text-gray-500">You can add up to {MAX_PRODUCTS_PER_ADD} products at a time.</p> : null}
    </div>
  );
}
