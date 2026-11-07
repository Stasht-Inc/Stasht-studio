import { toast } from 'sonner';
import { campaignMomentsAPI } from '../../services/campaignMomentsAPI';
import { requestUpgrade } from '../../utils/planEvents';
import { addedMessage } from './lib/momentPicks';
import type { MomentInventory } from './InventoryMomentPicker';

/**
 * The campaign page's Add a Moment: Website Catalogue products and a dealer's vehicles (Chris, 7 Nov 2026, point 7 —
 * images/189.jpg). They are added to the campaign at once, as Add a Moment's photos are: products right after the
 * moment whose "+" was used (else at the end), vehicles linked like a Cars campaign's.
 */
export function campaignPageInventory({ memoryId, afterPostId, onAdded, linkedVehicleIds = [] }: {
  memoryId: string | number;
  /** The "+" the window was opened from (a moment's id), or null. */
  afterPostId(): string | null;
  onAdded(): void;
  /** Vehicles already linked to the campaign (shown ticked, not pickable again). */
  linkedVehicleIds?: ReadonlyArray<string>;
}): MomentInventory {
  return {
    alreadyAdded: { vehicles: linkedVehicleIds },
    onSeePlans: () => requestUpgrade('Adding Website Catalogue products is available on the Business plan.'),
    onAdd: async ({ products, vehicles }) => {
      const after = afterPostId();
      const added = { products: 0, vehicles: 0, already: 0 };
      if (products.length) {
        const place = after && Number(after) > 0 ? { after: { type: 'post' as const, id: Number(after) } } : null;
        const res = await campaignMomentsAPI.addProducts(memoryId, products.map((p) => p.id), place);
        if (!res.ok) { toast.error(res.error || "The products couldn't be added. Try again."); return false; }
        added.products = res.data?.moments ?? 0;
        added.already = res.data?.already_added_item_ids?.length ?? 0;
      }
      if (vehicles.length) {
        const res = await campaignMomentsAPI.addVehicles(memoryId, vehicles.map((v) => v.id));
        if (!res.ok) {
          // The products went in (a retry skips them and adds the vehicles): show them.
          toast.error(res.error || "The vehicles couldn't be added. Try again.");
          if (added.products) onAdded();
          return false;
        }
        added.vehicles = res.data?.linked ?? vehicles.length;
        added.already += Math.max(0, vehicles.length - added.vehicles);
      }
      toast.success(addedMessage(added));
      onAdded();
      return true;
    },
  };
}
