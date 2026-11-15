// components/products/ProductDetails.tsx — the read-only product details view (post-live P1, 15 Nov). A product card
// opens this; Edit opens today's ProductEditor (ProductsPage swaps the two layers). Same frame as the editor: a
// full-screen layer with a focus trap, Escape and the browser's Back to close.
// Manual product: Edit + ⋯ (Duplicate, Archive / Unarchive, Delete — the actions and confirms that were in the editor).
// Website product: no Edit, a line that it updates from the website; ⋯ keeps Duplicate, Archive / Unarchive and
// "Edit settings" (the editor's Studio-only fields). Salesperson External view: read-only, no Edit and no ⋯.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { Archive, ArchiveRestore, ArrowLeft, Copy, ExternalLink, MoreHorizontal, Package, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import { productsAPI, type ProductDetail, type ProductStatus } from '../../services/productsAPI';
import { useBackToClose } from '../newsletters/hooks/useBackToClose';
import { BADGE_CLASS, BADGE_LABEL, WEBSITE_SYNC_NOTE, detailActions, detailFacts, priceLine, sourceLabel, variantLabel } from '../../utils/products';
import { WEBSITE_CATALOG_COLOR } from '../../utils/categoryColorManager';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LINK_BUTTON } from '../newsletters/lib/ui';
import { TEXT_CLASS, renderTextNodes } from '../newsletters/blocks/TextBlockEditor';
import { parseTextHtml } from '../newsletters/lib/textHtml';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { captureOpener, releaseOpener } from './layerFocus';

const isWebUrl = (u: string | null | undefined): u is string => Boolean(u && /^https?:\/\//i.test(u));

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      {title && <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>}
      {children}
    </section>
  );
}

export default function ProductDetails({ productId, initial, notice, onClose, onEdit, onDuplicated, onChanged }: {
  productId: number;
  /** The copy the editor just saved: shown at once, no reload. */
  initial?: ProductDetail | null;
  /** A line for the bottom of the card when the view opens ("Saved."). */
  notice?: string | null;
  onClose(): void;
  onEdit(id: number): void;
  /** Duplicate made a copy: open it (in the editor, as before). */
  onDuplicated(id: number): void;
  onChanged(): Promise<void>;
}) {
  const seeded = initial && initial.id === productId ? initial : null;
  const [detail, setDetail] = useState<ProductDetail | null>(seeded);
  const [loading, setLoading] = useState(!seeded);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(notice ? { kind: 'ok', text: notice } : null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shown, setShown] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seeded) return undefined;
    let cancelled = false;
    setLoading(true);
    productsAPI.get(productId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok && r.data) setDetail(r.data);
      else setMessage({ kind: 'error', text: r.error || 'This product could not be opened. Please try again.' });
    });
    return () => { cancelled = true; };
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A full-screen layer, like the editor: the page behind doesn't scroll; focus goes back to the opener at the end.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    captureOpener();
    return () => { document.body.style.overflow = before; releaseOpener(); };
  }, []);

  const media = useMemo(() => [...(detail?.media || [])].sort((a, b) => a.sort_order - b.sort_order), [detail]);
  useEffect(() => { if (shown >= media.length) setShown(0); }, [media.length, shown]);
  const actions = detail ? detailActions(detail) : null;
  const website = detail?.origin === 'website';
  const readOnly = Boolean(detail?.read_only);

  // Back / Escape: a menu or dialog open closes first, as in the editor.
  const layerOpen = () => confirmDelete || Boolean(document.querySelector('[role="alertdialog"], [role="menu"]'));
  const backRef = useRef<() => boolean>(() => true);
  backRef.current = () => {
    if (layerOpen()) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      return false;
    }
    onClose();
    return true;
  };
  useBackToClose(true, () => backRef.current());
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !e.defaultPrevented && !layerOpen()) { e.stopPropagation(); onClose(); }
  };

  const setStatus = async (status: ProductStatus) => {
    if (!detail || busy) return;
    setBusy(true);
    setMessage(null);
    const r = await productsAPI.update(detail.id, { status });
    setBusy(false);
    if (!r.ok || !r.data) {
      setMessage({ kind: 'error', text: r.fieldErrors?.status || r.error || 'The status could not be changed. Please try again.' });
      return;
    }
    setDetail(r.data);
    setMessage({ kind: 'ok', text: r.data.status === 'archived' ? 'Archived.' : 'Unarchived.' });
    await onChanged();
  };
  const duplicate = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setMessage(null);
    const r = await productsAPI.duplicate(detail.id);
    setBusy(false);
    if (!r.ok || !r.data) { setMessage({ kind: 'error', text: r.error || 'The product could not be duplicated. Please try again.' }); return; }
    await onChanged();
    onDuplicated(r.data.id);
  };
  const remove = async () => {
    if (!detail) return;
    setBusy(true);
    const r = await productsAPI.remove(detail.id);
    setBusy(false);
    if (!r.ok) { setMessage({ kind: 'error', text: r.error || 'The product could not be deleted. Please try again.' }); return; }
    await onChanged();
    onClose();
  };

  const price = detail ? priceLine(detail) : { main: '', was: '' };
  const current = media[shown];
  const facts = detail ? detailFacts(detail) : [];
  const descriptionNodes = useMemo(() => (detail?.description_html ? renderTextNodes(parseTextHtml(detail.description_html)) : null), [detail?.description_html]);
  const stockBadge = detail && detail.stock_status === 'out_of_stock' && detail.badge !== 'out_of_stock';
  const links = detail ? [
    ...(website && isWebUrl(detail.url) ? [{ label: 'View on website', href: detail.url }] : []),
    ...(isWebUrl(detail.buy_url) ? [{ label: 'Buy link', href: detail.buy_url }] : []),
  ] : [];

  const view = (
    <FocusScope asChild loop trapped
      onMountAutoFocus={(e) => { e.preventDefault(); root.current?.focus({ preventScroll: true }); }}
      onUnmountAutoFocus={(e) => e.preventDefault() /* layerFocus returns focus to the opener */}>
    <div ref={root} tabIndex={-1} onKeyDown={onKeyDown} data-testid="product-details" role="dialog" aria-modal="true" aria-label={detail?.title || 'Product'}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-gray-50 outline-none">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <button type="button" className={`${LINK_BUTTON} h-10 shrink-0`} onClick={onClose}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Products</button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">{detail?.title || 'Product'}</h1>
        {actions?.edit && (
          <button type="button" className={`${BUTTON_PRIMARY} shrink-0 !px-4`} disabled={busy} onClick={() => detail && onEdit(detail.id)}><Pencil className="h-4 w-4" aria-hidden="true" />Edit</button>
        )}
        {actions?.menu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More actions" disabled={busy} className={`${BUTTON_SECONDARY} shrink-0 !px-3`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[60] min-w-[11rem] rounded-md border border-gray-200 bg-white shadow-lg">
              {actions.settings && <DropdownMenuItem onSelect={() => detail && onEdit(detail.id)}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Edit settings</DropdownMenuItem>}
              {actions.duplicate && <DropdownMenuItem onSelect={() => void duplicate()}><Copy className="h-4 w-4" aria-hidden="true" />Duplicate</DropdownMenuItem>}
              {actions.archive && (
                <DropdownMenuItem onSelect={() => void setStatus(actions.archive === 'unarchive' ? 'active' : 'archived')}>
                  {actions.archive === 'unarchive' ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                  {actions.archive === 'unarchive' ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
              )}
              {actions.remove && <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />Delete</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {loading ? <p className="p-6 text-sm text-gray-500">Loading…</p> : !detail ? (
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message?.text}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-4 p-4 pb-10 md:p-6">
          {/* Review minor 3: also in a salesperson's External view of a website product. */}
          {website && (
            <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">{WEBSITE_SYNC_NOTE}</p>
          )}
          {readOnly && <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">Shared by {detail.owner?.name || 'your main account'}. You can view it here.</p>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {/* Photos */}
            <div className="min-w-0">
              <Card>
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 sm:aspect-[4/3]">
                  {current ? (current.type === 'video'
                    ? <video src={current.url} controls preload="metadata" className="h-full w-full object-contain" aria-label={`Video of ${detail.title}`} />
                    : <ImageWithFallback src={current.url} alt={media.length > 1 ? `${detail.title}, photo ${shown + 1} of ${media.length}` : detail.title} className="h-full w-full object-contain" />)
                    : <div className="flex h-full w-full items-center justify-center"><Package className="h-12 w-12 text-gray-300" aria-hidden="true" /><span className="sr-only">No photos</span></div>}
                </div>
                {media.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Photos">
                    {media.map((m, i) => (
                      <button key={m.id} type="button" aria-label={`Show ${m.type === 'video' ? 'video' : 'photo'} ${i + 1}`} aria-pressed={i === shown} onClick={() => setShown(i)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] ${i === shown ? 'border-[#6C60FF]' : 'border-transparent'}`}>
                        {m.type === 'video'
                          ? <video src={m.url} preload="metadata" muted className="h-full w-full object-cover" aria-hidden="true" />
                          : <ImageWithFallback src={m.url} alt="" className="h-full w-full object-cover" />}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Summary: title, price, badges, categories, links; the card's messages sit at its bottom (Chris). */}
            <div className="min-w-0 space-y-4">
              <Card>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_CLASS[detail.badge]}`}>{BADGE_LABEL[detail.badge]}</span>
                  {stockBadge && <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_CLASS.out_of_stock}`}>{BADGE_LABEL.out_of_stock}</span>}
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: website ? WEBSITE_CATALOG_COLOR : '#6C60FF' }}>{sourceLabel(detail)}</span>
                </div>
                <p className="mt-3 text-xl font-semibold text-gray-900">{detail.title}</p>
                {price.main && (
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className={detail.price_on_request || !detail.show_price ? 'text-base text-gray-500' : 'text-lg font-semibold text-gray-900'}>{price.main}</span>
                    {price.was && <span className="text-sm text-gray-400 line-through">{price.was}</span>}
                  </p>
                )}
                {detail.short_description && <p className="mt-3 text-sm text-gray-700">{detail.short_description}</p>}
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-900">Categories</p>
                  {detail.categories.length ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {detail.categories.map((c) => <li key={c.id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{c.name}</li>)}
                    </ul>
                  ) : <p className="mt-1 text-sm text-gray-500">None</p>}
                </div>
                {detail.tags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-900">Tags</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">{detail.tags.map((t) => <li key={t} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-700">{t}</li>)}</ul>
                  </div>
                )}
                {links.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                    {links.map((l) => (
                      <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>{l.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                    ))}
                  </div>
                )}
                {message && (
                  <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-4 text-sm ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</p>
                )}
              </Card>
              {facts.length > 0 && (
                <Card title="Details">
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                    {facts.map((f) => (
                      <div key={f.label} className="contents">
                        <dt className="text-gray-500">{f.label}</dt>
                        <dd className="break-words text-gray-900">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}
            </div>
          </div>

          {(descriptionNodes?.length || detail.description) && (
            <Card title="Description">
              {descriptionNodes?.length
                ? <div className={TEXT_CLASS}>{descriptionNodes}</div>
                : <p className="whitespace-pre-line text-base text-gray-700">{detail.description}</p>}
            </Card>
          )}

          {detail.variants.length > 0 && (
            <Card title="Variants">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th scope="col" className="py-2 pr-4 font-medium">Variant</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Price</th>
                      <th scope="col" className="py-2 pr-4 font-medium">SKU</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Stock</th>
                      <th scope="col" className="py-2 font-medium">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.variants.map((v) => (
                      <tr key={v.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-900">{variantLabel(v.options) || v.title || '–'}</td>
                        <td className="py-2 pr-4 text-gray-700">{detail.price_on_request || !detail.show_price ? price.main /* review minor 1: as the main price line */ : v.price_label || v.price || '–'}</td>
                        <td className="py-2 pr-4 text-gray-700">{v.sku || '–'}</td>
                        <td className="py-2 pr-4 text-gray-700">{v.stock_status === 'out_of_stock' ? 'Out of stock' : 'In stock'}</td>
                        <td className="py-2 text-gray-700">{v.quantity ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {detail.attributes.length > 0 && (
            <Card title="Specifications">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                {detail.attributes.map((a, i) => (
                  <div key={`${i}-${a.label}`} className="contents">
                    <dt className="text-gray-500">{a.label}</dt>
                    <dd className="break-words text-gray-900">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>Campaigns that already show it keep their moments. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => { setConfirmDelete(false); void remove(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </FocusScope>
  );

  // On document.body, after the app, like the editor (above the app header and the phone bar).
  return createPortal(view, document.body);
}
