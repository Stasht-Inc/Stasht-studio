import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { leadsAPI } from '../../services/leadsAPI';

// The "+ Products" and "+ Campaign" pills of the lead chat composer and "+ Send Message" (Chris, 16 Nov 2026):
// "+ Products" to the left, green like the green status chips (light green, green words and border); "+ Campaign"
// the light purple it was before 14 Nov (3134a5b's pill, turned grey by f640cb8). Both open the same picker
// (ShareCarsDialog): "+ Products" straight on its Products tab, "+ Campaign" as before.

const PILL = 'flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2';
export const CAMPAIGN_PILL = `${PILL} bg-purple-50 hover:bg-purple-100 text-[#5A4FE5] focus-visible:ring-[#6C60FF]`;
export const PRODUCTS_PILL = `${PILL} bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 focus-visible:ring-green-600`;

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

export function ProductsPickButton({ onClick }: { onClick(): void }) {
  return (
    <button type="button" onClick={onClick} title="Add products to your message" aria-label="Add products to your message" className={PRODUCTS_PILL}>
      <Plus className="w-4 h-4" aria-hidden="true" />
      Products
    </button>
  );
}
