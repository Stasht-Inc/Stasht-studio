import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../utils/authUtils';
import { PLAN_CHANGED_EVENT } from '../utils/planEvents';

/** Starter, or no plan at all, is the free plan. Same rule as the API's RequirePaidPlan. */
export const isStarterPlanName = (name?: string | null) => (name || 'starter').toLowerCase().includes('starter');

// One answer per signed-in user, shared by every caller (Sidebar + App both ask).
let cache: { userId: string; isStarter: boolean } | null = null;
// Every mounted caller hears the outcome of any check, so one "Try again" updates them all.
type Outcome = { userId: string; isStarter: boolean | null; failed: boolean };
const listeners = new Set<(outcome: Outcome) => void>();
const announce = (outcome: Outcome) => listeners.forEach((listener) => listener(outcome));

function check(userId: string): void {
  dashboardAPI.getStorageOverview()
    .then((res: any) => {
      const overview = res?.data?.data?.storage_overview || res?.data?.storage_overview;
      if (!res?.success || !overview) {
        announce({ userId, isStarter: null, failed: true });
        return;
      }
      cache = { userId, isStarter: isStarterPlanName(overview.plan_name) };
      announce({ userId, isStarter: cache.isStarter, failed: false });
    })
    .catch(() => announce({ userId, isStarter: null, failed: true }));
}

export interface StarterPlanState {
  isStarter: boolean;
  /** The server has answered. */
  known: boolean;
  /** The last check failed (and nothing is known yet): offer `retry`. */
  failed: boolean;
  /** Ask the server again. */
  retry(): void;
}

/**
 * Whether the signed-in account is on the free (Starter) plan, read from
 * /user/storage-overview like MemoriesPage and UsersPage do. `known` stays false until the
 * server answers; until then `isStarter` falls back to the stored role (3 = Starter), which
 * can be stale after an upgrade, so gate anything that redirects on `known`. When the check
 * fails, `failed` turns true so screens waiting on it can offer `retry`.
 */
export function useIsStarterPlan(): StarterPlanState {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id != null ? String(user.id) : '';
  const cached = cache && cache.userId === userId ? cache.isStarter : null;
  const [state, setState] = useState(() => ({
    isStarter: cached ?? String(user?.role ?? '') === '3',
    known: cached !== null,
    failed: false,
  }));

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const onOutcome = (outcome: Outcome) => {
      if (outcome.userId !== userId) return;
      if (outcome.isStarter !== null) setState({ isStarter: outcome.isStarter, known: true, failed: false });
      else setState((s) => (s.known ? s : { ...s, failed: true }));
    };
    listeners.add(onOutcome);
    if (cache && cache.userId === userId) setState({ isStarter: cache.isStarter, known: true, failed: false });
    else check(userId);

    const onChange = () => { cache = null; check(userId); };
    window.addEventListener(PLAN_CHANGED_EVENT, onChange);
    return () => {
      listeners.delete(onOutcome);
      window.removeEventListener(PLAN_CHANGED_EVENT, onChange);
    };
  }, [isAuthenticated, userId]);

  const retry = useCallback(() => {
    if (!userId) return;
    setState((s) => ({ ...s, failed: false }));
    check(userId);
  }, [userId]);

  return { ...state, retry };
}
