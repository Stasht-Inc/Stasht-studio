// The plan an account sees (Deepak, 1 Nov 2026, batch 3 item 2).
//
// An external account made for a main account's property (a salesperson) is covered by its main account: while its
// property is active and the main account is on a paid plan, it works on that plan at no charge (the web API's
// EffectivePlan). GET /user/storage-overview and GET /user/profile send that effective plan_name and plan_covered_by
// {id, name} (the main account; null on the account's own plan). So wherever it sees its plan it sees "Business" with
// "Covered by Serpa Chrysler", never its own "Starter", and no upgrade prompt for what that plan already includes.
//
// Plan names: the plans rows are named Starter / Intermediate or Teams / Professional or Business (the live Business
// row is "Business", its Stripe code "professional"); Studio sells them as Starter, Teams and Business
// (components/UpgradePlanModal ids starter / intermediate / professional).

export type PlanKey = 'starter' | 'intermediate' | 'professional';
export type PlanCoveredBy = { id: number | string | null; name: string };

const LABELS: Record<PlanKey, 'Starter' | 'Teams' | 'Business'> = { starter: 'Starter', intermediate: 'Teams', professional: 'Business' };

/** UpgradePlanModal's id for a plan name, or null when the name is none of the three. */
export function planKey(name: unknown): PlanKey | null {
  const text = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!text) return null;
  if (text.includes('starter') || text === 'free') return 'starter';
  if (text.includes('intermediate') || text.includes('team')) return 'intermediate';
  if (text.includes('professional') || text.includes('business')) return 'professional';
  return null;
}

/**
 * Enterprise = Business baseline (Deepak, 11 Nov 2026): a paid plan named none of the three (set up for the account in the
 * Admin Portal — Enterprise) works as Business for every feature and limit. The web API and mobile API decide the same
 * way (BusinessBaseline): not Starter, not Teams, not Business, and not "Family & Friends".
 */
export function isBusinessBaselinePlan(name: unknown): boolean {
  // Review of 11 Nov 2026: ONLY plans named Enterprise; other custom paid plans keep today's behaviour.
  const text = typeof name === 'string' ? name.trim().toLowerCase() : '';
  return !!text && planKey(text) !== 'starter' && text.includes('enterprise');
}

/**
 * The plan Studio's feature and limit checks go by: planKey, with Enterprise and other Admin Portal plans as Business
 * ('professional'). Labels, badges and canSelfUpgrade keep planKey, so Enterprise still contacts sales.
 */
export function featurePlanKey(name: unknown): PlanKey | null {
  return planKey(name) ?? (isBusinessBaselinePlan(name) ? 'professional' : null);
}

/** Admin seats per plan when the server's number isn't known: Business 5, Teams 3, Starter 1 (the APIs' role map). */
const SEATS_BY_PLAN: Record<PlanKey, number> = { professional: 5, intermediate: 3, starter: 1 };

/**
 * The admin-seat limit to show (Users page "Admins x/y"): the server's number from check-memory-limit's
 * admin_limit_status (it includes the account's Admin Portal override) when known, null for unlimited, else the plan's
 * seats (Enterprise as Business: 5).
 */
export function adminSeatLimit(planName: unknown, adminLimit: { status?: unknown; max_allowed?: unknown } | null | undefined): number | null {
  if (adminLimit?.status === 'unlimited') return null;
  const max = Number(adminLimit?.max_allowed);
  if (adminLimit && adminLimit.max_allowed !== undefined && adminLimit.max_allowed !== null && Number.isFinite(max) && max >= 0) return max;
  return SEATS_BY_PLAN[featurePlanKey(planName) ?? 'starter'];
}

/** "Starter", "Teams" or "Business" for a plan name, or null. */
export function planLabel(name: unknown): 'Starter' | 'Teams' | 'Business' | null {
  const key = planKey(name);
  return key ? LABELS[key] : null;
}

/**
 * The Enterprise package's name from a storage-overview / profile payload (package_name), or null. Packages are set up
 * and assigned in the Admin Portal (Chris via Deepak, 11 Nov 2026) and Studio shows the package's name as the plan.
 * Display only: plan_name (and every gate above) is unchanged, and the APIs send it only while the account is on its
 * package (null once moved to Starter for an overdue invoice).
 */
export function packageName(source: any): string | null {
  const name = typeof source?.package_name === 'string' ? source.package_name.trim() : '';
  return name || null;
}

/** plan_covered_by of a storage-overview / profile payload: the main account whose plan this is, or null. */
export function planCoveredBy(source: any): PlanCoveredBy | null {
  const covered = source?.plan_covered_by;
  if (!covered || typeof covered !== 'object') return null;
  const name = typeof covered.name === 'string' ? covered.name.trim() : '';
  return { id: covered.id ?? null, name };
}

/** The small note next to a covered plan: "Covered by Serpa Chrysler". */
export function coveredByNote(coveredBy: PlanCoveredBy | null | undefined): string | null {
  if (!coveredBy) return null;
  return `Covered by ${coveredBy.name.trim() || 'your main account'}`;
}

/** Whether to offer "Upgrade Plan": not when the main account already covers the top plan (Business). */
export function offersUpgrade(planName: unknown, coveredBy: PlanCoveredBy | null | undefined, pkg?: string | null): boolean {
  // An Enterprise package is billed by Stasht: never offer a self-serve plan on top (review of 11 Nov 2026).
  if (pkg) return false;
  return !(coveredBy && planKey(planName) === 'professional');
}

/** What an account on an Enterprise package sees instead of "Upgrade Plan". */
export const MANAGED_BY_STASHT = 'Your plan is managed by Stasht — contact sales to change it.';

/** storage_overview out of a dashboardAPI.getStorageOverview() answer (either nesting), or null. */
export function storageOverviewOf(response: any): any | null {
  return response?.data?.data?.storage_overview || response?.data?.storage_overview || null;
}

/**
 * A new account's "Upgrade Your Plan" picker (App, after activation or sign-up: is_new_user) is skipped for an account
 * covered by its main account — it already works on that plan (E2E, 1 Nov 2026: a salesperson activating by email got
 * the non-closable picker). Unknown (no answer) keeps the picker, as before.
 */
export function skipsPlanPicker(storageOverview: any): boolean {
  return !!planCoveredBy(storageOverview);
}

/** Where an account that can't buy a bigger plan itself is sent (the same "Contact us" as UpgradePlanModal's Enterprise note). */
export const CONTACT_SALES_URL = 'https://stasht.com/#contact';

/**
 * Whether the account can buy a bigger plan itself in Studio's Billing (Chris, 10 Nov 2026: Royal Wood, an Enterprise
 * account, was told "Admin Limit Reached — Please upgrade your account"; "This should say contact sales. They already
 * have an enterprise account and can't upgrade."). Only Starter and Teams have a bigger plan to buy. Business is the top
 * plan; any other plan name is one set up for the account in the Admin Portal (Enterprise); an account covered by its
 * main account's plan doesn't choose its plan. Those contact sales instead. Not known yet (no plan name): true, the
 * prompt stays as it was.
 */
export function canSelfUpgrade(planName: unknown, coveredBy: PlanCoveredBy | null | undefined): boolean {
  if (coveredBy) return false;
  if (planName === null || planName === undefined || (typeof planName === 'string' && !planName.trim())) return true;
  const key = planKey(planName);
  return key === 'starter' || key === 'intermediate';
}
