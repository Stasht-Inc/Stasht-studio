import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { leadsAPI } from '../../services/leadsAPI';
import { BADGE_CLASS } from '../../utils/products';

// The "+ Products" and "+ Campaign" pills of the lead chat composer and "+ Send Message" (Chris, 16 Nov 2026):
// "+ Products" to the left, coloured exactly like the Products page's green "Active" badge (utils/products BADGE_CLASS
// .active); "+ Campaign" the light purple it was before 14 Nov (3134a5b's pill, turned grey by f640cb8). Both open the
// same picker (ShareCarsDialog): "+ Products" straight on its Products tab, "+ Campaign" as before.
// compact: the composer's smaller pills (3134a5b's h-7 size, a little taller), so Send stays on the composer's row.
// Same pattern for both (Chris, 20 Nov 2026: "why is Campaign button missing a stroke around it"): light fill + a
// 1px border one step darker (emerald-200 / purple-200), same radius, padding and text weight.

const PILL = 'flex items-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 whitespace-nowrap';
const SIZE = { regular: 'gap-1.5 h-10 px-4 text-sm', compact: 'gap-1 h-8 px-2.5 text-xs' };
export const campaignPill = (compact = false) => `${PILL} ${compact ? SIZE.compact : SIZE.regular} border bg-purple-50 border-purple-200 hover:bg-purple-100 text-[#5A4FE5] focus-visible:ring-[#6C60FF]`;
export const productsPill = (compact = false) => `${PILL} ${compact ? SIZE.compact : SIZE.regular} border ${BADGE_CLASS.active} hover:bg-emerald-100 focus-visible:ring-emerald-600`;
export const CAMPAIGN_PILL = campaignPill();
export const PRODUCTS_PILL = productsPill();

/** Whether this account has products to pick (GET /leads/campaign-sources, as the picker asks). False until known. */
export function useHasProducts(enabled: boolean): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    leadsAPI.getCampaignSources()
      .then((res: any) => {
        const d = res?.data?.data ?? res?.data;
        if (!cancelled) setHas(Boolean(res?.success && d && d.products === true));
      })
      .catch(() => { if (!cancelled) setHas(false); });
    return () => { cancelled = true; };
  }, [enabled]);
  return has;
}

export function ProductsPickButton({ onClick, compact = false }: { onClick(): void; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} title="Add products to your message" aria-label="Add products to your message" className={productsPill(compact)}>
      <Plus className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} aria-hidden="true" />
      Products
    </button>
  );
}
