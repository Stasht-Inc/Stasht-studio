import { useEffect, useState } from 'react';
import { newslettersAPI } from '../../../services/newslettersAPI';
import { NEWSLETTERS_CHANGED_EVENT } from '../lib/campaignsView';

/**
 * How many newsletters the account has (all statuses), for the count on the Campaigns page's switch. null until
 * known or when it can't be read. `enabled` must be false unless the plan is known to be paid (contract note 1).
 * Asks again whenever newsletters change (created, saved, sent, deleted: NEWSLETTERS_CHANGED_EVENT).
 */
export function useNewsletterCount(enabled: boolean): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCount(null);
      return undefined;
    }
    let latest = 0;
    const load = async () => {
      const request = ++latest;
      const res = await newslettersAPI.list();
      if (request !== latest) return;
      // A failed read keeps the last number rather than showing a wrong 0.
      if (res.ok && Array.isArray(res.data)) setCount(res.data.length);
    };
    void load();
    window.addEventListener(NEWSLETTERS_CHANGED_EVENT, load);
    return () => {
      latest = Number.MAX_SAFE_INTEGER;
      window.removeEventListener(NEWSLETTERS_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return count;
}
