/** Fired after the plan changes (UpgradePlanModal) so plan-gated UI re-checks. */
export const PLAN_CHANGED_EVENT = 'stasht-plan-changed';

export const announcePlanChange = () => window.dispatchEvent(new Event(PLAN_CHANGED_EVENT));

/**
 * Asks App to open the upgrade plans: a paid-plan-only feature (Connectors) was used on the free
 * plan. Sent by the Connectors page, and by apiRequest when the API answers 403 plan_required.
 */
export const UPGRADE_REQUIRED_EVENT = 'stasht-upgrade-required';

export const requestUpgrade = (message?: string) =>
  window.dispatchEvent(new CustomEvent(UPGRADE_REQUIRED_EVENT, { detail: { message } }));
