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
// When the plan was last asked for. A plan changed elsewhere (the Admin Portal, another tab) shows when the person
// comes back to this tab: asked again on focus once REFRESH_AFTER_MS has passed (Chris, 5 Nov 2026: TheBodyPolitik
// upgraded to Teams in the Admin Portal still had no Dashboard).
let lastCheckAt = 0;
const REFRESH_AFTER_MS = 30_000;

function check(userId: string): void {
  lastCheckAt = Date.now();
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
    // Back on this tab: ask again (once for every caller: the first one to hear it moves lastCheckAt).
    const onReturn = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastCheckAt < REFRESH_AFTER_MS) return;
      check(userId);
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => {
      listeners.delete(onOutcome);
      window.removeEventListener(PLAN_CHANGED_EVENT, onChange);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
    };
  }, [isAuthenticated, userId]);

  const retry = useCallback(() => {
    if (!userId) return;
    setState((s) => ({ ...s, failed: false }));
    check(userId);
  }, [userId]);

  return { ...state, retry };
}
