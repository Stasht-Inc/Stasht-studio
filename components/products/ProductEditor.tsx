// components/products/ProductEditor.tsx — the full product editor (spec "Product editor"). Manual products: every group.
// Website products: read-only except Studio-only fields (status, categories, tags, collections, notes, visibility).
// A salesperson's view of the main account's product: read-only. Post-live P1 (15 Nov): the editor opens from the
// product details view (ProductDetails), whose header now holds Duplicate, Archive and Delete; Save and Cancel go back
// to that view. Preview / Copy link (M3), Share / newsletter / QR (M4) and Analytics (M5) come with their milestones.
import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { productsAPI, type ProductCategory, type ProductDetail } from '../../services/productsAPI';
import { captureOpener, releaseOpener } from './layerFocus';
import { useBackToClose } from '../newsletters/hooks/useBackToClose';
import {
  ENQUIRE_HELP, SHOPIFY_READ_ONLY_NOTE, WEBSITE_READ_ONLY_NOTE, categoryChooserChoices, currencyOptions, editableFor, emptyProductForm, formFromDetail, payloadFromForm, validateProductForm, slugFromTitle, type ProductForm,
} from '../../utils/products';
import { BUTTON_PRIMARY, LABEL, LINK_BUTTON, inputClass, textareaClass } from '../newsletters/lib/ui';
import { Switch } from '../ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import ProductMediaField, { type PendingMedia } from './ProductMediaField';
import ProductSelect from './ProductSelect';
import ProductVariantsField from './ProductVariantsField';
import ProductRichText from './ProductRichText';
import ProductSpecsField, { ChipsInput } from './ProductSpecsField';

const CHECK_FIELDS = 'Check the highlighted fields.';
/** A dialog or an open dropdown list: Escape / Back close that first, not the editor. */
const OPEN_LAYER = '[role="alertdialog"], [role="listbox"], [role="menu"]';

/** Error keys the editor shows under a field; anything else (an unexpected API key) is listed at the bottom of the card. */
const PLACED = /^(title|short_description|description_html|brand|product_type|price|compare_at_price|currency|sku|barcode|quantity|weight|weight_unit|dimensions(\.(length|width|height|unit))?|slug|seo_title|seo_description|share_image|buy_url|internal_notes|status|category_ids(\.\d+)?|tags(\.\d+)?|collections(\.\d+)?|attributes(\.\d+\.(label|value))?|options(\.\d+\.(name|values(\.\d+)?))?|variants(\.\d+\.(price|compare_at_price|sku|quantity|image_id))?)$/;

const under = (errors: Record<string, string>, key: string): string | undefined =>
  errors[key] ?? Object.entries(errors).find(([k]) => k.startsWith(`${key}.`))?.[1];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 md:p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Label, control, hint and error. The control gets aria-invalid and aria-describedby (its hint and error). */
function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
    : children;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      {control}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const STOCK_OPTIONS = [{ value: 'in_stock', label: 'In stock' }, { value: 'out_of_stock', label: 'Out of stock' }];
const STATUS_OPTIONS = [{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }, { value: 'archived', label: 'Archived' }];
const WEIGHT_UNITS = ['kg', 'g', 'lb', 'oz'];
const DIM_UNITS = ['cm', 'mm', 'm', 'in', 'ft'];
/** A unit list, plus the product's own unit when it isn't listed (a website value), so nothing is lost. */
const unitOptions = (units: string[], current: string) => [...(current && !units.includes(current) ? [current] : []), ...units].map((u) => ({ value: u, label: u }));
const DIM_EXAMPLE = { length: 'e.g. 50', width: 'e.g. 45', height: 'e.g. 90' } as const;

const ErrorText = ({ id, text }: { id?: string; text?: string }) => (text ? <p id={id} className="mt-1 text-xs text-red-600">{text}</p> : null);

type Confirm = { kind: 'leave'; then(): void };

export default function ProductEditor({ productId, categories, defaultCurrency, onClose, onChanged, onOpen, onSaved }: {
  productId: number | null; categories: ProductCategory[]; defaultCurrency: string; onClose(): void; onChanged(): Promise<void>;
  /** After the first save of a new product: show that product (its details view). */
  onOpen(id: number, detail?: ProductDetail): void;
  /** After a save of an existing product: back to its details view, with the saved copy. */
  onSaved?(detail: ProductDetail): void;
}) {
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [form, setForm] = useState<ProductForm>(() => emptyProductForm(defaultCurrency));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(emptyProductForm(defaultCurrency)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string; more?: string[] } | null>(null);
  const [loading, setLoading] = useState(productId !== null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // C4: a new product's photos / video, picked before the first save and uploaded right after the product is created.
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [uploadingPending, setUploadingPending] = useState(0);
  const [mediaNotes, setMediaNotes] = useState<string[]>([]); // files that failed to upload after the first save
  // The product this editor created when some of its picks failed: the editor stays open on it (no second POST).
  const [createdHere, setCreatedHere] = useState<number | null>(null);
  const pendingRef = useRef<PendingMedia[]>([]);
  pendingRef.current = pending;
  useEffect(() => () => { pendingRef.current.forEach((m) => URL.revokeObjectURL(m.url)); }, []);

  useEffect(() => {
    let cancelled = false;
    if (productId === null) return undefined;
    setLoading(true);
    productsAPI.get(productId).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok && r.data) {
        const f = formFromDetail(r.data);
        setDetail(r.data); setForm(f); setSaved(JSON.stringify(f));
      } else setMessage({ kind: 'error', text: r.error || 'This product could not be opened. Please try again.' });
    });
    return () => { cancelled = true; };
  }, [productId]);

  // A full-screen layer: the page behind it doesn't scroll. Focus is trapped inside (FocusScope below) and goes back to
  // what opened it when the last product layer closes (not when it swaps to the details view: layerFocus.ts).
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    captureOpener();
    return () => {
      document.body.style.overflow = before;
      releaseOpener();
    };
  }, []);

  const editable = useMemo(() => editableFor(detail), [detail]);
  const can = (field: string) => editable.includes(field);
  const failed = productId !== null && !loading && !detail; // couldn't be opened: nothing to edit or save
  const readOnly = Boolean(detail?.read_only);
  // Show / Hide (16 Nov): a hidden category is not offered, unless the product already has it (so nothing is lost).
  const chooser = useMemo(() => categoryChooserChoices(categories, detail?.categories.map((c) => c.id) ?? []), [categories, detail]);
  const shopify = detail?.origin === 'shopify';
  const website = detail?.origin === 'website' || shopify; // imported: read-only except Studio's own fields
  const dirty = JSON.stringify(form) !== saved || pending.length > 0;
  // An edited field drops its error; once nothing is marked, the bottom "Check the highlighted fields." goes too.
  const clearErrors = (...keys: string[]) => setErrors((e) => {
    const left = Object.fromEntries(Object.entries(e).filter(([k]) => !keys.some((key) => k === key || k.startsWith(`${key}.`))));
    return Object.keys(left).length === Object.keys(e).length ? e : left;
  });
  useEffect(() => {
    if (!Object.keys(errors).length) setMessage((m) => (m?.text === CHECK_FIELDS ? null : m));
  }, [errors]);
  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    clearErrors(key, ...(key === 'price' ? ['compare_at_price'] : []), ...(key === 'weight_unit' ? ['weight'] : []));
  };
  const photos = (detail?.media || []).filter((m) => m.type === 'photo');
  const canSave = !readOnly && !failed;

  // Final review I3: a save stays "saving" until the new product has opened, and a product this editor already created is
  // saved with PATCH, so a second click while the list refreshes never POSTs a second copy.
  const savingRef = useRef(false);
  const createdId = useRef<number | null>(null);
  const save = async (patch?: Partial<ProductForm>) => {
    if (saving || savingRef.current) return;
    const next = { ...form, ...patch };
    const errs = validateProductForm(next, editable);
    setErrors(errs);
    if (Object.keys(errs).length) { setMessage({ kind: 'error', text: CHECK_FIELDS }); return; }
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    const body = payloadFromForm(next, editable);
    const id = productId ?? createdId.current;
    const r = id ? await productsAPI.update(id, body) : await productsAPI.create(body);
    // C4: the photos / video picked before this first save upload now, in their order, one at a time. The product is
    // already saved: a file that fails is listed at the bottom of the Media card and the others still upload.
    let uploaded = r.ok ? r.data : undefined;
    const failedUploads: string[] = [];
    if (!id && r.ok && r.data && pendingRef.current.length) {
      createdId.current = r.data.id;
      const picks = pendingRef.current;
      setUploadingPending(picks.length);
      for (const m of picks) {
        const u = await productsAPI.uploadMedia(r.data.id, m.file);
        if (u.ok && u.data) uploaded = u.data;
        else failedUploads.push(`${m.file.name}: ${u.error || 'The file could not be uploaded. Please try again.'}`);
        setUploadingPending((n) => n - 1);
      }
      picks.forEach((m) => URL.revokeObjectURL(m.url));
      setPending([]);
    }
    if (!r.ok || !r.data) {
      savingRef.current = false;
      setSaving(false);
      const fieldErrors = r.fieldErrors || {};
      setErrors(fieldErrors);
      const keys = Object.keys(fieldErrors);
      const placed = keys.filter((k) => PLACED.test(k));
      const more = keys.filter((k) => !PLACED.test(k)).map((k) => fieldErrors[k]);
      if (placed.length) setMessage({ kind: 'error', text: CHECK_FIELDS, more });
      else if (more.length) setMessage({ kind: 'error', text: more[0], more: more.slice(1) });
      else setMessage({ kind: 'error', text: r.error || 'The product could not be saved. Please try again.' });
      return;
    }
    const savedDetail = uploaded ?? r.data;
    const f = formFromDetail(savedDetail);
    setDetail(savedDetail);
    setForm(f);
    setSaved(JSON.stringify(f));
    setErrors({});
    setMessage({ kind: 'ok', text: 'Saved.' });
    const isNew = !productId;
    if (!isNew) { savingRef.current = false; setSaving(false); } // the form already holds the saved copy
    else createdId.current = savedDetail.id;
    if (failedUploads.length) {
      // Stay here on the saved product: what uploaded shows, the failed files are listed under the photos, and
      // adding again uploads straight away. The next Save is a PATCH (createdId), never a second product.
      setCreatedHere(savedDetail.id);
      setMediaNotes(failedUploads);
      setMessage({ kind: 'error', text: failedUploads.length === 1 ? 'The product is saved, but one file could not be uploaded.' : `The product is saved, but ${failedUploads.length} files could not be uploaded.` });
      savingRef.current = false;
      setSaving(false);
      void onChanged(); // the list shows the new product
      return;
    }
    try {
      await onChanged();
      // Post-live P1: a new product opens on its details view (still "saving" until then: I3, no second POST); an
      // existing one goes back to its details view, showing what was saved.
      if (isNew) onOpen(savedDetail.id, savedDetail);
      else onSaved?.(savedDetail);
    } finally {
      if (isNew) { savingRef.current = false; setSaving(false); }
    }
  };
  // Unsaved edits ask first before the editor closes.
  const guarded = (then: () => void) => (dirty && canSave ? setConfirm({ kind: 'leave', then }) : then());
  const close = () => guarded(onClose);

  // Closing or reloading the tab with unsaved edits: the browser asks first.
  const unsaved = dirty && canSave;
  useEffect(() => {
    if (!unsaved) return undefined;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  // The browser's (and phone's) Back closes the editor, asking first when there are unsaved edits (as the composer does).
  const backRef = useRef<() => boolean>(() => true);
  backRef.current = () => {
    // A dialog is open (the editor's own or the photo-remove confirm): Back closes that dialog first, as Escape would.
    if (confirm || document.querySelector(OPEN_LAYER)) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      return false;
    }
    if (unsaved) { setConfirm({ kind: 'leave', then: onClose }); return false; }
    onClose();
    return true;
  };
  useBackToClose(true, () => backRef.current());

  // Media answers carry the product's new detail; the form keeps its unsaved edits, minus variant photos that are gone.
  const mediaChanged = (d: ProductDetail) => {
    setMediaNotes([]);
    setDetail(d);
    const ids = new Set(d.media.filter((m) => m.type === 'photo').map((m) => m.id));
    const prune = (f: ProductForm): ProductForm => (f.variants.some((v) => v.image_id !== null && !ids.has(v.image_id))
      ? { ...f, variants: f.variants.map((v) => (v.image_id !== null && !ids.has(v.image_id) ? { ...v, image_id: null } : v)) } : f);
    setForm(prune);
    setSaved((s) => JSON.stringify(prune(JSON.parse(s) as ProductForm)));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // Escape inside a dialog belongs to it (Radix marks it handled); only a bare Escape closes the editor.
    if (e.key === 'Escape' && !confirm && !e.defaultPrevented && !document.querySelector(OPEN_LAYER)) { e.stopPropagation(); close(); }
  };

  const bottomMessage = message && (message.kind === 'error' || !dirty) ? (
    <div role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm sm:mr-auto ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
      <p>{message.text}</p>
      {message.more && message.more.length > 0 && <ul className="mt-1 list-disc pl-5">{message.more.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}</ul>}
    </div>
  ) : null;

  const editor = (
    // Focus stays inside while the editor shows (Radix dialogs inside pause this trap), like NewsletterComposer.
    <FocusScope asChild loop trapped
      onMountAutoFocus={(e) => { e.preventDefault(); root.current?.focus({ preventScroll: true }); }}
      onUnmountAutoFocus={(e) => e.preventDefault() /* the effect above returns focus to the opener */}>
    <div ref={root} tabIndex={-1} onKeyDown={onKeyDown} data-testid="product-editor" role="dialog" aria-modal="true" aria-label={productId ? form.title || 'Product' : 'New product'}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-gray-50 outline-none">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        {/* A new product closes to the list ("Products"); an existing one goes back to its details view ("Cancel"). */}
        {productId
          ? <button type="button" className={`${LINK_BUTTON} h-10`} onClick={close}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Cancel</button>
          : <button type="button" aria-label="Close" className={`${LINK_BUTTON} h-10`} onClick={close}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Products</button>}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">{productId || createdHere ? form.title || 'Product' : 'New product'}</h1>
        {canSave && <button type="button" className={BUTTON_PRIMARY} disabled={saving || loading} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>}
      </header>

      {loading ? <p className="p-6 text-sm text-gray-500">Loading…</p> : failed ? (
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message?.text}</p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-4 p-4 pb-10 md:p-6">
          {website && !readOnly && (
            <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
              {shopify ? SHOPIFY_READ_ONLY_NOTE : WEBSITE_READ_ONLY_NOTE}{' '}
              {detail?.url && /^https?:\/\//i.test(detail.url) && <a href={detail.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline">{shopify ? 'View in your store' : 'View on website'}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
            </p>
          )}
          {readOnly && <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">Shared by {detail?.owner?.name || 'your main account'}. You can view it here.</p>}

          {/* Final review I4: while a save is on its way the fields are locked, so nothing typed then is replaced by the
              server's copy and marked saved. */}
          <fieldset disabled={saving} aria-busy={saving || undefined} className="m-0 min-w-0 border-0 p-0">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <Section title="Basics">
                <Field id="p-title" label="Title" error={errors.title}><input id="p-title" placeholder="e.g. Walnut dining chair" maxLength={255} value={form.title} disabled={!can('title')} onChange={(e) => set('title', e.target.value)} className={inputClass(Boolean(errors.title))} /></Field>
                <Field id="p-short" label="Short description" error={errors.short_description}><textarea id="p-short" placeholder="e.g. Solid walnut, hand-finished." rows={2} maxLength={500} value={form.short_description} disabled={!can('short_description')} onChange={(e) => set('short_description', e.target.value)} className={textareaClass(Boolean(errors.short_description))} /></Field>
                <div>
                  <span className={LABEL}>Full description</span>
                  <ProductRichText label="Full description" value={form.description_html} resetKey={`${productId ?? 'new'}-${detail?.updated_at ?? ''}`} disabled={!can('description_html')} busy={saving} onChange={(html) => set('description_html', html)} />
                  <ErrorText text={errors.description_html} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="p-brand" label="Brand" error={errors.brand}><input id="p-brand" placeholder="e.g. Mill & Co" maxLength={191} value={form.brand} disabled={!can('brand')} onChange={(e) => set('brand', e.target.value)} className={inputClass(Boolean(errors.brand))} /></Field>
                  <Field id="p-type" label="Product type" error={errors.product_type}><input id="p-type" placeholder="e.g. Chair" maxLength={191} value={form.product_type} disabled={!can('product_type')} onChange={(e) => set('product_type', e.target.value)} className={inputClass(Boolean(errors.product_type))} /></Field>
                </div>
              </Section>
              <Section title="Media">
                <ProductMediaField productId={productId ?? createdHere} media={detail?.media || []} disabled={readOnly || website} onChange={mediaChanged} onSettled={() => void onChanged() /* the grid card's main photo and count */}
                  pending={pending} onPendingChange={(next) => { setPending(next); setMediaNotes([]); }} notes={mediaNotes} uploadingPending={uploadingPending} />
              </Section>
              <Section title="Pricing">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="p-price" label="Price" error={errors.price}><input id="p-price" placeholder="e.g. 49.99" inputMode="decimal" value={form.price} disabled={!can('price')} onChange={(e) => set('price', e.target.value)} className={inputClass(Boolean(errors.price))} /></Field>
                  <Field id="p-compare" label="Compare-at price" error={errors.compare_at_price} hint="The price before the sale; shown struck through."><input id="p-compare" placeholder="e.g. 59.99" inputMode="decimal" value={form.compare_at_price} disabled={!can('compare_at_price')} onChange={(e) => set('compare_at_price', e.target.value)} className={inputClass(Boolean(errors.compare_at_price))} /></Field>
                  <Field id="p-currency" label="Currency" error={errors.currency}><ProductSelect id="p-currency" value={form.currency} options={currencyOptions(form.currency)} disabled={!can('currency')} onChange={(v) => set('currency', v)} /></Field>
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-800"><Switch checked={form.price_on_request} disabled={!can('price_on_request')} onCheckedChange={(v) => set('price_on_request', v)} aria-label="Price on request" />Price on request</label>
              </Section>
              <Section title="Inventory">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="p-sku" label="SKU" error={errors.sku}><input id="p-sku" placeholder="e.g. WAL-CHAIR-01" maxLength={191} value={form.sku} disabled={!can('sku')} onChange={(e) => set('sku', e.target.value)} className={inputClass(Boolean(errors.sku))} /></Field>
                  <Field id="p-barcode" label="Barcode / UPC" error={errors.barcode}><input id="p-barcode" placeholder="e.g. 012345678905" maxLength={64} value={form.barcode} disabled={!can('barcode')} onChange={(e) => set('barcode', e.target.value)} className={inputClass(Boolean(errors.barcode))} /></Field>
                  <Field id="p-stock" label="Stock status"><ProductSelect id="p-stock" value={form.stock_status} disabled={!can('stock_status')} options={STOCK_OPTIONS} onChange={(v) => set('stock_status', v as ProductForm['stock_status'])} /></Field>
                  <Field id="p-qty" label="Quantity (optional)" error={errors.quantity}><input id="p-qty" placeholder="e.g. 25" inputMode="numeric" value={form.quantity} disabled={!can('quantity')} onChange={(e) => set('quantity', e.target.value)} className={inputClass(Boolean(errors.quantity))} /></Field>
                </div>
              </Section>
              <Section title="Variants">
                {can('variants') || form.variants.length ? (
                  <ProductVariantsField options={form.options} variants={form.variants} photos={photos} disabled={!can('variants')} errors={errors}
                    onChange={({ options, variants }) => { setForm((f) => ({ ...f, options, variants })); clearErrors('options', 'variants'); }} />
                ) : <p className="text-sm text-gray-500">{website ? `Variants come from your ${shopify ? 'Shopify store' : 'website'} for this product.` : 'No variants.'}</p>}
              </Section>
              <Section title="Details">
                <div><span className={LABEL}>Specifications</span><ProductSpecsField rows={form.attributes} disabled={!can('attributes')} onChange={(rows) => set('attributes', rows)} /><ErrorText text={under(errors, 'attributes')} /></div>
                <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                  <Field id="p-weight" label="Weight" error={errors.weight}><input id="p-weight" placeholder="e.g. 7.5" inputMode="decimal" value={form.weight} disabled={!can('weight')} onChange={(e) => set('weight', e.target.value)} className={inputClass(Boolean(errors.weight))} /></Field>
                  <Field id="p-weight-unit" label="Unit" error={errors.weight_unit}><ProductSelect id="p-weight-unit" value={form.weight_unit} disabled={!can('weight_unit')} options={unitOptions(WEIGHT_UNITS, form.weight_unit)} onChange={(v) => set('weight_unit', v)} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(['length', 'width', 'height'] as const).map((d) => (
                    <Field key={d} id={`p-${d}`} label={d[0].toUpperCase() + d.slice(1)} error={errors[`dimensions.${d}`]}><input id={`p-${d}`} placeholder={DIM_EXAMPLE[d]} inputMode="decimal" value={form.dimensions[d]} disabled={!can('dimensions')} onChange={(e) => set('dimensions', { ...form.dimensions, [d]: e.target.value })} className={inputClass(Boolean(errors[`dimensions.${d}`]))} /></Field>
                  ))}
                  <Field id="p-dim-unit" label="Unit" error={errors['dimensions.unit'] || errors.dimensions}><ProductSelect id="p-dim-unit" value={form.dimensions.unit} disabled={!can('dimensions')} options={unitOptions(DIM_UNITS, form.dimensions.unit)} onChange={(v) => set('dimensions', { ...form.dimensions, unit: v })} /></Field>
                </div>
              </Section>
            </div>

            {/* A website product: on a phone the groups it can change (status, categories, tags, notes) come first. */}
            <div className={`min-w-0 space-y-4 ${website && !readOnly ? 'order-first lg:order-none' : ''}`}>
              <Section title="Visibility">
                <Field id="p-status" label="Status" error={errors.status}><ProductSelect id="p-status" value={form.status} disabled={!can('status')} options={STATUS_OPTIONS} onChange={(v) => set('status', v as ProductForm['status'])} /></Field>
                <div>
                  <label className="flex items-center gap-3 text-sm text-gray-800"><Switch checked={form.show_enquire} disabled={!can('show_enquire')} onCheckedChange={(v) => set('show_enquire', v)} aria-label="Show the Enquire button" aria-describedby="p-enquire-help" />Show the Enquire button</label>
                  <p id="p-enquire-help" className="mt-1 text-xs text-gray-500">{ENQUIRE_HELP}</p>
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-800"><Switch checked={form.show_price} disabled={!can('show_price')} onCheckedChange={(v) => set('show_price', v)} aria-label="Show the price" />Show the price</label>
              </Section>
              <Section title="Organisation">
                <fieldset>
                  <legend className={LABEL}>Categories</legend>
                  {readOnly ? (
                    <p className="text-sm text-gray-700">{detail?.categories.map((c) => c.name).join(', ') || 'None'}</p>
                  ) : chooser.length === 0 ? <p className="text-sm text-gray-500">Add categories in the Categories column.</p> : chooser.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 py-1 text-sm text-gray-800">
                      <input type="checkbox" className="h-4 w-4 accent-[#6C60FF]" disabled={!can('category_ids')} checked={form.category_ids.includes(c.id)}
                        onChange={() => set('category_ids', form.category_ids.includes(c.id) ? form.category_ids.filter((x) => x !== c.id) : [...form.category_ids, c.id])} />{c.name}
                    </label>
                  ))}
                  <ErrorText text={under(errors, 'category_ids')} />
                </fieldset>
                <div><label htmlFor="p-tags" className={LABEL}>Tags</label><ChipsInput id="p-tags" label="Tags" describedBy={under(errors, 'tags') ? 'p-tags-error' : undefined} values={form.tags} placeholder="e.g. walnut (press Enter)" disabled={!can('tags')} invalid={Boolean(under(errors, 'tags'))} onChange={(v) => set('tags', v)} /><ErrorText id="p-tags-error" text={under(errors, 'tags')} /></div>
                <div><label htmlFor="p-collections" className={LABEL}>Collections</label><ChipsInput id="p-collections" label="Collections" describedBy={under(errors, 'collections') ? 'p-collections-error' : undefined} values={form.collections} placeholder="e.g. Spring sale (press Enter)" disabled={!can('collections')} invalid={Boolean(under(errors, 'collections'))} onChange={(v) => set('collections', v)} /><ErrorText id="p-collections-error" text={under(errors, 'collections')} /></div>
              </Section>
              <Section title="SEO and sharing">
                <Field id="p-slug" label="URL slug" error={errors.slug} hint={`studio.stasht.com/p/${form.slug || slugFromTitle(form.title) || 'your-product'}. Your public product page is coming soon.`}>
                  <input id="p-slug" maxLength={120} value={form.slug} disabled={!can('slug')} placeholder={slugFromTitle(form.title) || 'e.g. walnut-dining-chair'} onChange={(e) => set('slug', e.target.value.toLowerCase())} className={inputClass(Boolean(errors.slug))} />
                </Field>
                <Field id="p-seo-title" label="Page title" error={errors.seo_title}><input id="p-seo-title" placeholder="e.g. Walnut Dining Chair | Mill & Co" maxLength={191} value={form.seo_title} disabled={!can('seo_title')} onChange={(e) => set('seo_title', e.target.value)} className={inputClass(Boolean(errors.seo_title))} /></Field>
                <Field id="p-seo-desc" label="Description" error={errors.seo_description}><textarea id="p-seo-desc" placeholder="e.g. A hand-made walnut chair for your dining room." rows={3} maxLength={500} value={form.seo_description} disabled={!can('seo_description')} onChange={(e) => set('seo_description', e.target.value)} className={textareaClass(Boolean(errors.seo_description))} /></Field>
                <Field id="p-share" label="Share image" error={errors.share_image} hint="A web address of the picture link previews show."><input id="p-share" placeholder="e.g. https://example.com/chair.jpg" value={form.share_image} disabled={!can('share_image')} onChange={(e) => set('share_image', e.target.value)} className={inputClass(Boolean(errors.share_image))} /></Field>
              </Section>
              <Section title="Links">
                <Field id="p-buy" label='External "Buy" link (optional)' error={errors.buy_url} hint="For products you also sell somewhere else."><input id="p-buy" placeholder="e.g. https://yourstore.com/walnut-chair" value={form.buy_url} disabled={!can('buy_url')} onChange={(e) => set('buy_url', e.target.value)} className={inputClass(Boolean(errors.buy_url))} /></Field>
              </Section>
              {!readOnly && (
                <Section title="Internal notes">
                  <Field id="p-notes" label="Notes" error={errors.internal_notes} hint="Only your team sees these."><textarea id="p-notes" placeholder="e.g. Supplier: Mill & Co, reorder at 5" rows={4} maxLength={5000} value={form.internal_notes} disabled={!can('internal_notes')} onChange={(e) => set('internal_notes', e.target.value)} className={textareaClass(Boolean(errors.internal_notes))} /></Field>
                </Section>
              )}
            </div>
          </div>
          </fieldset>

          {/* Chris's rule: the card's messages sit at its bottom, next to Save. */}
          {canSave && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-end">
              {bottomMessage}
              <button type="button" className={BUTTON_PRIMARY} disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          )}
          {readOnly && message && <p role="alert" className="text-sm text-red-600">{message.text}</p>}
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction className="bg-[#6C60FF] text-white hover:bg-[#5B50E6]"
              onClick={() => { const c = confirm; setConfirm(null); c?.then(); }}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </FocusScope>
  );

  // On document.body, after the app: above the app header and the phone bar (same z-50, later in the page), and below
  // the confirm dialog, which Radix adds to the body later still.
  return createPortal(editor, document.body);
}
