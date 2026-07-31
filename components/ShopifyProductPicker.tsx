import { useState, useEffect, useCallback } from 'react';
import { X, Search, RefreshCw, Check, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { dashboardAPI } from '../utils/authUtils';

// A synced Shopify product (subset of the /shopify/products payload we care about).
export interface ShopifyProduct {
  id: number | string;
  title: string;
  description?: string;
  category?: string;
  vendor?: string;
  status?: string;
  handle?: string;
  price?: string;
  currency?: string;
  image?: string;
  images?: string[];
  variants?: any[];
}

interface ShopifyProductPickerProps {
  isOpen: boolean;
  onClose: () => void;
  // Called with the chosen products + the connected store domain (for building product URLs).
  onAdd: (products: ShopifyProduct[], shopDomain: string | null) => void;
}

// Strip HTML tags for a plain-text description preview.
function stripHtml(html?: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatPrice(price?: string, currency?: string): string {
  if (!price) return '';
  const cur = currency || '';
  return cur ? `${cur} ${price}` : price;
}

export default function ShopifyProductPicker({ isOpen, onClose, onAdd }: ShopifyProductPickerProps) {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null); // null = unknown/loading
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadProducts = useCallback(async (filters?: { search?: string; category?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardAPI.shopifyGetProducts({
        search: filters?.search || undefined,
        category: filters?.category || undefined,
      });
      if (res.success && res.data?.products) {
        setProducts(res.data.products);
      } else {
        setError(res.error || 'Failed to load products');
        setProducts([]);
      }
    } catch {
      setError('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // On open: check connection, load collections + products.
  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
    setSearch('');
    setCategory('');
    (async () => {
      try {
        const status = await dashboardAPI.shopifyGetStatus();
        const isConnected = !!(status.success && status.data?.connected);
        setConnected(isConnected);
        setShopDomain(status.data?.shop_domain || null);
        if (!isConnected) return;
      } catch {
        setConnected(false);
        return;
      }
      dashboardAPI.shopifyGetListings()
        .then(res => { if (res.success && res.data?.collections) setCollections(res.data.collections); })
        .catch(() => {});
      loadProducts();
    })();
  }, [isOpen, loadProducts]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await dashboardAPI.shopifySync();
      if (res.success) {
        toast.success(res.data?.message || 'Products synced');
        await loadProducts({ search, category });
      } else {
        toast.error(res.error || 'Failed to sync products');
      }
    } catch {
      toast.error('Failed to sync products');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const chosen = products.filter(p => selectedIds.has(String(p.id)));
    if (chosen.length === 0) { toast.error('Select at least one product'); return; }
    onAdd(chosen, shopDomain);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100002] p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(145deg, #95BF47, #5E8E3E)' }}>
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Add Shopify Products</h2>
              <p className="text-sm text-gray-500">Select products to add to this campaign</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not connected state */}
        {connected === false ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
            <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Shopify not connected</h3>
            <p className="text-gray-500 text-sm max-w-sm">
              Connect your Shopify store from the Connectors page, then come back to add products.
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar: search + category + sync */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-shrink-0 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadProducts({ search, category }); }}
                  placeholder="Search products..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
                />
              </div>
              {collections.length > 0 && (
                <select
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); loadProducts({ search, category: e.target.value }); }}
                  className="py-2 px-3 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/20 focus:border-[#6C60FF]"
                >
                  <option value="">All categories</option>
                  {collections.map((c: any) => (
                    <option key={c.id} value={c.title}>{c.title}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => loadProducts({ search, category })}
                className="py-2 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Search
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="py-2 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 text-[#6C60FF] animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-16">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">{error}</p>
                  <button onClick={() => loadProducts({ search, category })} className="mt-3 text-sm text-[#6C60FF] font-medium hover:underline">Try again</button>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-700 font-medium">No products found</p>
                  <p className="text-gray-500 text-sm mt-1">Try syncing or adjusting your search.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {products.map((p) => {
                    const id = String(p.id);
                    const isSelected = selectedIds.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleSelect(id)}
                        className={`text-left rounded-xl border overflow-hidden transition-all ${isSelected ? 'border-[#6C60FF] ring-2 ring-[#6C60FF]/30' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className="relative aspect-square bg-gray-100">
                          {p.image ? (
                            <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-gray-300" /></div>
                          )}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#6C60FF] flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.title}</p>
                          <p className="text-xs text-gray-500 line-clamp-1">{stripHtml(p.description) || '—'}</p>
                          <p className="text-sm font-semibold text-[#6C60FF] mt-1">{formatPrice(p.price, p.currency)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <p className="text-sm text-gray-500">{selectedIds.size} selected</p>
              <div className="flex gap-3">
                <button onClick={onClose} className="py-2.5 px-6 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={selectedIds.size === 0}
                  className="py-2.5 px-6 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FFF] disabled:opacity-50 text-white font-semibold text-sm"
                >
                  Add {selectedIds.size > 0 ? selectedIds.size : ''} to campaign
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
