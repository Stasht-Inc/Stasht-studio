// components/products/ProductPageControls.tsx — a product's actions and details on the product page (Chris 17 Nov 2026,
// workstream D). A product now opens the SAME page as a Serpa car and a catalogue item (pages/MemoryDetailsPage,
// `product:<id>`), not a screen of its own. Everything the old details screen let an owner do is here, placed the way
// that page places its actions: Edit and ⋯ (Edit settings, Duplicate, Archive / Unarchive, Delete with its confirm) —
// same rules as before (utils/products detailActions: none in a salesperson's External view). Edit opens the same
// product editor. ProductPageDetails is the page's details/specs block (Chris 20 Nov 2026: always on the page, so
// everything entered in the editor shows there); ProductBuyButton its Buy link as a button; setCover* its Edit Cover.
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Archive, ArchiveRestore, Copy, Edit, MoreHorizontal, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { productsAPI, type ProductCategory, type ProductDetail, type ProductStatus } from '../../services/productsAPI';
import { announceProductsChanged, useProductsStatus } from '../../hooks/useProductsStatus';
import { DEFAULT_CURRENCY, detailActions, mediaOrderWithFirst, productBuyButton, productCoverEditable, productCoverRemovable, productPageDescription, productPageSpecs } from '../../utils/products';
import ProductCardButton from '../ProductCardButton';
import { TEXT_CLASS, renderTextNodes } from '../newsletters/blocks/TextBlockEditor';
import { parseTextHtml } from '../newsletters/lib/textHtml';
import ProductEditor from './ProductEditor';

type Layer = { kind: 'edit'; id: number; copy: boolean } | { kind: 'delete' } | null;

export interface ProductPageControls {
  actions: ReturnType<typeof detailActions> | null;
  busy: boolean;
  edit(): void;
  duplicate(): void;
  setArchived(archived: boolean): void;
  askDelete(): void;
  /** The editor and the delete confirm: render once on the page. */
  layers: ReactElement | null;
  /** Edit Cover (Chris 20 Nov 2026, point 16): offered for the owner's own product whose media can change. */
  coverEditable: boolean;
  /** Add this photo / video to the product and make it the first media item (the cover). Resolves true when done. */
  setCoverFile(file: File): Promise<boolean>;
  /** The same from a Media Library item's web address (read through the page's own /s3-proxy for S3 files). */
  setCoverFromUrl(url: string, fetchUrl?: string): Promise<boolean>;
  /** Remove cover (Chris 20 Nov 2026, I10): offered while the product shows one of its photos / its video as cover. */
  coverRemovable: boolean;
  /** Show the brand as the cover; every photo / video stays (moments, gallery). Resolves true when done. */
  removeCover(): Promise<boolean>;
}

/**
 * @param onReload re-read the product (after a save, an archive)
 * @param onBack leave the page (after a delete): back to the Products page
 * @param onOpenProduct show another product's page (the copy Duplicate made)
 */
export function useProductPageControls({ detail, onReload, onBack, onOpenProduct }: {
  detail: ProductDetail | null;
  onReload(): void;
  onBack(): void;
  onOpenProduct?(id: number): void;
}): ProductPageControls {
  const [layer, setLayer] = useState<Layer>(null);
  const [busy, setBusy] = useState(false);
  const actions = detail ? detailActions(detail) : null;

  const edit = useCallback(() => { if (detail) setLayer({ kind: 'edit', id: detail.id, copy: false }); }, [detail]);
  const setArchived = useCallback(async (archived: boolean) => {
    if (!detail || busy) return;
    setBusy(true);
    const status: ProductStatus = archived ? 'archived' : 'active';
    const r = await productsAPI.update(detail.id, { status });
    setBusy(false);
    if (!r.ok || !r.data) { toast.error(r.fieldErrors?.status || r.error || 'The status could not be changed. Please try again.'); return; }
    toast.success(r.data.status === 'archived' ? 'Archived.' : 'Unarchived.');
    announceProductsChanged();
    onReload();
  }, [detail, busy, onReload]);
  const duplicate = useCallback(async () => {
    if (!detail || busy) return;
    setBusy(true);
    const r = await productsAPI.duplicate(detail.id);
    setBusy(false);
    if (!r.ok || !r.data) { toast.error(r.error || 'The product could not be duplicated. Please try again.'); return; }
    announceProductsChanged();
    setLayer({ kind: 'edit', id: r.data.id, copy: true }); // the copy opens in the editor, as before
  }, [detail, busy]);
  const remove = useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    const r = await productsAPI.remove(detail.id);
    setBusy(false);
    if (!r.ok) { toast.error(r.error || 'The product could not be deleted. Please try again.'); return; }
    toast.success('Deleted.');
    announceProductsChanged();
    onBack();
  }, [detail, onBack]);

  // Edit Cover: upload the pick to the product's media (the editor's own route, same limits: 20 photos, one video), then
  // put it first, so it is the product's main photo / cover everywhere. One toast per step, the page re-read after.
  const coverEditable = productCoverEditable(detail);
  const setCoverFile = useCallback(async (file: File): Promise<boolean> => {
    if (!detail || !coverEditable) return false;
    const before = new Set((detail.media || []).map((m) => m.id));
    const toastId = toast.loading('Updating the cover…');
    const up = await productsAPI.uploadMedia(detail.id, file);
    if (!up.ok || !up.data) { toast.error(up.error || 'The cover could not be changed. Please try again.', { id: toastId }); return false; }
    const added = up.data.media.find((m) => !before.has(m.id));
    if (added) {
      const order = mediaOrderWithFirst(up.data.media, added.id);
      if (order[0] !== [...up.data.media].sort((a, b) => a.sort_order - b.sort_order)[0]?.id) {
        const r = await productsAPI.orderMedia(detail.id, order);
        if (!r.ok) { toast.error(r.error || 'The photo was added, but it could not be made the cover. Drag it first in the editor.', { id: toastId }); announceProductsChanged(); onReload(); return false; }
      }
    }
    toast.success('Cover updated.', { id: toastId });
    announceProductsChanged();
    onReload();
    return true;
  }, [detail, coverEditable, onReload]);
  const setCoverFromUrl = useCallback(async (url: string, fetchUrl?: string): Promise<boolean> => {
    let file: File;
    try {
      const res = await fetch(fetchUrl || url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = decodeURIComponent((url.split('?')[0].split('/').pop() || 'cover').slice(0, 120)) || 'cover';
      file = new File([blob], /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`, { type: blob.type || 'image/jpeg' });
    } catch {
      toast.error('That file could not be read. Please try again, or upload it from your computer.');
      return false;
    }
    return setCoverFile(file);
  }, [setCoverFile]);

  // Remove cover (I10): the brand shows instead, on the page and the Products card; the photos stay where they are.
  const coverRemovable = productCoverRemovable(detail);
  const removeCover = useCallback(async (): Promise<boolean> => {
    if (!detail || !coverRemovable) return false;
    const r = await productsAPI.removeCover(detail.id);
    if (!r.ok) { toast.error(r.error || 'The cover could not be removed. Please try again.'); return false; }
    toast.success('Cover removed.');
    announceProductsChanged();
    onReload();
    return true;
  }, [detail, coverRemovable, onReload]);

  // Closing the copy's editor (saved or not) shows the copy's page, as the old screen showed its details.
  const closeEditor = (saved: boolean) => {
    const was = layer;
    setLayer(null);
    if (was?.kind === 'edit' && was.copy && onOpenProduct) { onOpenProduct(was.id); return; }
    if (saved) toast.success('Saved.');
    onReload(); // also after a close: the editor's photo changes are saved as they're made
  };

  const layers = (
    <>
      {layer?.kind === 'edit' && <ProductPageEditor id={layer.id} onClose={() => closeEditor(false)} onSaved={() => closeEditor(true)} />}
      <AlertDialog open={layer?.kind === 'delete'} onOpenChange={(open) => { if (!open) setLayer(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>Campaigns that already show it keep their moments. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => { setLayer(null); void remove(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return {
    actions, busy, edit,
    duplicate: () => { void duplicate(); },
    setArchived: (archived) => { void setArchived(archived); },
    askDelete: () => setLayer({ kind: 'delete' }),
    layers: detail ? layers : null,
    coverEditable, setCoverFile, setCoverFromUrl, coverRemovable, removeCover,
  };
}

/** The same product editor the Products page uses; its categories and currency are read when it opens. */
function ProductPageEditor({ id, onClose, onSaved }: { id: number; onClose(): void; onSaved(): void }) {
  const { status } = useProductsStatus();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  useEffect(() => {
    let cancelled = false;
    void productsAPI.categories().then((r) => { if (!cancelled && r.ok && r.data) setCategories(r.data.categories); });
    return () => { cancelled = true; };
  }, []);
  const own = useMemo(() => categories.filter((c) => !c.read_only), [categories]);
  return (
    <ProductEditor productId={id} categories={own} defaultCurrency={status?.default_currency || DEFAULT_CURRENCY}
      onClose={onClose} onChanged={async () => { announceProductsChanged(); }}
      onOpen={() => onSaved()} onSaved={() => onSaved()} />
  );
}

// The page's own button looks: desktop = its top bar's Edit (white, gray border); phone = the pills on the cover
// (Back · Edit Cover · ⋯ on a campaign). The menu is the page's own dropdown (its campaign ⋯ menu).
const DESKTOP_BUTTON = 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 disabled:opacity-50 disabled:cursor-not-allowed';
const PHONE_PILL = 'bg-black/50 backdrop-blur-sm border-transparent text-white hover:bg-black/70 hover:text-white shadow-lg text-[14px] !h-auto !py-1.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed';
const MENU = 'w-[196px] bg-white/80 border border-black/10 rounded-[27px] shadow-xl p-1 [backdrop-filter:blur(20px)] [-webkit-backdrop-filter:blur(20px)] z-[60]';
const MENU_ITEM = 'flex items-center gap-3 px-4 py-3 text-sm text-[#0A0A0A] hover:bg-gray-50 cursor-pointer rounded-2xl';

/** Edit and ⋯ for the page's header. `edit` false leaves Edit out (the phone has its own Edit on the cover). */
export function ProductPageActions({ controls, variant, edit = true }: { controls: ProductPageControls; variant: 'desktop' | 'phone'; edit?: boolean }) {
  const a = controls.actions;
  if (!a) return null;
  const phone = variant === 'phone';
  return (
    <>
      {edit && a.edit && (
        <Button variant="ghost" size="sm" onClick={controls.edit} disabled={controls.busy} className={phone ? `${PHONE_PILL} !px-4` : DESKTOP_BUTTON}>
          <Edit className={phone ? 'w-3 h-3 mr-1' : 'w-4 h-4 mr-2'} />
          Edit
        </Button>
      )}
      {a.menu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="More actions" disabled={controls.busy} className={phone ? `${PHONE_PILL} !px-2` : `${DESKTOP_BUTTON} !px-2.5`}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={phone ? 'start' : 'end'} className={MENU} style={{ boxShadow: '0px 4px 16px rgba(0,0,0,0.08), 0px 0px 4px rgba(0,0,0,0.04)' }}>
            {a.settings && <DropdownMenuItem className={MENU_ITEM} onSelect={controls.edit}><SlidersHorizontal className="w-4 h-4" />Edit settings</DropdownMenuItem>}
            {a.duplicate && <DropdownMenuItem className={MENU_ITEM} onSelect={controls.duplicate}><Copy className="w-4 h-4" />Duplicate</DropdownMenuItem>}
            {a.archive && (
              <DropdownMenuItem className={MENU_ITEM} onSelect={() => controls.setArchived(a.archive === 'archive')}>
                {a.archive === 'unarchive' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                {a.archive === 'unarchive' ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
            )}
            {a.remove && <DropdownMenuItem className={`${MENU_ITEM} !text-red-600`} onSelect={controls.askDelete}><Trash2 className="w-4 h-4 text-red-600" />Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

/** The product's Buy link as a button (Chris 20 Nov 2026, point 15), in the owner's words ("Buy now" when none) — the
 *  same button a product moment's "View on website" is (components/ProductCardButton). Nothing without a usable link. */
export function ProductBuyButton({ detail, className = '' }: { detail: ProductDetail; className?: string }) {
  const buy = productBuyButton(detail);
  if (!buy) return null;
  return (
    <div data-testid="product-buy-button" className={className}>
      <ProductCardButton button={{ id: 'buy', buttonText: buy.label, buttonLink: buy.href, icon: 'ExternalLink' }} />
    </div>
  );
}

/**
 * The page's details/specs block — the photo viewer's Description and spec grid (components/ImageViewer, where a car
 * shows its mileage and engine), in the same markup. Chris 20 Nov 2026 (points 13, 14): always on the product page, so
 * what was entered in the editor shows there (short + full description, price, facts, categories, specifications,
 * variants, tags) — never the owner's own settings. Nothing when the product has none of it.
 */
export function ProductPageDetails({ detail, className = '' }: { detail: ProductDetail; className?: string }) {
  const specs = productPageSpecs(detail);
  const nodes = useMemo(() => (detail.description_html ? renderTextNodes(parseTextHtml(detail.description_html)) : null), [detail.description_html]);
  const short = (detail.short_description || '').trim();
  const full = (detail.description || '').trim();
  const plain = productPageDescription(detail);
  const hasDescription = Boolean(short || nodes?.length || full || plain);
  if (!hasDescription && !specs.length) return null;
  return (
    <section data-testid="product-page-details" aria-label="Details" className={`bg-white rounded-2xl md:border md:border-gray-200 p-5 md:p-6 ${className}`}>
      {hasDescription && (
        <>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
          {short && <p data-testid="product-page-short" className="text-base text-gray-900 font-medium leading-relaxed mb-3 break-words whitespace-pre-wrap">{short}</p>}
          {nodes?.length
            ? <div data-testid="product-page-full" className={`${TEXT_CLASS} mb-4`}>{nodes}</div>
            : (full || (!short && plain)) && <p data-testid="product-page-full" className="text-base text-gray-700 leading-relaxed mb-4 break-words whitespace-pre-wrap">{full || plain}</p>}
        </>
      )}
      {specs.length > 0 && (
        <div className={`grid grid-cols-2 gap-x-4 gap-y-3 ${hasDescription ? 'pt-4 border-t border-gray-200' : ''}`}>
          {specs.map((spec, i) => (
            <div key={`${i}-${spec.label}`} data-testid="product-page-spec">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{spec.label}</p>
              <p className="text-sm text-gray-900 font-medium break-words">{spec.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
