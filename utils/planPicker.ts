// The plan picker's selection and button (components/UpgradePlanModal; release E2E, 5 Nov 2026, B2).
//
// The account's plan can arrive under either name family: the plans rows / Admin Portal ("Teams", "Business") or the
// Stripe codes ("intermediate", "professional"). utils/effectivePlan planKey reads both. The account's own plan is
// marked "Current plan" and can't be bought again (a Teams account was offered "Upgrade to Teams").

import { planKey, type PlanKey } from './effectivePlan.ts';

const LEVEL: Record<PlanKey, number> = { starter: 1, intermediate: 2, professional: 3 };

/** The card selected when the picker opens: the next plan up (Business for Teams and Business), else Teams. */
export function defaultPickerPlan(currentPlan: unknown): PlanKey {
  const current = planKey(currentPlan);
  return current === 'intermediate' || current === 'professional' ? 'professional' : 'intermediate';
}

/** The card is the account's own plan (unknown plan: no card is). */
export function isCurrentPlan(currentPlan: unknown, planId: string): boolean {
  const current = planKey(currentPlan);
  return !!current && current === planId;
}

/** The main button for the selected card. */
export function pickerButton(currentPlan: unknown, selectedPlan: string, selectedName: string): { label: string; disabled: boolean } {
  if (isCurrentPlan(currentPlan, selectedPlan)) return { label: 'Current plan', disabled: true };
  if (selectedPlan === 'starter') return { label: 'Get Started', disabled: false };
  const current = planKey(currentPlan);
  const from = current ? LEVEL[current] : 0;
  const to = LEVEL[selectedPlan as PlanKey] ?? 0;
  return { label: `${to < from ? 'Downgrade' : 'Upgrade'} to ${selectedName}`, disabled: false };
}

/** Billing's AI credits line: "90 of 100 credits left" (was "10 / 100 Credits", which read as 10 left). */
export function creditsLeftLabel(used: unknown, allowance: unknown): string {
  const total = Math.max(0, Math.floor(Number(allowance) || 0));
  const left = Math.max(0, total - Math.max(0, Math.floor(Number(used) || 0)));
  return `${left.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} ${total === 1 ? 'credit' : 'credits'} left`;
}

/** The account's plan trial from a GET /properties answer (data.account_trial), or null. Property trials don't count. */
export function accountTrialOf(propertiesResponse: any): { trial_ended?: boolean } | null {
  const d = propertiesResponse?.data?.data || propertiesResponse?.data || {};
  const t = d?.account_trial;
  return t && typeof t === 'object' ? t : null;
}

/** An active Stripe subscription in a stripeApi.getCurrentSubscription() answer; null when unknown (failed). */
export function hasActiveSubscription(subscriptionResponse: any): boolean | null {
  if (!subscriptionResponse || subscriptionResponse.success !== true) return null;
  return Array.isArray(subscriptionResponse.active_subscriptions) && subscriptionResponse.active_subscriptions.length > 0;
}

/**
 * The plan the picker treats as the account's own ("Current plan", not for sale): with an active subscription, or an
 * admin-set plan with no Admin Portal trial (comped). On a trial (running or ended) without a subscription the account
 * must be able to buy its plan, so nothing is current. Until both answers are in, the plan stays current.
 */
export function pickerCurrentPlan(
  planName: string | undefined,
  { known, accountTrial, activeSubscription }: { known: boolean; accountTrial: unknown; activeSubscription: boolean },
): string | undefined {
  if (!planName || !known) return planName;
  if (activeSubscription) return planName;
  return accountTrial ? undefined : planName;
}
