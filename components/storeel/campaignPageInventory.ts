import { toast } from 'sonner';
import { campaignMomentsAPI } from '../../services/campaignMomentsAPI';
import { requestUpgrade } from '../../utils/planEvents';
import type { MomentInventory } from './InventoryMomentPicker';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The campaign page's Add a Moment: Website Catalogue products and a dealer's vehicles (Chris, 7 Nov 2026, point 7 —
 * images/189.jpg). They are added to the campaign at once, as Add a Moment's photos are: products right after the
 * moment whose "+" was used (else at the end), vehicles linked like a Cars campaign's.
 */
export function campaignPageInventory({ memoryId, afterPostId, onAdded }: {
  memoryId: string | number;
  /** The "+" the window was opened from (a moment's id), or null. */
  afterPostId(): string | null;
  onAdded(): void;
}): MomentInventory {
  return {
    onSeePlans: () => requestUpgrade('Adding Website Catalogue products is available on the Business plan.'),
    onAdd: async ({ products, vehicles }) => {
      const after = afterPostId();
      const done: string[] = [];
      if (products.length) {
        const place = after && Number(after) > 0 ? { after: { type: 'post' as const, id: Number(after) } } : null;
        const res = await campaignMomentsAPI.addProducts(memoryId, products.map((p) => p.id), place);
        if (!res.ok) { toast.error(res.error || "The products couldn't be added. Try again."); return false; }
        done.push(plural(res.data?.moments ?? products.length, 'product', 'products'));
      }
      if (vehicles.length) {
        const res = await campaignMomentsAPI.addVehicles(memoryId, vehicles.map((v) => v.id));
        if (!res.ok) { toast.error(res.error || "The vehicles couldn't be added. Try again."); return false; }
        done.push(plural(vehicles.length, 'vehicle', 'vehicles'));
      }
      toast.success(`${done.join(' and ')} added to your campaign.`);
      onAdded();
      return true;
    },
  };
}
