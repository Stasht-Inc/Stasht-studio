// components/products/ProductVariantsField.tsx — options (up to 3, like size / colour) and one row per combination,
// each with its own price, SKU, stock and photo (spec "Variants"; manual products only, open question 5).
// Errors use the API's keys: options / options.N.name / options.N.values…, variants / variants.N.<field>.
import { Plus, X } from 'lucide-react';
import type { ProductMediaItem } from '../../services/productsAPI';
import { mergeVariants, renameOption, settleOptions, variantLabel, variantRowKey, type OptionDraft, type VariantDraft } from '../../utils/products';
import { BUTTON_SMALL, LINK_BUTTON, inputClass } from '../newsletters/lib/ui';
import { ChipsInput } from './ProductSpecsField';

const ErrorText = ({ id, text }: { id: string; text?: string }) => (text ? <p id={id} className="mt-1 text-xs text-red-600">{text}</p> : null);

/** aria-invalid + aria-describedby for a control whose error shows in an ErrorText with this id. */
const invalidProps = (id: string, text?: string) => (text ? { 'aria-invalid': true as const, 'aria-describedby': id } : {});

/** The first message whose key starts with prefix (options.0.values.2 → under option 1's values). */
const firstUnder = (errors: Record<string, string>, prefix: string): string | undefined =>
  Object.entries(errors).find(([k]) => k === prefix || k.startsWith(`${prefix}.`))?.[1];

export default function ProductVariantsField({ options, variants, photos, disabled, errors, onChange }: {
  options: OptionDraft[]; variants: VariantDraft[]; photos: ProductMediaItem[]; disabled: boolean; errors: Record<string, string>;
  onChange(next: { options: OptionDraft[]; variants: VariantDraft[] }): void;
}) {
  // Every options change (values, add, remove, rename) ends with settleOptions: a name clash that has cleared re-keys its rows.
  const setOptions = (next: OptionDraft[]) => onChange(settleOptions(next, mergeVariants(variants, next)));
  const setVariant = (i: number, patch: Partial<VariantDraft>) => onChange({ options, variants: variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const cell = 'px-1 py-1.5';
  const err = (i: number, field: string) => errors[`variants.${i}.${field}`];
  const eid = (i: number, field: string) => `variant-${i}-${field}-error`;
  // Sticky first column: on a phone the variant's name stays in view while the row scrolls sideways.
  const first = 'sticky left-0 z-[1] w-[5rem] bg-white shadow-[1px_0_0_#f3f4f6]';

  return (
    <div className="space-y-4">
      {options.map((o, i) => (
        // Phone: name and its remove button on one row, the values below; from md up all three in a row.
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[11rem_minmax(0,1fr)_auto] md:items-start">
          <div className="order-1">
            <input aria-label={`Option ${i + 1} name`} placeholder="Size" maxLength={50} value={o.name} disabled={disabled} className={inputClass(Boolean(errors[`options.${i}.name`]))}
              {...invalidProps(`option-${i}-name-error`, errors[`options.${i}.name`])}
              onChange={(e) => { const r = renameOption(options, variants, i, e.target.value); onChange(settleOptions(r.options, r.variants)); }} />
            <ErrorText id={`option-${i}-name-error`} text={errors[`options.${i}.name`]} />
          </div>
          <div className="order-3 col-span-2 md:order-2 md:col-span-1">
            <ChipsInput label={`Option ${i + 1} values`} values={o.values} placeholder="Type a value and press Enter" disabled={disabled} invalid={Boolean(firstUnder(errors, `options.${i}.values`))}
              describedBy={firstUnder(errors, `options.${i}.values`) ? `option-${i}-values-error` : undefined}
              onChange={(values) => setOptions(options.map((x, j) => (j === i ? { ...x, values } : x)))} />
            <ErrorText id={`option-${i}-values-error`} text={firstUnder(errors, `options.${i}.values`)} />
          </div>
          {!disabled && <button type="button" aria-label={`Remove option ${i + 1}`} className={`${BUTTON_SMALL} order-2 h-9 md:order-3`} onClick={() => setOptions(options.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>}
        </div>
      ))}
      {!disabled && options.length < 3 && (
        <button type="button" className={LINK_BUTTON} onClick={() => setOptions([...options, { name: '', values: [] }])}><Plus className="h-4 w-4" aria-hidden="true" />Add an option, like size or colour</button>
      )}
      <ErrorText id="options-error" text={errors.options} />
      {variants.length > 0 && (
        // Wide table: it scrolls sideways inside the card on a phone, never the page.
        <div className="-mx-1 overflow-x-auto">
          {/* Fixed column widths (41rem in all) fit the card on a laptop; on a phone the table scrolls inside the card. */}
          <table className="w-full min-w-[41rem] table-fixed text-sm">
            <thead><tr className="text-left text-xs font-medium text-gray-500">
              <th className={`${cell} ${first}`}>Variant</th><th className={`${cell} w-[5.5rem]`}>Price</th><th className={`${cell} w-[5.5rem]`}>Compare-at</th><th className={`${cell} w-[6rem]`}>SKU</th><th className={`${cell} w-[7.5rem]`}>Stock</th><th className={`${cell} w-[5rem]`}>Quantity</th><th className={`${cell} w-[6.5rem]`}>Photo</th>
            </tr></thead>
            <tbody>
              {variants.map((v, i) => {
                const name = variantLabel(v.options);
                return (
                  <tr key={variantRowKey(v.options)} className="border-t border-gray-100 align-top">
                    <td className={`${cell} ${first} break-words pt-3 font-medium text-gray-900`}>{name}</td>
                    <td className={cell}><input aria-label={`${name} price`} inputMode="decimal" value={v.price} disabled={disabled} onChange={(e) => setVariant(i, { price: e.target.value })} className={inputClass(Boolean(err(i, 'price')))} {...invalidProps(eid(i, 'price'), err(i, 'price'))} /><ErrorText id={eid(i, 'price')} text={err(i, 'price')} /></td>
                    <td className={cell}><input aria-label={`${name} compare-at price`} inputMode="decimal" value={v.compare_at_price} disabled={disabled} onChange={(e) => setVariant(i, { compare_at_price: e.target.value })} className={inputClass(Boolean(err(i, 'compare_at_price')))} {...invalidProps(eid(i, 'compare_at_price'), err(i, 'compare_at_price'))} /><ErrorText id={eid(i, 'compare_at_price')} text={err(i, 'compare_at_price')} /></td>
                    <td className={cell}><input aria-label={`${name} SKU`} maxLength={191} value={v.sku} disabled={disabled} onChange={(e) => setVariant(i, { sku: e.target.value })} className={inputClass(Boolean(err(i, 'sku')))} {...invalidProps(eid(i, 'sku'), err(i, 'sku'))} /><ErrorText id={eid(i, 'sku')} text={err(i, 'sku')} /></td>
                    <td className={cell}>
                      <select aria-label={`${name} stock`} value={v.stock_status} disabled={disabled} onChange={(e) => setVariant(i, { stock_status: e.target.value as VariantDraft['stock_status'] })} className={`${inputClass()} !px-2`}>
                        <option value="in_stock">In stock</option><option value="out_of_stock">Out of stock</option>
                      </select>
                    </td>
                    <td className={cell}><input aria-label={`${name} quantity`} inputMode="numeric" value={v.quantity} disabled={disabled} onChange={(e) => setVariant(i, { quantity: e.target.value })} className={inputClass(Boolean(err(i, 'quantity')))} {...invalidProps(eid(i, 'quantity'), err(i, 'quantity'))} /><ErrorText id={eid(i, 'quantity')} text={err(i, 'quantity')} /></td>
                    <td className={cell}>
                      <select aria-label={`${name} photo`} value={v.image_id ?? ''} disabled={disabled || photos.length === 0} onChange={(e) => setVariant(i, { image_id: e.target.value ? Number(e.target.value) : null })} className={`${inputClass(Boolean(err(i, 'image_id')))} !px-2`} {...invalidProps(eid(i, 'image_id'), err(i, 'image_id'))}>
                        <option value="">None</option>
                        {photos.map((p, n) => <option key={p.id} value={p.id}>Photo {n + 1}</option>)}
                      </select>
                      <ErrorText id={eid(i, 'image_id')} text={err(i, 'image_id')} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ErrorText id="variants-error" text={errors.variants} />
    </div>
  );
}
