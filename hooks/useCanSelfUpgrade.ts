import { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/authUtils';
import { canSelfUpgrade, planCoveredBy, storageOverviewOf } from '../utils/effectivePlan';

/**
 * Whether the signed-in account can buy a bigger plan itself (utils/effectivePlan canSelfUpgrade), from its effective
 * plan on GET /user/storage-overview. True until the answer arrives, so limit prompts keep their upgrade link meanwhile.
 */
export default function useCanSelfUpgrade(): boolean {
  const [can, setCan] = useState(true);
  useEffect(() => {
    let live = true;
    dashboardAPI
      .getStorageOverview()
      .then((res: any) => {
        const overview = storageOverviewOf(res);
        if (live && res?.success && overview) setCan(canSelfUpgrade(overview.plan_name, planCoveredBy(overview)));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return can;
}
