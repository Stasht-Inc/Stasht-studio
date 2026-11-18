// components/products/ProductFilters.tsx — spec filters: status, source, price range, in stock (category is the column).
import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { SlidersHorizontal } from 'lucide-react';
import type { ProductBadge, ProductFilters as Filters } from '../../services/productsAPI';
import { BADGE_LABEL } from '../../utils/products';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LABEL, inputClass } from '../newsletters/lib/ui';

const BADGES: ProductBadge[] = ['active', 'draft', 'out_of_stock', 'archived'];

const SOURCES = [['website', 'Website'], ['shopify', 'Shopify'], ['manual', 'Manual']] as const;
export type ProductSourceOption = (typeof SOURCES)[number][0];

/** `statuses`: the status choices to offer (a salesperson's External view lists active products only: utils/products filterStatusesFor).
 *  `sources`: the Source choices besides All (Chris 18 Nov: no Shopify unless a store is connected — utils/products sourceOptionsFor). */
export default function ProductFilters({ value, onChange, statuses = BADGES, sources }: { value: Filters; onChange(patch: Partial<Filters>): void; statuses?: ProductBadge[]; sources?: ProductSourceOption[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(value);
  useEffect(() => { if (open) setDraft(value); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (value.status?.length ? 1 : 0) + (value.source ? 1 : 0) + (value.price_min || value.price_max ? 1 : 0) + (value.in_stock ? 1 : 0);
  const toggle = (b: ProductBadge) => setDraft((d) => ({ ...d, status: d.status?.includes(b) ? d.status.filter((x) => x !== b) : [...(d.status || []), b] }));
  const apply = (patch: Partial<Filters>) => { onChange({ ...patch, page: 1 }); setOpen(false); };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={BUTTON_SECONDARY}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{count ? `Filters (${count})` : 'Filters'}</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={16} className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[min(18rem,calc(100vw-2rem))] space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <fieldset>
            <legend className={LABEL}>Status</legend>
            {statuses.map((b) => (
              <label key={b} className="flex items-center gap-2 py-1 text-sm text-gray-800">
                <input type="checkbox" checked={Boolean(draft.status?.includes(b))} onChange={() => toggle(b)} className="h-4 w-4 accent-[#6C60FF]" />{BADGE_LABEL[b]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className={LABEL}>Source</legend>
            {([['', 'All'] as const, ...SOURCES.filter(([v]) => !sources || sources.includes(v))]).map(([v, label]) => (
              <label key={label} className="flex items-center gap-2 py-1 text-sm text-gray-800">
                <input type="radio" name="product-source" checked={(draft.source || '') === v} onChange={() => setDraft((d) => ({ ...d, source: v }))} className="h-4 w-4 accent-[#6C60FF]" />{label}
              </label>
            ))}
          </fieldset>
          <div>
            <span className={LABEL}>Price</span>
            <div className="flex items-center gap-2">
              <input aria-label="Lowest price" inputMode="decimal" placeholder="Min" value={draft.price_min || ''} onChange={(e) => setDraft((d) => ({ ...d, price_min: e.target.value }))} className={inputClass()} />
              <span className="text-gray-400">–</span>
              <input aria-label="Highest price" inputMode="decimal" placeholder="Max" value={draft.price_max || ''} onChange={(e) => setDraft((d) => ({ ...d, price_max: e.target.value }))} className={inputClass()} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={Boolean(draft.in_stock)} onChange={(e) => setDraft((d) => ({ ...d, in_stock: e.target.checked }))} className="h-4 w-4 accent-[#6C60FF]" />In stock only
          </label>
          <div className="flex justify-between gap-2 border-t border-gray-100 pt-3">
            <button type="button" className={BUTTON_SECONDARY} onClick={() => apply({ status: [], source: '', price_min: '', price_max: '', in_stock: false })}>Clear</button>
            <button type="button" className={BUTTON_PRIMARY} onClick={() => apply({ status: draft.status || [], source: draft.source || '', price_min: draft.price_min || '', price_max: draft.price_max || '', in_stock: Boolean(draft.in_stock) })}>Apply</button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
