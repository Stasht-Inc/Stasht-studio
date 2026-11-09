// components/products/ProductEditor.tsx — the full product editor (spec "Product editor"). Manual products: every group.
// Website products: read-only except Studio-only fields (status, categories, tags, collections, notes, visibility).
// A salesperson's view of the main account's product: read-only. Actions in M2: Duplicate, Archive, Delete (manual).
// Preview / Copy link (M3), Share / newsletter / QR (M4) and Analytics (M5) come with their milestones (conflict C6).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Copy, Archive, ArchiveRestore, Trash2, ExternalLink } from 'lucide-react';
import { productsAPI, type ProductCategory, type ProductDetail } from '../../services/productsAPI';
import {
  WEBSITE_READ_ONLY_NOTE, editableFor, emptyProductForm, formFromDetail, payloadFromForm, validateProductForm, slugFromTitle, type ProductForm,
} from '../../utils/products';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL, LINK_BUTTON, inputClass, textareaClass } from '../newsletters/lib/ui';
import { Switch } from '../ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import ProductMediaField from './ProductMediaField';
import ProductVariantsField from './ProductVariantsField';
import ProductRichText from './ProductRichText';
import ProductSpecsField, { ChipsInput } from './ProductSpecsField';

const CHECK_FIELDS = 'Check the highlighted fields.';

/** Error keys the editor shows under a field; anything else (an unexpected API key) is listed at the bottom of the card. */
const PLACED = /^(title|short_description|description_html|brand|product_type|price|compare_at_price|currency|sku|barcode|quantity|weight|weight_unit|dimensions(\.(length|width|height|unit))?|slug|seo_title|seo_description|share_image|buy_url|internal_notes|status|category_ids(\.\d+)?|tags(\.\d+)?|collections(\.\d+)?|options(\.\d+\.(name|values(\.\d+)?))?|variants(\.\d+\.(price|compare_at_price|sku|quantity|image_id))?)$/;

/** Set when Save creates a product: the editor remounts on the new id (ProductsPage's key) and still says "Saved." */
let justCreated: number | null = null;

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

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const ErrorText = ({ text }: { text?: string }) => (text ? <p className="mt-1 text-xs text-red-600">{text}</p> : null);

type Confirm = { kind: 'delete' } | { kind: 'leave'; then(): void };

export default function ProductEditor({ productId, categories, defaultCurrency, onClose, onChanged, onOpen }: {
  productId: number | null; categories: ProductCategory[]; defaultCurrency: string; onClose(): void; onChanged(): Promise<void>; onOpen(id: number): void;
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
        if (justCreated === productId) { justCreated = null; setMessage({ kind: 'ok', text: 'Saved. You can add photos now.' }); }
      } else setMessage({ kind: 'error', text: r.error || 'This product could not be opened. Please try again.' });
    });
    return () => { cancelled = true; };
  }, [productId]);

  // A full-screen layer: the page behind it doesn't scroll, and focus starts inside it.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    return () => { document.body.style.overflow = before; };
  }, []);

  const editable = useMemo(() => editableFor(detail), [detail]);
  const can = (field: string) => editable.includes(field);
  const failed = productId !== null && !loading && !detail; // couldn't be opened: nothing to edit or save
  const readOnly = Boolean(detail?.read_only);
  const website = detail?.origin === 'website';
  const dirty = JSON.stringify(form) !== saved;
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

  const save = async (patch?: Partial<ProductForm>) => {
    if (saving) return;
    const next = { ...form, ...patch };
    const errs = validateProductForm(next, editable);
    setErrors(errs);
    if (Object.keys(errs).length) { setMessage({ kind: 'error', text: CHECK_FIELDS }); return; }
    setSaving(true);
    setMessage(null);
    const body = payloadFromForm(next, editable);
    const r = productId ? await productsAPI.update(productId, body) : await productsAPI.create(body);
    setSaving(false);
    if (!r.ok || !r.data) {
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
    const f = formFromDetail(r.data);
    setDetail(r.data);
    setForm(f);
    setSaved(JSON.stringify(f));
    setErrors({});
    setMessage({ kind: 'ok', text: 'Saved.' });
    if (!productId) justCreated = r.data.id;
    await onChanged();
    if (!productId) onOpen(r.data.id); // stays open on the new product, so photos can be added
  };
  const duplicate = async () => {
    if (!productId) return;
    const r = await productsAPI.duplicate(productId);
    if (!r.ok || !r.data) { setMessage({ kind: 'error', text: r.error || 'The product could not be duplicated. Please try again.' }); return; }
    await onChanged();
    onOpen(r.data.id);
  };
  const remove = async () => {
    if (!productId) return;
    const r = await productsAPI.remove(productId);
    if (!r.ok) { setMessage({ kind: 'error', text: r.error || 'The product could not be deleted. Please try again.' }); return; }
    await onChanged();
    onClose();
  };
  // Unsaved edits ask first, whether the editor closes or another product (a duplicate) opens.
  const guarded = (then: () => void) => (dirty && canSave ? setConfirm({ kind: 'leave', then }) : then());
  const close = () => guarded(onClose);
  const archived = form.status === 'archived';

  // Media answers carry the product's new detail; the form keeps its unsaved edits, minus variant photos that are gone.
  const mediaChanged = (d: ProductDetail) => {
    setDetail(d);
    const ids = new Set(d.media.filter((m) => m.type === 'photo').map((m) => m.id));
    const prune = (f: ProductForm): ProductForm => (f.variants.some((v) => v.image_id !== null && !ids.has(v.image_id))
      ? { ...f, variants: f.variants.map((v) => (v.image_id !== null && !ids.has(v.image_id) ? { ...v, image_id: null } : v)) } : f);
    setForm(prune);
    setSaved((s) => JSON.stringify(prune(JSON.parse(s) as ProductForm)));
    void onChanged(); // the grid card's main photo and count
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !confirm) { e.stopPropagation(); close(); }
  };

  const bottomMessage = message && (message.kind === 'error' || !dirty) ? (
    <div role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm sm:mr-auto ${message.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
      <p>{message.text}</p>
      {message.more && message.more.length > 0 && <ul className="mt-1 list-disc pl-5">{message.more.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}</ul>}
    </div>
  ) : null;

  const editor = (
    <div ref={root} tabIndex={-1} onKeyDown={onKeyDown} data-testid="product-editor" role="dialog" aria-modal="true" aria-label={productId ? form.title || 'Product' : 'New product'}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-gray-50 outline-none">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <button type="button" aria-label="Close" className={`${LINK_BUTTON} h-10`} onClick={close}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Products</button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">{productId ? form.title || 'Product' : 'New product'}</h1>
        {productId && detail && !readOnly && (
          <div className="order-last flex w-full flex-wrap gap-2 sm:order-none sm:w-auto">
            <button type="button" className={`${BUTTON_SECONDARY} flex-1 !px-3 sm:flex-none`} onClick={() => guarded(() => void duplicate())}><Copy className="h-4 w-4" aria-hidden="true" />Duplicate</button>
            {can('status') && (
              <button type="button" className={`${BUTTON_SECONDARY} flex-1 !px-3 sm:flex-none`} disabled={saving} onClick={() => void save({ status: archived ? 'active' : 'archived' })}>
                {archived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}{archived ? 'Unarchive' : 'Archive'}
              </button>
            )}
            {detail.origin === 'manual' && <button type="button" className={`${BUTTON_SECONDARY} flex-1 !px-3 text-red-600 sm:flex-none`} onClick={() => setConfirm({ kind: 'delete' })}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</button>}
          </div>
        )}
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
              {WEBSITE_READ_ONLY_NOTE}{' '}
              {detail?.url && <a href={detail.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium underline">View on website<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
            </p>
          )}
          {readOnly && <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">Shared by {detail?.owner?.name || 'your main account'}. You can view it here.</p>}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <Section title="Basics">
                <Field id="p-title" label="Title" error={errors.title}><input id="p-title" maxLength={255} value={form.title} disabled={!can('title')} onChange={(e) => set('title', e.target.value)} className={inputClass(Boolean(errors.title))} /></Field>
                <Field id="p-short" label="Short description" error={errors.short_description}><textarea id="p-short" rows={2} maxLength={500} value={form.short_description} disabled={!can('short_description')} onChange={(e) => set('short_description', e.target.value)} className={textareaClass(Boolean(errors.short_description))} /></Field>
                <div>
                  <span className={LABEL}>Full description</span>
                  <ProductRichText label="Full description" value={form.description_html} resetKey={`${productId ?? 'new'}-${detail?.updated_at ?? ''}`} disabled={!can('description_html')} onChange={(html) => set('description_html', html)} />
                  <ErrorText text={errors.description_html} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="p-brand" label="Brand" error={errors.brand}><input id="p-brand" maxLength={191} value={form.brand} disabled={!can('brand')} onChange={(e) => set('brand', e.target.value)} className={inputClass(Boolean(errors.brand))} /></Field>
                  <Field id="p-type" label="Product type" error={errors.product_type}><input id="p-type" maxLength={191} value={form.product_type} disabled={!can('product_type')} onChange={(e) => set('product_type', e.target.value)} className={inputClass(Boolean(errors.product_type))} /></Field>
                </div>
              </Section>
              <Section title="Media">
                <ProductMediaField productId={productId} media={detail?.media || []} disabled={readOnly || website} onChange={mediaChanged} />
              </Section>
              <Section title="Pricing">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="p-price" label="Price" error={errors.price}><input id="p-price" inputMode="decimal" value={form.price} disabled={!can('price')} onChange={(e) => set('price', e.target.value)} className={inputClass(Boolean(errors.price))} /></Field>
                  <Field id="p-compare" label="Compare-at price" error={errors.compare_at_price} hint="The price before the sale; shown struck through."><input id="p-compare" inputMode="decimal" value={form.compare_at_price} disabled={!can('compare_at_price')} onChange={(e) => set('compare_at_price', e.target.value)} className={inputClass(Boolean(errors.compare_at_price))} /></Field>
                  <Field id="p-currency" label="Currency" error={errors.currency}><input id="p-currency" maxLength={3} value={form.currency} disabled={!can('currency')} onChange={(e) => set('currency', e.target.value.toUpperCase())} className={inputClass(Boolean(errors.currency))} /></Field>
                </div>
                <label className="flex items-center gap-3 text-sm text-gray-800"><Switch checked={form.price_on_request} disabled={!can('price_on_request')} onCheckedChange={(v) => set('price_on_request', v)} aria-label="Price on request" />Price on request</label>
              </Section>
              <Section title="Inventory">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="p-sku" label="SKU" error={errors.sku}><input id="p-sku" maxLength={191} value={form.sku} disabled={!can('sku')} onChange={(e) => set('sku', e.target.value)} className={inputClass(Boolean(errors.sku))} /></Field>
                  <Field id="p-barcode" label="Barcode / UPC" error={errors.barcode}><input id="p-barcode" maxLength={64} value={form.barcode} disabled={!can('barcode')} onChange={(e) => set('barcode', e.target.value)} className={inputClass(Boolean(errors.barcode))} /></Field>
                  <Field id="p-stock" label="Stock status"><select id="p-stock" value={form.stock_status} disabled={!can('stock_status')} onChange={(e) => set('stock_status', e.target.value as ProductForm['stock_status'])} className={inputClass()}><option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option></select></Field>
                  <Field id="p-qty" label="Quantity (optional)" error={errors.quantity}><input id="p-qty" inputMode="numeric" value={form.quantity} disabled={!can('quantity')} onChange={(e) => set('quantity', e.target.value)} className={inputClass(Boolean(errors.quantity))} /></Field>
                </div>
              </Section>
              <Section title="Variants">
                {can('variants') || form.variants.length ? (
                  <ProductVariantsField options={form.options} variants={form.variants} photos={photos} disabled={!can('variants')} errors={errors}
                    onChange={({ options, variants }) => { setForm((f) => ({ ...f, options, variants })); clearErrors('options', 'variants'); }} />
                ) : <p className="text-sm text-gray-500">{website ? 'Variants come from your website for this product.' : 'No variants.'}</p>}
              </Section>
              <Section title="Details">
                <div><span className={LABEL}>Specifications</span><ProductSpecsField rows={form.attributes} disabled={!can('attributes')} onChange={(rows) => set('attributes', rows)} /><ErrorText text={under(errors, 'attributes')} /></div>
                <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                  <Field id="p-weight" label="Weight" error={errors.weight}><input id="p-weight" inputMode="decimal" value={form.weight} disabled={!can('weight')} onChange={(e) => set('weight', e.target.value)} className={inputClass(Boolean(errors.weight))} /></Field>
                  <Field id="p-weight-unit" label="Unit" error={errors.weight_unit}><select id="p-weight-unit" value={form.weight_unit} disabled={!can('weight_unit')} onChange={(e) => set('weight_unit', e.target.value)} className={inputClass()}>{['kg', 'g', 'lb', 'oz'].map((u) => <option key={u}>{u}</option>)}</select></Field>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {(['length', 'width', 'height'] as const).map((d) => (
                    <Field key={d} id={`p-${d}`} label={d[0].toUpperCase() + d.slice(1)} error={errors[`dimensions.${d}`]}><input id={`p-${d}`} inputMode="decimal" value={form.dimensions[d]} disabled={!can('dimensions')} onChange={(e) => set('dimensions', { ...form.dimensions, [d]: e.target.value })} className={inputClass(Boolean(errors[`dimensions.${d}`]))} /></Field>
                  ))}
                  <Field id="p-dim-unit" label="Unit" error={errors['dimensions.unit'] || errors.dimensions}><select id="p-dim-unit" value={form.dimensions.unit} disabled={!can('dimensions')} onChange={(e) => set('dimensions', { ...form.dimensions, unit: e.target.value })} className={inputClass()}>{['cm', 'mm', 'm', 'in', 'ft'].map((u) => <option key={u}>{u}</option>)}</select></Field>
                </div>
              </Section>
            </div>

            {/* A website product: on a phone the groups it can change (status, categories, tags, notes) come first. */}
            <div className={`min-w-0 space-y-4 ${website && !readOnly ? 'order-first lg:order-none' : ''}`}>
              <Section title="Visibility">
                <Field id="p-status" label="Status" error={errors.status}><select id="p-status" value={form.status} disabled={!can('status')} onChange={(e) => set('status', e.target.value as ProductForm['status'])} className={inputClass(Boolean(errors.status))}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></Field>
                <label className="flex items-center gap-3 text-sm text-gray-800"><Switch checked={form.show_enquire} disabled={!can('show_enquire')} onCheckedChange={(v) => set('show_enquire', v)} aria-label="Show the Enquire button" />Show the Enquire button</label>
                <label className="flex items-center gap-3 text-sm text-gray-800"><Switch checked={form.show_price} disabled={!can('show_price')} onCheckedChange={(v) => set('show_price', v)} aria-label="Show the price" />Show the price</label>
              </Section>
              <Section title="Organisation">
                <fieldset>
                  <legend className={LABEL}>Categories</legend>
                  {readOnly ? (
                    <p className="text-sm text-gray-700">{detail?.categories.map((c) => c.name).join(', ') || 'None'}</p>
                  ) : categories.length === 0 ? <p className="text-sm text-gray-500">Add categories in the Categories column.</p> : categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 py-1 text-sm text-gray-800">
                      <input type="checkbox" className="h-4 w-4 accent-[#6C60FF]" disabled={!can('category_ids')} checked={form.category_ids.includes(c.id)}
                        onChange={() => set('category_ids', form.category_ids.includes(c.id) ? form.category_ids.filter((x) => x !== c.id) : [...form.category_ids, c.id])} />{c.name}
                    </label>
                  ))}
                  <ErrorText text={under(errors, 'category_ids')} />
                </fieldset>
                <div><span className={LABEL}>Tags</span><ChipsInput label="Tags" values={form.tags} placeholder="Type a tag and press Enter" disabled={!can('tags')} invalid={Boolean(under(errors, 'tags'))} onChange={(v) => set('tags', v)} /><ErrorText text={under(errors, 'tags')} /></div>
                <div><span className={LABEL}>Collections</span><ChipsInput label="Collections" values={form.collections} placeholder="Type a collection and press Enter" disabled={!can('collections')} invalid={Boolean(under(errors, 'collections'))} onChange={(v) => set('collections', v)} /><ErrorText text={under(errors, 'collections')} /></div>
              </Section>
              <Section title="SEO and sharing">
                <Field id="p-slug" label="URL slug" error={errors.slug} hint={`studio.stasht.com/p/${form.slug || slugFromTitle(form.title) || 'your-product'}. Your public product page is coming soon.`}>
                  <input id="p-slug" maxLength={120} value={form.slug} disabled={!can('slug')} placeholder={slugFromTitle(form.title)} onChange={(e) => set('slug', e.target.value.toLowerCase())} className={inputClass(Boolean(errors.slug))} />
                </Field>
                <Field id="p-seo-title" label="Page title" error={errors.seo_title}><input id="p-seo-title" maxLength={191} value={form.seo_title} disabled={!can('seo_title')} onChange={(e) => set('seo_title', e.target.value)} className={inputClass(Boolean(errors.seo_title))} /></Field>
                <Field id="p-seo-desc" label="Description" error={errors.seo_description}><textarea id="p-seo-desc" rows={3} maxLength={500} value={form.seo_description} disabled={!can('seo_description')} onChange={(e) => set('seo_description', e.target.value)} className={textareaClass(Boolean(errors.seo_description))} /></Field>
                <Field id="p-share" label="Share image" error={errors.share_image} hint="A web address of the picture link previews show."><input id="p-share" value={form.share_image} disabled={!can('share_image')} onChange={(e) => set('share_image', e.target.value)} className={inputClass(Boolean(errors.share_image))} /></Field>
              </Section>
              <Section title="Links">
                <Field id="p-buy" label='External "Buy" link (optional)' error={errors.buy_url} hint="For products you also sell somewhere else."><input id="p-buy" value={form.buy_url} disabled={!can('buy_url')} onChange={(e) => set('buy_url', e.target.value)} className={inputClass(Boolean(errors.buy_url))} /></Field>
              </Section>
              {!readOnly && (
                <Section title="Internal notes">
                  <Field id="p-notes" label="Notes" error={errors.internal_notes} hint="Only your team sees these."><textarea id="p-notes" rows={4} maxLength={5000} value={form.internal_notes} disabled={!can('internal_notes')} onChange={(e) => set('internal_notes', e.target.value)} className={textareaClass(Boolean(errors.internal_notes))} /></Field>
                </Section>
              )}
            </div>
          </div>

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
            <AlertDialogTitle>{confirm?.kind === 'delete' ? 'Delete this product?' : 'Leave without saving?'}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.kind === 'delete' ? "Campaigns that already show it keep their moments. This can't be undone." : 'Your changes will be lost.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirm?.kind === 'delete' ? 'Cancel' : 'Keep editing'}</AlertDialogCancel>
            <AlertDialogAction className={confirm?.kind === 'delete' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#6C60FF] text-white hover:bg-[#5B50E6]'}
              onClick={() => { const c = confirm; setConfirm(null); if (c?.kind === 'delete') void remove(); else c?.then(); }}>
              {confirm?.kind === 'delete' ? 'Delete' : 'Leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // On document.body, after the app: above the app header and the phone bar (same z-50, later in the page), and below
  // the confirm dialog, which Radix adds to the body later still.
  return createPortal(editor, document.body);
}
