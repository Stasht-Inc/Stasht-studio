import { useEffect, useState } from 'react';
import { ExternalLink, Store } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { catalogueAPI, type CatalogueItemDetail } from '../services/catalogueAPI';

interface CatalogItemDetailModalProps {
  // The item to show; null = closed.
  itemId: number | null;
  onClose: () => void;
}

// Read-only detail of one Website Catalogue item (spec 2026-09-30 §9.1): gallery, price,
// attribute table and a "View on website" link. Browse-only, like the Cars catalogue.
export default function CatalogItemDetailModal({ itemId, onClose }: CatalogItemDetailModalProps) {
  const [item, setItem] = useState<CatalogueItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (itemId == null) return;
    let cancelled = false;
    setItem(null);
    setError(null);
    setActivePhoto(0);
    setLoading(true);
    catalogueAPI.getItem(itemId).then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setItem(res.data);
      else setError(res.error || 'This item could not be loaded.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [itemId]);

  const photos = item
    ? (item.images.length > 0 ? item.images.map((p) => p.url) : item.main_image ? [item.main_image] : [])
    : [];
  const subtitle = item ? [item.category, item.brand].filter(Boolean).join(' · ') : '';

  return (
    <Dialog open={itemId != null} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden bg-white rounded-2xl shadow-xl">
        <DialogHeader className="px-6 pt-6 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {item?.title || (loading ? 'Loading item…' : 'Catalogue item')}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">{subtitle || 'From your Website Catalogue'}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {loading && (
            <div className="flex justify-center py-14" role="status" aria-label="Loading item">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6C60FF]" />
            </div>
          )}
          {!loading && error && <p className="text-center text-sm text-gray-600 py-10">{error}</p>}
          {!loading && item && (
            <div className="space-y-5">
              <div>
                <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                  {photos.length > 0 ? (
                    <ImageWithFallback
                      src={photos[activePhoto]}
                      alt={item.title}
                      className="w-full h-full object-contain"
                      fallback={<Store className="w-10 h-10 text-gray-300" aria-hidden="true" />}
                    />
                  ) : (
                    <Store className="w-10 h-10 text-gray-300" aria-hidden="true" />
                  )}
                </div>
                {photos.length > 1 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {photos.map((url, i) => (
                      <button
                        key={`${i}-${url}`}
                        type="button"
                        onClick={() => setActivePhoto(i)}
                        aria-label={`Show photo ${i + 1}`}
                        aria-pressed={i === activePhoto}
                        className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] ${
                          i === activePhoto ? 'border-[#6C60FF]' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <ImageWithFallback src={url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {item.price_label && <p className="text-xl font-semibold text-gray-900">{item.price_label}</p>}
              {item.description && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{item.description}</p>}

              {(item.attributes.length > 0 || item.sku) && (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-100">
                    {item.attributes.map((a) => (
                      <tr key={a.label}>
                        <th scope="row" className="py-2 pr-4 w-1/3 text-left font-normal text-gray-500 align-top">{a.label}</th>
                        <td className="py-2 text-gray-900">{a.value}</td>
                      </tr>
                    ))}
                    {item.sku && (
                      <tr>
                        <th scope="row" className="py-2 pr-4 w-1/3 text-left font-normal text-gray-500 align-top">SKU</th>
                        <td className="py-2 text-gray-900">{item.sku}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {item?.url && /^https?:\/\//i.test(item.url) && (
          <div className="border-t border-gray-100 px-6 py-4">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-11 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-2"
            >
              View on website
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
