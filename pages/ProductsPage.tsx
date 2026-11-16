// pages/ProductsPage.tsx — Products (spec "Products page in Studio"; plan 2026-11-09-products-m1-m2 Tasks 12–14).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder, Globe, Package, Plus, Search } from 'lucide-react';
import { productsAPI, type ProductCategory, type ProductDetail, type ProductFilters as Filters, type ProductsPage as PageData, type ProductSort, type ProductSummary } from '../services/productsAPI';
import { useInventoryViewKey } from '../hooks/useInventoryViewKey';
import ProductCard from '../components/products/ProductCard';
import ProductCategoryNav from '../components/products/ProductCategoryNav';
import ProductFilters from '../components/products/ProductFilters';
import ProductBulkBar from '../components/products/ProductBulkBar';
import ProductEditor from '../components/products/ProductEditor';
import ProductDetails from '../components/products/ProductDetails';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import ProductSelect, { FILTER_TRIGGER } from '../components/products/ProductSelect';
import AllMemoriesEmptyState from '../components/AllMemoriesEmptyState';
import { toast } from 'sonner';
import { useProperty } from '../contexts/PropertyContext';
import { announceProductsChanged, PRODUCTS_CHANGED_EVENT, useProductsStatus } from '../hooks/useProductsStatus';
import { DEFAULT_CURRENCY, filterStatusesFor, pageToClampTo, productsGate, UPGRADE_LINE } from '../utils/products';
import { requestUpgrade } from '../utils/planEvents';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../components/newsletters/lib/ui';

export default function ProductsPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { status, loading } = useProductsStatus();
  const gate = productsGate(status);
  const { viewType } = useProperty();

  // Not available for this account / view (or the status can't be read): leave rather than sit on a dead page.
  useEffect(() => {
    if (!loading && gate === 'hidden') onNavigate(viewType === 'property' ? 'memories' : 'dashboard');
  }, [loading, gate, viewType, onNavigate]);

  return (
    <div data-testid="products-page" className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="pt-5 md:px-6 md:pt-6">
        <h1 tabIndex={-1} data-products-focus-fallback className="text-2xl font-semibold text-gray-900 outline-none">Products</h1>
      </div>
      {loading && !status ? (
        <p className="py-10 text-sm text-gray-500 md:px-6">Loading products…</p>
      ) : gate === 'upgrade' ? (
        <div className="mt-6 max-w-xl rounded-xl border border-gray-200 bg-white p-6 md:mx-6">
          <Package className="h-8 w-8 text-[#6C60FF]" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-gray-900">{UPGRADE_LINE}</p>
          <p className="mt-1 text-sm text-gray-600">Upgrade your plan to add products, import them from your website and share them.</p>
          <button type="button" className={`${BUTTON_PRIMARY} mt-4`} onClick={() => requestUpgrade(`${UPGRADE_LINE} Upgrade your plan to use them.`)}>See plans</button>
        </div>
      ) : gate === 'hidden' ? (
        <p className="py-10 text-sm text-gray-500 md:px-6">Products isn't available on your account yet.</p>
      ) : (
        <ProductsReady onNavigate={onNavigate} />
      )}
    </div>
  );
}

// Same look as the Campaigns search box and filter selects (gray-50 fill, gray-200 border, white on focus).
const FIELD = 'h-10 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none transition-colors focus:border-[#6C60FF] focus:bg-white focus-visible:ring-2 focus-visible:ring-[#6C60FF]/20';

// C8 (Chris, 16 Nov): the Website Catalogue connector's brand (components/connectors/catalog.ts brandColors →
// WEBSITE_CATALOG_COLOR #0F766E, white Globe on it, ConnectorIcon), on the primary button's shape.
const IMPORT_BUTTON = BUTTON_PRIMARY.replace('bg-[#6C60FF]', 'bg-[#0F766E]').replace('hover:bg-[#5B50E6]', 'hover:bg-[#0D635C]');

const DEFAULT_FILTERS: Filters = { status: [], sort: 'updated', page: 1 };

/** Post-live P1: a card opens the read-only details view; Edit (and Add a product) the editor. The two swap. */
type Layer =
  | { kind: 'details'; id: number; initial?: ProductDetail; notice?: string }
  | { kind: 'edit'; id: number | null };

const SORTS: Array<[ProductSort, string]> = [['updated', 'Recently updated'], ['newest', 'Newest'], ['title', 'Title A–Z'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];

function ProductsReady({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { status } = useProductsStatus();
  const viewKey = useInventoryViewKey();
  const canCreate = Boolean(status?.can_create);
  const [filters, setFilters] = useState<Filters>(() => ({ ...DEFAULT_FILTERS }));
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<PageData | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [layer, setLayer] = useState<Layer | null>(null);
  const [categorySheet, setCategorySheet] = useState(false);
  const ticket = useRef(0);
  const categoryTicket = useRef(0);
  const keepSelection = useRef(false); // a page clamp after a bulk action keeps what the API skipped selected
  const shownView = useRef(viewKey);
  // Final review M4: which list a bulk action ran on. A new search, filter, sort, page or view moves it on, and a bulk
  // action that finishes after that does not put its old result and selection on the new list.
  const listGen = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => setFilters((f) => ((f.q || '') === search ? f : { ...f, q: search, page: 1 })), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Another inventory view (a salesperson's External view ⇄ the account): its categories and ids differ, so start
  // over. The new filters object reloads the list; the sort stays.
  useEffect(() => {
    if (shownView.current === viewKey) return;
    shownView.current = viewKey;
    setSearch('');
    setFilters((f) => ({ ...DEFAULT_FILTERS, sort: f.sort }));
  }, [viewKey]);

  const load = useCallback(async () => {
    const mine = ++ticket.current;
    setLoading(true);
    const list = await productsAPI.list(filters);
    if (mine !== ticket.current) return; // a newer search / filter answered first
    if (list.ok && list.data) {
      // Emptied the last page (bulk delete / archive under a status filter): go back to the real last page.
      const to = pageToClampTo(filters.page ?? 1, list.data.pagination, list.data.items.length);
      if (to !== null) { keepSelection.current = true; setFilters((f) => ({ ...f, page: to })); return; }
      setResult(list.data);
      setError(null);
    } else setError(list.error || 'Products could not be loaded. Please try again.');
    setLoading(false);
  }, [filters]);
  useEffect(() => { void load(); }, [load]);

  // Categories: on mount, on a view change and after any products change (this page's or another component's).
  const loadCategories = useCallback(async () => {
    const mine = ++categoryTicket.current;
    const cats = await productsAPI.categories();
    if (mine !== categoryTicket.current) return;
    if (cats.ok && cats.data) { setCategories(cats.data.categories); setTotal(cats.data.total); }
  }, []);
  useEffect(() => { void loadCategories(); }, [loadCategories, viewKey]);
  useEffect(() => {
    const onChanged = () => { void loadCategories(); };
    window.addEventListener(PRODUCTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PRODUCTS_CHANGED_EVENT, onChanged);
  }, [loadCategories]);

  useEffect(() => {
    if (keepSelection.current) { keepSelection.current = false; return; }
    listGen.current += 1;
    setSelected([]); // a selection is about the list it was made on: a new search, filter, sort or page clears it
  }, [viewKey, filters]);

  // Final review M6: the change event alone refreshes the Products status (every useProductsStatus, this page's too)
  // and the categories, so this only reloads the list and announces it: list + status + categories, no repeat.
  // Always the CURRENT list: a bulk action or editor that finishes after a new search reloads that search, not the old.
  const loadRef = useRef(load);
  loadRef.current = load;
  const changed = useCallback(async () => { await loadRef.current(); announceProductsChanged(); }, []);
  const items = result?.items ?? [];
  const pagination = result?.pagination;
  const filtered = Boolean(filters.q || filters.category_id || filters.status?.length || filters.source || filters.price_min || filters.price_max || filters.in_stock);
  const selectedItems = items.filter((p) => selected.includes(p.id));
  const ownCategories = categories.filter((c) => !c.read_only);
  const toggle = (p: ProductSummary) => setSelected((s) => (s.includes(p.id) ? s.filter((id) => id !== p.id) : [...s, p.id]));
  const clearSelection = () => setSelected([]);
  const nav = (
    <ProductCategoryNav categories={categories} total={total} selectedId={filters.category_id ?? null} canEdit={canCreate}
      onSelect={(id) => { setFilters((f) => ({ ...f, category_id: id, page: 1 })); setCategorySheet(false); }} onChanged={changed} />
  );
  // On a phone the two buttons don't fit one row, so each wraps onto its own full-width row; from sm up they sit side by side.
  const createButtons = (align: string) => canCreate && (
    <div className={`flex w-full flex-wrap gap-2 sm:w-auto ${align}`}>
      <button type="button" className={`${IMPORT_BUTTON} flex-auto whitespace-nowrap sm:flex-none`} onClick={() => onNavigate('marketplace')}><Globe className="h-4 w-4" aria-hidden="true" />Import from your website</button>
      <button type="button" className={`${BUTTON_PRIMARY} flex-auto whitespace-nowrap sm:flex-none`} onClick={() => setLayer({ kind: 'edit', id: null })}><Plus className="h-4 w-4" aria-hidden="true" />Add a product</button>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-gray-100 bg-white md:block">
        <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto p-3">{nav}</div>
      </aside>
      {/* Phone: pb-24 keeps the pager and any error clear of the floating "+" (App.tsx: 6rem round, 5rem above the
          bar the shell already leaves room for), as MemoryDetailsPage does (pb-24 md:pb-0). */}
      <section className="min-w-0 flex-1 pb-24 md:px-6 md:pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-gray-600">{pagination ? `${pagination.total} ${pagination.total === 1 ? 'product' : 'products'}` : ' '}</p>
          {/* Final review M3: the list's own total too, so a failed /product-categories never hides Add / Import. */}
          {(total > 0 || (pagination?.total ?? 0) > 0 || filtered) && createButtons('')}
        </div>
        {/* Toolbar laid out like the Campaigns search + filters row: search full width on a phone, controls below it. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-auto sm:min-w-[12rem] sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Search products" placeholder="Search by title, SKU or brand" value={search} onChange={(e) => setSearch(e.target.value)} className={`${FIELD} w-full pl-10 pr-3 placeholder:text-gray-400`} />
          </label>
          <button type="button" className={`${BUTTON_SECONDARY} flex-1 sm:flex-none md:hidden`} onClick={() => setCategorySheet(true)}><Folder className="h-4 w-4" aria-hidden="true" />Categories</button>
          <div className="flex-1 sm:flex-none [&>button]:w-full"><ProductFilters value={filters} statuses={filterStatusesFor(canCreate)} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} /></div>
          {/* Campaigns' filter dropdown (MemoriesPage "All Categories" / authors / labels). */}
          <div className="w-full sm:w-48"><ProductSelect label="Sort" value={filters.sort || 'updated'} className={`h-10 w-full text-sm ${FILTER_TRIGGER}`}
            options={SORTS.map(([value, label]) => ({ value, label }))} onChange={(v) => setFilters((f) => ({ ...f, sort: v as ProductSort, page: 1 }))} /></div>
        </div>
        {selectedItems.length > 0 && (
          <ProductBulkBar selected={selectedItems} categories={ownCategories} onClear={clearSelection} ticket={listGen.current}
            onDone={async ({ message, keepIds, ticket }) => {
              // Chris, 16 Nov: the result is a toast (Studio's pattern), not a box with Dismiss. What the API skipped stays selected.
              if (keepIds.length) toast.warning(message); else toast.success(message);
              if (ticket === listGen.current) setSelected(keepIds);
              await changed(); // the products changed either way
            }} />
        )}
        {loading && !result ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading products…</p>
        ) : !result ? null /* the list could not be read: only the error below shows, not a misleading "No products yet" */ : items.length === 0 ? (
          filtered ? (
            // Campaigns' "No campaigns found" empty state (AllMemoriesEmptyState), with the products' words.
            <AllMemoriesEmptyState title="No products found" subtitle="Try adjusting your search or filter criteria"
              onClearFilters={() => { setSearch(''); setFilters({ status: [], sort: filters.sort, page: 1 }); }} />
          ) : (
            // The first-run state, laid out like AllMemoriesEmptyState (icon, heading, line, buttons) with the spec's two actions.
            <div className="px-6 py-12 text-center">
              <div className="mb-4 flex justify-center"><Package className="h-12 w-12 text-gray-400" strokeWidth={1.5} aria-hidden="true" /></div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">No products yet</h3>
              <p className="mb-6 text-gray-600">Add your own products, or import them from your website.</p>
              {createButtons('justify-center')}
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-4">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} selectable={!p.read_only} selected={selected.includes(p.id)} onToggle={() => toggle(p)} onOpen={() => setLayer({ kind: 'details', id: p.id })} />
            ))}
          </div>
        )}
        {pagination && pagination.last_page > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            <button type="button" className={BUTTON_SECONDARY} disabled={pagination.current_page <= 1} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}>Previous</button>
            <span className="text-gray-600">Page {pagination.current_page} of {pagination.last_page}</span>
            <button type="button" className={BUTTON_SECONDARY} disabled={pagination.current_page >= pagination.last_page} onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}>Next</button>
          </div>
        )}
        {error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>
      <Sheet open={categorySheet} onOpenChange={setCategorySheet}>
        <SheetContent side="bottom" aria-describedby={undefined} className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]">
          {/* The nav's own "Categories" label is the visible heading; the title is for screen readers. */}
          <SheetHeader className="sr-only"><SheetTitle>Categories</SheetTitle></SheetHeader>
          <div className="p-2 pt-4">{nav}</div>
        </SheetContent>
      </Sheet>
      {/* The search, filters, page and selection behind these layers stay as they were: closing comes back to them. */}
      {layer?.kind === 'details' && (
        <ProductDetails key={`details-${layer.id}`} productId={layer.id} initial={layer.initial} notice={layer.notice}
          onClose={() => setLayer(null)} onEdit={(id) => setLayer({ kind: 'edit', id })} onDuplicated={(id) => setLayer({ kind: 'edit', id })} onChanged={changed} />
      )}
      {layer?.kind === 'edit' && (
        <ProductEditor key={layer.id ?? 'new'} productId={layer.id} categories={ownCategories} defaultCurrency={status?.default_currency || DEFAULT_CURRENCY}
          onClose={() => setLayer(layer.id ? { kind: 'details', id: layer.id } : null)} onChanged={changed}
          onOpen={(id, d) => setLayer({ kind: 'details', id, initial: d, notice: 'Saved. Use Edit to add photos.' }) /* review minor 4: no reload */}
          onSaved={(d) => setLayer({ kind: 'details', id: d.id, initial: d, notice: 'Saved.' })} />
      )}
    </div>
  );
}
