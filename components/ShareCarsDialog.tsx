import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { dashboardAPI } from '../utils/authUtils';
import { formatCarCategory } from '../utils/carCategories';
import { leadsAPI } from '../services/leadsAPI';

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

// Dropdown value for "no category filter".
const ALL_CATEGORIES = 'all';

// Shown pre-filled in the name field and used by the server when the name is left blank.
const DEFAULT_CAMPAIGN_NAME = 'Vehicles Just for You';

interface ShareCarsDialogProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadName: string;
  // Called after a successful share so the caller can refresh the thread.
  onShared: () => void;
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
// rep (default "Vehicles Just for You"), via POST /leads/{id}/share-cars. Each
// share gets its own campaign and link — never added to the lead's old one.
// A category dropdown (the categories the dealer's inventory actually has, e.g.
// "Preowned (26)", "Hybrid (21)") narrows the list; selections survive switching.
export default function ShareCarsDialog({ open, onClose, leadId, leadName, onShared }: ShareCarsDialogProps) {
  const [cars, setCars] = useState<CarListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
        setLoadError(res.error || res.message || 'Could not load your car inventory.');
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
      if (seq === loadSeq.current) setLoadError('Could not load your car inventory.');
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  };

  // Fresh inventory + a clean slate every time the dialog opens — stock changes
  // between visits and a stale selection would silently carry over.
  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch('');
    setCampaignName(DEFAULT_CAMPAIGN_NAME);
    setCategory(ALL_CATEGORIES);
    setCategories([]);
    setIsComplete(true);
    loadCars(undefined, true);
    return () => { loadSeq.current++; };
  }, [open]);

  const handleCategoryChange = (next: string) => {
    setCategory(next);
    if (!isComplete) loadCars(next === ALL_CATEGORIES ? undefined : next);
  };

  // Per-category counts, only when the list is the whole inventory (otherwise they'd lie).
  const counts = useMemo(() => {
    if (!isComplete) return null;
    const m: Record<string, number> = {};
    cars.forEach((c) => { if (c.category) m[c.category] = (m[c.category] || 0) + 1; });
    return m;
  }, [cars, isComplete]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cars.filter((c) => {
      if (category !== ALL_CATEGORIES && c.category !== category) return false;
      if (!q) return true;
      return [c.title, c.make, c.model].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [cars, search, category]);

  const emptyText =
    cars.length === 0 && category === ALL_CATEGORIES
      ? 'No cars in your inventory yet.'
      : category !== ALL_CATEGORIES && !search.trim()
        ? 'No cars in this category.'
        : 'No cars match your search.';

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShare = async () => {
    if (selected.size === 0 || isSharing) return;
    setIsSharing(true);
    try {
      const name = campaignName.trim();
      const res = await leadsAPI.shareCars(leadId, Array.from(selected), name || undefined);
      if (res.success) {
        const shared = typeof res.data?.cars_total === 'number' ? res.data.cars_total : selected.size;
        const carWord = shared === 1 ? 'car' : 'cars';
        // Only claim a new campaign when the server says it made one — an older backend
        // (not yet deployed) still appends to the lead's campaign and returns no `campaign`.
        toast.success(
          res.data?.campaign
            ? `Sent ${leadName} ${shared} ${carWord} in a new campaign, "${res.data.campaign.title}".`
            : `Shared ${shared} ${carWord} with ${leadName}.`,
        );
        onShared();
        onClose();
      } else {
        toast.error(res.message || res.error || 'Could not share cars.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not share cars.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !isSharing) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-white rounded-2xl shadow-xl">
        <DialogHeader className="px-6 pt-6 pb-3 pr-12">
          <DialogTitle>Share New Cars</DialogTitle>
          <DialogDescription>
            Creates a new campaign with the cars you pick and sends {leadName} its own link.
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
            placeholder={DEFAULT_CAMPAIGN_NAME}
            className="w-full h-10 px-3 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-500 border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
          />
        </div>

        {categories.length > 1 && (
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
              placeholder="Search your inventory..."
              aria-label="Search your inventory"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-gray-100 text-sm text-gray-700 placeholder:text-gray-500 border-none outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
          {isLoading ? (
            <div className="flex justify-center py-14" role="status" aria-label="Loading your inventory">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C60FF]" />
            </div>
          ) : loadError ? (
            <p className="text-center text-sm text-gray-600 py-10">{loadError}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-600 py-10">
              {emptyText}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((c) => {
                const isSel = selected.has(c.id);
                const subtitle = carSubtitle(c);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSel}
                      onClick={() => toggle(c.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] ${
                        isSel ? 'bg-[#F5F2FF] border-[1.5px] border-[#6C60FF]' : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex items-center justify-center w-5 h-5 shrink-0 rounded border ${
                          isSel ? 'bg-[#6C60FF] border-[#6C60FF] text-white' : 'bg-white border-gray-300'
                        }`}
                      >
                        {isSel && <Check className="w-3.5 h-3.5" />}
                      </span>
                      {c.main_image ? (
                        <img src={c.main_image} alt="" className="w-11 h-11 rounded-md object-cover shrink-0" />
                      ) : (
                        <span aria-hidden="true" className="w-11 h-11 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                          <Car className="w-5 h-5 text-gray-400" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{c.title || 'Untitled car'}</span>
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
          <button
            type="button"
            onClick={handleShare}
            disabled={selected.size === 0 || isSharing}
            className="w-full h-11 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-2"
          >
            {isSharing
              ? 'Sharing...'
              : selected.size === 0
                ? 'Select cars to share'
                : `Share ${selected.size} ${selected.size === 1 ? 'Car' : 'Cars'}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
