// components/products/ProductPageControls.tsx — a product's actions and details on the product page (Chris 17 Nov 2026,
// workstream D). A product now opens the SAME page as a Serpa car and a catalogue item (pages/MemoryDetailsPage,
// `product:<id>`), not a screen of its own. Everything the old details screen let an owner do is here, placed the way
// that page places its actions: Edit and ⋯ (Edit settings, Duplicate, Archive / Unarchive, Delete with its confirm) —
// same rules as before (utils/products detailActions: none in a salesperson's External view). Edit opens the same
// product editor. ProductPageDetails is the page's details/specs block for a product whose photos are hidden.
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Archive, ArchiveRestore, Copy, Edit, MoreHorizontal, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { productsAPI, type ProductCategory, type ProductDetail, type ProductStatus } from '../../services/productsAPI';
import { announceProductsChanged, useProductsStatus } from '../../hooks/useProductsStatus';
import { DEFAULT_CURRENCY, detailActions, productPageDescription, productPageSpecs } from '../../utils/products';
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

/**
 * The page's details/specs block — the photo viewer's Description and spec grid (components/ImageViewer, where a car
 * shows its mileage and engine), in the same markup — shown on the page itself when the product's photos are hidden
 * ("Show photos" off): there are no photos to open the viewer from.
 */
export function ProductPageDetails({ detail }: { detail: ProductDetail }) {
  const specs = productPageSpecs(detail);
  const nodes = useMemo(() => (detail.description_html ? renderTextNodes(parseTextHtml(detail.description_html)) : null), [detail.description_html]);
  const plain = productPageDescription(detail);
  return (
    <section data-testid="product-page-details" aria-label="Details" className="bg-white rounded-2xl md:border md:border-gray-200 p-5 md:p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Description</h3>
      {detail.short_description && <p className="text-base text-gray-700 leading-relaxed mb-3 break-words whitespace-pre-wrap">{detail.short_description}</p>}
      {nodes?.length
        ? <div className={`${TEXT_CLASS} mb-4`}>{nodes}</div>
        : (detail.description || (!detail.short_description && plain)) && <p className="text-base text-gray-700 leading-relaxed mb-4 break-words whitespace-pre-wrap">{detail.description || plain}</p>}
      {specs.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-gray-200">
          {specs.map((spec, i) => (
            <div key={`${i}-${spec.label}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{spec.label}</p>
              <p className="text-sm text-gray-900 font-medium break-words">{spec.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
