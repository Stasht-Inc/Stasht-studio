// Who meets the new-account plan picker, and who sees Dashboard / Apps (Chris, 5 Nov 2026, points 1, 4 and 6).
//
// The picker ("Upgrade Your Plan" with "Select a plan to unlock the Stasht portal", App) is for an account that has
// just been created (localStorage is_new_user, set by sign-up / activation) and has not chosen a plan yet. It is never
// shown:
// - to an account already on a paid plan (Teams / Business), its own or covered by its main account (utils/effectivePlan):
//   Chris got stuck on it opening Pedalheads' property "Point Grey" because an old is_new_user had outlived a sign-out;
// - in a property view: a property works on its owner's plan. The flag waits for the account's own view.
// Starter (free) stays on offer for a new account (UpgradePlanModal hides it only for an account that owns properties).
//
// Dashboard and Apps were hidden for role 3 (every self sign-up) whatever the plan, so TheBodyPolitik, upgraded to
// Teams, never got them. Role 3 now gets them on a paid plan (the effective plan_name of /user/storage-overview).

import { planCoveredBy, planKey } from './effectivePlan.ts';

/** 'show' the picker; 'none' (not a new account); 'clear' the flag (already has a plan); 'later' (property view). */
export type PlanPickerDecision = 'show' | 'none' | 'clear' | 'later';

export function newAccountPlanPicker({ flagged, viewType, storageOverview }: {
  flagged: boolean;
  viewType: unknown;
  storageOverview: any;
}): PlanPickerDecision {
  if (!flagged) return 'none';
  if (storageOverview && planCoveredBy(storageOverview)) return 'clear';
  const key = planKey(storageOverview?.plan_name);
  if (key === 'intermediate' || key === 'professional') return 'clear';
  if (viewType === 'property') return 'later';
  // Starter, or no answer (as before: unknown keeps the picker).
  return 'show';
}

/** Dashboard and Apps in the menu: every role but 3 (as before); role 3 once the server says the plan is paid. */
export function showsAccountTools(role: unknown, plan: { isStarter: boolean; known: boolean }): boolean {
  if (String(role ?? '') !== '3') return true;
  return plan.known && !plan.isStarter;
}

/**
 * MemoriesPage's "Trial Ended" picker (non-closable, paid plans only): a Starter self sign-up (role 3) that owns
 * properties, or an owned property whose trial ended, on the Starter plan. Never in a property view, never for an
 * account covered by its main account, and never on an unknown plan (storage-overview failed, e.g. 429): unknown is
 * "don't gate" (review, 5 Nov 2026).
 */
export function trialEndedPicker({ storageOverview, viewType, role, ownedProperties }: {
  storageOverview: any;
  viewType: unknown;
  role: unknown;
  ownedProperties: any[] | null | undefined;
}): boolean {
  if (viewType === 'property' || !storageOverview) return false;
  if (planCoveredBy(storageOverview)) return false;
  if (planKey(storageOverview.plan_name) !== 'starter') return false;
  const owned = Array.isArray(ownedProperties) ? ownedProperties : [];
  return (String(role ?? '') === '3' && owned.length > 0) || owned.some((p) => p?.trial_ended === true);
}

/** The phone bottom bar's Dashboard / Apps: as the sidebar, so never in a property view. */
export function phoneBarShowsAccountTools(viewType: unknown, accountTools: boolean): boolean {
  return viewType !== 'property' && accountTools;
}
