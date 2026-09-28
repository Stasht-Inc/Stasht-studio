import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../utils/authUtils';
import { PLAN_CHANGED_EVENT } from '../utils/planEvents';

/** Starter, or no plan at all, is the free plan. Same rule as the API's RequirePaidPlan. */
export const isStarterPlanName = (name?: string | null) => (name || 'starter').toLowerCase().includes('starter');

// One answer per signed-in user, shared by every caller (Sidebar + App both ask).
let cache: { userId: string; isStarter: boolean } | null = null;

/**
 * Whether the signed-in account is on the free (Starter) plan, read from
 * /user/storage-overview like MemoriesPage and UsersPage do. `known` stays false until the
 * server answers; until then `isStarter` falls back to the stored role (3 = Starter), which
 * can be stale after an upgrade, so gate anything that redirects on `known`.
 */
export function useIsStarterPlan(): { isStarter: boolean; known: boolean } {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id != null ? String(user.id) : '';
  const cached = cache && cache.userId === userId ? cache.isStarter : null;
  const [state, setState] = useState(() => ({
    isStarter: cached ?? String(user?.role ?? '') === '3',
    known: cached !== null,
  }));

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    let cancelled = false;
    const load = () => {
      dashboardAPI.getStorageOverview()
        .then((res: any) => {
          const overview = res?.data?.data?.storage_overview || res?.data?.storage_overview;
          if (cancelled || !res?.success || !overview) return;
          cache = { userId, isStarter: isStarterPlanName(overview.plan_name) };
          setState({ isStarter: cache.isStarter, known: true });
        })
        .catch(() => {});
    };
    if (cache && cache.userId === userId) setState({ isStarter: cache.isStarter, known: true });
    else load();

    const onChange = () => { cache = null; load(); };
    window.addEventListener(PLAN_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(PLAN_CHANGED_EVENT, onChange);
    };
  }, [isAuthenticated, userId]);

  return state;
}
