import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Check, Package, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { dashboardAPI } from '../utils/authUtils';
import { formatCarCategory } from '../utils/carCategories';
import { describeCarSearch, matchesCarSearch, parseCarSearch } from '../utils/carSearch';
import { leadsAPI } from '../services/leadsAPI';
import { loadCatalogueForBrowsing, type CatalogueItemSummary } from '../services/catalogueAPI';
import { loadManualProductsForLeadShare } from '../services/productsAPI';
import { loadShopifyForBrowsing } from '../services/shopifyItemsAPI';
import { leadShareSources, visibleCategoryNames } from '../utils/products';

// One listing from GET /cars — only the fields this picker renders.
interface CarListing {
  id: number;
  title?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  price?: number | string | null;
  main_image?: string | null;
  category?: string | null; // "preowned" | "hybrid" — what the category dropdown groups by
}

// What a pick holds: dealer vehicles (GET /cars), products (Website Catalogue, and the account's manual products when
// Products is on) or Shopify products (ticket wdy2xh1320: listed under the same Products tab, after the others). One kind
// per campaign. Shopify ids are shopify_products.id — a different id space from 'product' ids, so they can collide.
export type PickKind = 'vehicle' | 'product' | 'shopify';
// The picker's tabs: Shopify products live on the Products tab.
type PickTab = 'vehicle' | 'product';
const tabOf = (k: PickKind): PickTab => (k === 'shopify' ? 'product' : k);
/** Whether two kinds open the same picker tab (a Shopify pick reopens on Products with its selection). */
export const samePickTab = (a: PickKind, b: PickKind) => tabOf(a) === tabOf(b);

// Selection keys carry the source, because ids collide across sources.
type ProductSource = 'product' | 'shopify';
const keyOf = (kind: PickKind, id: number) => `${kind === 'shopify' ? 'shopify' : kind === 'product' ? 'p' : 'v'}:${id}`;
const keySource = (key: string): PickKind => (key.startsWith('shopify:') ? 'shopify' : key.startsWith('p:') ? 'product' : 'vehicle');
const keyId = (key: string) => Number(key.slice(key.indexOf(':') + 1));
type ListedProduct = CatalogueItemSummary & { source: ProductSource; key: string };

// The web API's per-campaign product limit (config catalog.max_items_per_campaign).
const MAX_PRODUCTS = 50;

// Dropdown value for "no category filter".
const ALL_CATEGORIES = 'all';

// Shown pre-filled in the name field for vehicles, and sent when that name is left blank.
const DEFAULT_CAMPAIGN_NAME = 'Your Campaign';

// Products (Chris, 13 Nov 2026): the field starts empty and a blank name is named by the server like this — the
// product's own name for one product, "Products for {first name}" for several ("Products for you" without a name).
export function productCampaignDefault(titles: string[], leadName: string): string {
  if (titles.length === 1 && titles[0].trim()) return titles[0].trim().slice(0, 120);
  const first = leadName.trim().split(/\s+/)[0] || '';
  const isName = !/^this contact$/i.test(leadName.trim()) && /\p{L}/u.test(first) && !/[\d@]/.test(first);
  return `Products for ${isName ? first.slice(0, 40) : 'you'}`;
}

interface ShareCarsDialogProps {
  open: boolean;
  onClose: () => void;
  leadName: string;
  // Share mode: send to this lead now via POST /leads/{id}/share-cars.
  leadId?: number;
  // Called after a successful share so the caller can refresh the thread.
  onShared?: () => void;
  // Pick mode ("+ Send Message"): hand the choice back instead of sending. Both modes offer
  // what the account has (Deepak, 13 Nov 2026): Website Catalogue products when a catalogue is
  // connected, vehicles when it has a car inventory, a Vehicles / Products switch for both.
  // campaignName is '' for products left unnamed (the server names them); defaultName is that name, for display.
  onPick?: (ids: number[], campaignName: string, kind: PickKind, defaultName?: string) => void;
  initialSelection?: number[];
  initialCampaignName?: string;
  initialKind?: PickKind;
}

function carSubtitle(c: CarListing): string {
  const parts: string[] = [];
  if (c.year != null && c.year !== '') parts.push(String(c.year));
  const makeModel = [c.make, c.model].filter(Boolean).join(' ');
  if (makeModel) parts.push(makeModel);
  if (c.price != null && c.price !== '') {
    const n = typeof c.price === 'string' ? parseFloat(c.price) : c.price;
    if (Number.isFinite(n)) parts.push(`$${Math.round(n).toLocaleString()}`);
  }
  return parts.join(' · ');
}

// "Share new cars" — the Studio counterpart of the mobile app's Share New Cars
// sheet. Picks from the dealer's own inventory (GET /cars, same feed the
// Cars catalog uses) and sends them to the lead in a NEW campaign, named by the
// rep (default "Your Campaign"), via POST /leads/{id}/share-cars. Each
// share gets its own campaign and link — never added to the lead's old one.
// A category dropdown (the categories the dealer's inventory actually has, e.g.
// "Preowned (26)", "Hybrid (21)") narrows the list; selections survive switching.
export default function ShareCarsDialog({ open, onClose, leadId, leadName, onShared, onPick, initialSelection, initialCampaignName, initialKind }: ShareCarsDialogProps) {
  const [cars, setCars] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [campaignName, setCampaignName] = useState(DEFAULT_CAMPAIGN_NAME);
  const [isSharing, setIsSharing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  // True when the loaded list is the dealer's WHOLE inventory (GET /cars caps a page at
  // 100). Then the dropdown filters and counts locally; otherwise picking a category
  // re-queries the server so cars beyond the first 100 are still reachable.
  const [isComplete, setIsComplete] = useState(true);
  const loadSeq = useRef(0);
  // Pick mode only: the catalogue's products, and which list is showing.
  const [products, setProducts] = useState<ListedProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  // What this account offers (GET /leads/campaign-sources): Products = a Website Catalogue connected or active manual products,
  // Vehicles = a car inventory; the switch only when it has both. null while loading.
  const [sources, setSources] = useState<{ vehicles: boolean; products: boolean } | null>(null);
  const [kind, setKind] = useState<PickTab>(tabOf(initialKind ?? 'vehicle'));

  // Loads the inventory. `cat` is only passed when re-querying the server for one
  // category (inventory > 100 cars); the first load also learns which categories exist.
  const loadCars = async (cat?: string, initial = false) => {
    const seq = ++loadSeq.current; // ignore a slower, older response
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await dashboardAPI.carsGetCatalog(cat);
      if (seq !== loadSeq.current) return;
      if (res?.success === false) {
        setLoadError(res.error || res.message || 'Could not load your inventory.');
        return;
      }
      const payload: any = res?.data?.data ?? res?.data ?? {};
      const list = (Array.isArray(payload.cars) ? payload.cars : []).filter((c: any) => c?.id != null);
      setCars(list);
      if (initial) {
        const cats: string[] = (Array.isArray(payload.filters?.categories) ? payload.filters.categories : [])
          .filter((c: unknown): c is string => typeof c === 'string' && c.trim() !== '');
        setCategories(Array.from(new Set(cats)).sort());
        const total = payload.pagination?.total;
        setIsComplete(typeof total !== 'number' || total <= list.length);
      }
    } catch {
      if (seq === loadSeq.current) setLoadError('Could not load your inventory.');
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  };

  // Fresh inventory + a clean slate every time the dialog opens — stock changes
  // between visits and a stale selection would silently carry over.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set((initialSelection ?? []).map((id) => keyOf(initialKind ?? 'vehicle', id))));
    setSearch('');
    setCampaignName(initialCampaignName || (tabOf(initialKind ?? 'vehicle') === 'product' ? '' : DEFAULT_CAMPAIGN_NAME));
    setCategory(ALL_CATEGORIES);
    setCategories([]);
    setIsComplete(true);
    setKind(tabOf(initialKind ?? 'vehicle'));
    setProducts([]);
    setCars([]);
    setLoadError(null);
    setSources(null);
    let cancelled = false;
    leadsAPI.getCampaignSources()
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data;
        // An API without the endpoint: vehicles only, as before.
        const known = res?.success ? leadShareSources(d) : null;
        // Shopify products (wdy2xh1320): only when the API says the account has a connected store with products.
        return known ? { ...known, shopify: Boolean(d && (d as any).shopify_products === true) } : { vehicles: true, products: false, website: false, manual: false, shopify: false };
      })
      .catch(() => ({ vehicles: true, products: false, website: false, manual: false, shopify: false }))
      .then((s) => {
        if (cancelled) return;
        const hasProducts = s.products || s.shopify;
        setSources({ vehicles: s.vehicles, products: hasProducts });
        // Royal Wood (catalogue, no cars) opens straight on Products.
        setKind(tabOf(initialKind ?? (!s.vehicles && hasProducts ? 'product' : 'vehicle')));
        if (s.vehicles) loadCars(undefined, true);
        if (hasProducts) {
          // Website products: GET /website-catalogue first, so it never opens the upgrade popup (as before). Manual
          // products (Products on, 16 Nov 2026 F1): the account's active ones with a photo, listed after them. Shopify
          // products last (loadShopifyForBrowsing asks the status route first, so it never opens the upgrade popup either).
          setProductsLoading(true);
          const tag = (source: ProductSource) => (list: CatalogueItemSummary[]): ListedProduct[] =>
            list.map((p) => ({ ...p, source, key: keyOf(source, p.id) }));
          Promise.all([
            s.website ? loadCatalogueForBrowsing() : Promise.resolve([] as CatalogueItemSummary[]),
            s.manual ? loadManualProductsForLeadShare() : Promise.resolve([] as CatalogueItemSummary[]),
            s.shopify ? loadShopifyForBrowsing() : Promise.resolve([] as CatalogueItemSummary[]),
          ])
            .then(([site, manual, shopify]) => {
              if (!cancelled) setProducts([...tag('product')(site), ...tag('product')(manual), ...tag('shopify')(shopify)]);
            })
            .finally(() => { if (!cancelled) setProductsLoading(false); });
        }
      });
    return () => { loadSeq.current++; cancelled = true; };
  }, [open]);

  const showKindSwitch = Boolean(sources?.vehicles && sources?.products);
  const isProducts = kind === 'product';

  // Switching to Products clears the untouched vehicle default (and back), so the field shows the right default.
  useEffect(() => {
    setCampaignName((prev) => (prev.trim() === '' || prev === DEFAULT_CAMPAIGN_NAME ? (kind === 'product' ? '' : DEFAULT_CAMPAIGN_NAME) : prev));
  }, [kind]);

  const switchKind = (next: PickTab) => {
    if (next === kind) return;
    setKind(next);
    setSelected(new Set());
    setSearch('');
    setCategory(ALL_CATEGORIES);
  };

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    if (!isProducts && !isComplete) loadCars(next === ALL_CATEGORIES ? undefined : next);
  };

  // Per-category counts, only when the list is the whole inventory (otherwise they'd lie).
  const counts = useMemo(() => {
    if (!isComplete) return null;
    const m: Record<string, number> = {};
    cars.forEach((c) => { if (c.category) m[c.category] = (m[c.category] || 0) + 1; });
    return m;
  }, [cars, isComplete]);

  // Smart search: words + a year and/or a price in one box ("hybrid under 30k", "2024",
  // "20k-30k") — see utils/carSearch.ts. `searchNotes` echoes what it understood.
  const parsedSearch = useMemo(() => parseCarSearch(search), [search]);
  const searchNotes = useMemo(() => describeCarSearch(parsedSearch), [parsedSearch]);

  const productCategories = useMemo(
    () => visibleCategoryNames(products), // Show / Hide (16 Nov): a hidden category is left out; its products stay listed
    [products],
  );
  const productCounts = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach((p) => { const c = (p.category || '').trim(); if (c) m[c] = (m[c] || 0) + 1; });
    return m;
  }, [products]);
  // What a product campaign left unnamed will be called (the field's placeholder).
  const productDefaultName = useMemo(
    () => productCampaignDefault(products.filter((p) => selected.has(p.key)).map((p) => p.title || ''), leadName),
    [products, selected, leadName],
  );
  const nameDefault = isProducts ? productDefaultName : DEFAULT_CAMPAIGN_NAME;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== ALL_CATEGORIES && (p.category || '').trim() !== category) return false;
      return !q || `${p.title || ''} ${p.category || ''}`.toLowerCase().includes(q);
    });
  }, [products, search, category]);

  const filtered = useMemo(() => {
    return cars.filter((c) => {
      if (category !== ALL_CATEGORIES && c.category !== category) return false;
      return matchesCarSearch(c, parsedSearch);
    });
  }, [cars, parsedSearch, category]);

  const emptyText =
    (isProducts ? products.length === 0 : cars.length === 0) && category === ALL_CATEGORIES
      ? 'Nothing in your inventory yet!'
      : category !== ALL_CATEGORIES && !search.trim()
        ? 'Nothing in this category.'
        : 'Nothing matches your search.';

  // One source per campaign: once a Shopify product is picked, the other products can't be (and vice versa).
  const pickedSource: ProductSource | null = useMemo(() => {
    for (const key of selected) {
      const src = keySource(key);
      if (src !== 'vehicle') return src;
    }
    return null;
  }, [selected]);
  const hasShopifyProducts = useMemo(() => products.some((p) => p.source === 'shopify'), [products]);
  const hasOtherProducts = useMemo(() => products.some((p) => p.source === 'product'), [products]);
  // What goes to the API: the plain ids and the kind they belong to.
  const pickKind: PickKind = isProducts ? (pickedSource ?? 'product') : 'vehicle';
  const pickIds = () => Array.from(selected).map(keyId);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (isProducts && next.size >= MAX_PRODUCTS) return prev;
      else next.add(key);
      return next;
    });
  };

  const handleShare = async () => {
    if (selected.size === 0 || isSharing) return;
    if (onPick) {
      onPick(pickIds(), campaignName.trim() || (isProducts ? '' : DEFAULT_CAMPAIGN_NAME), pickKind, isProducts ? productDefaultName : undefined);
      onClose();
      return;
    }
    if (leadId == null) return;
    setIsSharing(true);
    try {
      // Vehicles always send a name (the server's own fallback is car-worded); unnamed products are named by the server.
      const name = campaignName.trim() || (isProducts ? '' : DEFAULT_CAMPAIGN_NAME);
      const res = await leadsAPI.shareCars(leadId, pickIds(), name, pickKind);
      if (res.success) {
        const shared = typeof res.data?.cars_total === 'number' ? res.data.cars_total : selected.size;
        const itemWord = shared === 1 ? 'item' : 'items';
        // Only claim a new campaign when the server says it made one — an older backend
        // (not yet deployed) still appends to the lead's campaign and returns no `campaign`.
        toast.success(
          res.data?.campaign
            ? `Sent ${leadName} ${shared} ${itemWord} in a new campaign, "${res.data.campaign.title}".`
            : `Shared ${shared} ${itemWord} with ${leadName}.`,
        );
        onShared?.();
        onClose();
      } else {
        toast.error(res.message || res.error || 'Could not share the campaign.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not share the campaign.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isSharing) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-white rounded-2xl shadow-xl">
        <DialogHeader className="px-6 pt-6 pb-3 pr-12">
          <DialogTitle>Share Campaign</DialogTitle>
          <DialogDescription>
            {onPick
              ? `Adds the items to your message to ${leadName}. The campaign is created when you send it.`
              : `Creates a new campaign with the items you pick and sends ${leadName} its own link.`}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3">
          <label htmlFor="share-cars-campaign-name" className="block text-xs font-medium text-gray-700 mb-1">
            Campaign name
          </label>
          <input
            id="share-cars-campaign-name"
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            maxLength={120}
            placeholder={nameDefault}
            className="w-full h-10 px-3 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          />
        </div>

        {showKindSwitch && (
          // Same pill toggle as Send Message's Text / Email tabs.
          <div className="px-6 pb-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" role="group" aria-label="What to pick">
              {(['vehicle', 'product'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => switchKind(k)}
                  className={`flex-1 h-9 inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${kind === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  {k === 'vehicle' ? <><Car className="w-4 h-4" />Vehicles</> : <><Package className="w-4 h-4" />Products</>}
                </button>
              ))}
            </div>
          </div>
        )}

        {isProducts ? (productCategories.length > 1 && (
          <div className="px-6 pb-3">
            <label id="share-cars-category-label" className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger aria-labelledby="share-cars-category-label" className="h-10 w-full bg-white border-gray-200 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories ({products.length})</SelectItem>
                {productCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c} ({productCounts[c] ?? 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )) : categories.length > 1 && (
          <div className="px-6 pb-3">
            <label id="share-cars-category-label" className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger aria-labelledby="share-cars-category-label" className="h-10 w-full bg-white border-gray-200 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>
                  All categories{counts ? ` (${cars.length})` : ''}
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {formatCarCategory(c)}{counts ? ` (${counts[c] ?? 0})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isProducts ? 'Search products' : 'Search inventory, price or year'}
              aria-label={isProducts ? 'Search products' : 'Search inventory, price or year'}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-gray-100 text-sm text-gray-700 placeholder:text-gray-500 border-none outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            />
          </div>
          {!isProducts && searchNotes.length > 0 && (
            <p className="mt-1.5 text-xs text-[#4A5565]" aria-live="polite">
              Showing: {searchNotes.join(' · ')}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
          {(sources === null || (isProducts ? productsLoading : isLoading)) ? (
            <div className="flex justify-center py-14" role="status" aria-label="Loading your inventory">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4A5565]" />
            </div>
          ) : !isProducts && loadError ? (
            <p className="text-center text-sm text-gray-600 py-10">{loadError}</p>
          ) : (isProducts ? filteredProducts.length === 0 : filtered.length === 0) ? (
            <p className="text-center text-sm text-gray-600 py-10">
              {emptyText}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(isProducts
                ? filteredProducts.map((p) => ({
                    key: p.key, title: p.title, main_image: p.main_image,
                    // Shopify products say so (only when the list mixes sources), since they go in their own campaign.
                    subtitle: [p.price_label, p.category, p.source === 'shopify' && hasOtherProducts ? 'Shopify' : null].filter(Boolean).join(' · '),
                    locked: pickedSource !== null && p.source !== pickedSource,
                  }))
                : filtered.map((c) => ({ key: keyOf('vehicle', c.id), title: c.title, main_image: c.main_image, subtitle: carSubtitle(c), locked: false }))
              ).map((c) => {
                const isSel = selected.has(c.key);
                const subtitle = c.subtitle;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSel}
                      disabled={c.locked}
                      onClick={() => toggle(c.key)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSel ? 'bg-[#F3F4F6] border-[1.5px] border-[#202224]' : 'bg-white border border-gray-200 hover:bg-gray-50 disabled:hover:bg-white'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex items-center justify-center w-5 h-5 shrink-0 rounded border ${
                          isSel ? 'bg-[#202224] border-[#202224] text-white' : 'bg-white border-gray-300'
                        }`}
                      >
                        {isSel && <Check className="w-3.5 h-3.5" />}
                      </span>
                      {c.main_image ? (
                        <img src={c.main_image} alt="" className="w-11 h-11 rounded-md object-cover shrink-0" />
                      ) : (
                        <span aria-hidden="true" className="w-11 h-11 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                          {isProducts ? <Package className="w-5 h-5 text-gray-400" /> : <Car className="w-5 h-5 text-gray-400" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{c.title || 'Untitled item'}</span>
                        {subtitle && <span className="block truncate text-xs text-gray-600">{subtitle}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4">
          {isProducts && selected.size >= MAX_PRODUCTS && (
            <p className="mb-2 text-xs text-gray-600" aria-live="polite">Up to {MAX_PRODUCTS} products.</p>
          )}
          {isProducts && pickedSource !== null && hasShopifyProducts && hasOtherProducts && (
            <p className="mb-2 text-xs text-gray-600" aria-live="polite">
              {pickedSource === 'shopify' ? 'Shopify products go in their own campaign.' : 'Shopify products go in a separate campaign.'}
            </p>
          )}
          <button
            type="button"
            onClick={handleShare}
            disabled={selected.size === 0 || isSharing}
            className="w-full h-11 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-2"
          >
            {/* Short labels (Chris: 1–2 words). Pick mode never sends — Send in the message box does. */}
            {isSharing
              ? 'Sharing…'
              : `${onPick ? 'Add' : 'Share'}${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
