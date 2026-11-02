import { useSyncExternalStore } from 'react';
import { propertyViewCacheKey, subscribePropertyView } from '../utils/inventoryView';

/**
 * This tab's inventory view as a key ('96' in a salesperson's External view of property 96, '-' elsewhere;
 * utils/inventoryView). It changes when the view switches without a reload, so effects that load cars or
 * website-catalogue items can list it as a dependency and load them again for the new view.
 */
export function useInventoryViewKey(): string {
  return useSyncExternalStore(subscribePropertyView, propertyViewCacheKey, () => '-');
}
