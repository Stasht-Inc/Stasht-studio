// Plan prices, monthly AI credits and the plan cards' text as Studio shows them. Chris 16 Nov 2026: "Studio is wrong.
// Website is right." — the cards list exactly the marketing website's lines (plus Contact Us Widget and Website
// Catalogue (up to 500 products) on Business), and Deepak decided the real limits change to match:
//   Starter free  — 10 AI credits, 500 emails/mo, 3 Storeels, 1 admin role, 5 collaborators
//   Teams $19     — 100 AI credits, 5,000 emails/mo, unlimited Storeels, 2 admin roles (Popular)
//   Business $39  — 250 AI credits, 10,000 emails/mo, 5 admin roles, moderation, properties (was $29 until 16 Nov)
// Yearly keeps the old "Save 17%" ratio (0.83: the old Teams $9 showed $7.47/month yearly), so Business yearly is
// $32.37/month = $388.44/year.
//
// What checkout CHARGES is the Stripe price the web API picks (STRIPE_PRICE_* in its .env), and what the monthly refresh
// GRANTS is config('plans.credits') in both APIs; these numbers only describe them, so keep all three in step.
// Ids as UpgradePlanModal's: starter / intermediate (Teams) / professional (Business).

export type PricedPlan = 'starter' | 'intermediate' | 'professional';

export const PLAN_PRICING: Record<PricedPlan, { monthly: number; credits: number }> = {
  starter: { monthly: 0, credits: 10 },
  intermediate: { monthly: 19, credits: 100 },
  professional: { monthly: 39, credits: 250 },
};

/** Yearly costs 83% of monthly ("Save 17%"). */
export const YEARLY_RATIO = 0.83;

const cents = (n: number) => Math.round(n * 100) / 100;

/** The per-month price on the yearly plan, e.g. 19 → 15.77. */
export function yearlyMonthlyPrice(monthly: number): number {
  return cents(monthly * YEARLY_RATIO);
}

/** What the yearly plan charges once a year, e.g. 19 → 189.24. */
export function yearlyTotal(monthly: number): number {
  return cents(yearlyMonthlyPrice(monthly) * 12);
}

/** The plan card's credits line, as the website: "AI Tokens (10 credits/mo)". */
export function creditsFeature(plan: PricedPlan): string {
  return `AI Tokens\n(${PLAN_PRICING[plan].credits} credits/mo)`;
}

/** The price as the cards show it: whole dollars monthly ("19"), cents yearly ("15.77"). */
export function priceLabel(monthly: number, yearly: boolean): string {
  return yearly ? yearlyMonthlyPrice(monthly).toFixed(2) : String(monthly);
}

/** Monthly email-campaign sends (the web API's config newsletters.allowance; Starter sends no texts). */
export const PLAN_EMAILS: Record<PricedPlan, number> = {
  starter: 500,
  intermediate: 5000,
  professional: 10000,
};

/** The card's email line: "Email Campaigns (5,000 emails/mo)". */
export function emailsFeature(plan: PricedPlan): string {
  return `Email Campaigns\n(${PLAN_EMAILS[plan].toLocaleString('en-US')} emails/mo)`;
}

/** Each card's description line, as the website. */
export const PLAN_DESCRIPTIONS: Record<PricedPlan, string> = {
  starter: 'Perfect for small teams getting started with brand storytelling.',
  intermediate: 'For growing organizations that need more features.',
  professional: 'For large organizations with marketing teams.',
};

/**
 * The plan cards' lines, in the website's order. Business adds Contact Us Widget (Chris: it stays Business-only) and
 * Website Catalogue (up to 500 products) (Chris, 16 Nov 2026; Enterprise gets 1,000). No storage, sync or publishing
 * lines any more (the website has none).
 */
export const PLAN_FEATURES: Record<PricedPlan, string[]> = {
  starter: [
    creditsFeature('starter'),
    emailsFeature('starter'),
    '3 Storeels',
    '1 Admin Role',
    '5 Collaborators',
    'Leads Manager',
  ],
  intermediate: [
    creditsFeature('intermediate'),
    emailsFeature('intermediate'),
    'Unlimited Storeels',
    'Connectors',
    '2 Admin Roles',
    'Unlimited Collaborators',
    'Leads Manager',
  ],
  professional: [
    creditsFeature('professional'),
    emailsFeature('professional'),
    'Unlimited Storeels',
    'Connectors',
    '5 Admin Roles',
    'Unlimited Collaborators',
    'Leads Manager',
    'Moderation Tool',
    'Add Properties',
    'Contact Us Widget',
    'Website Catalogue\n(up to 500 products)',
  ],
};

/** The plan the website marks "Popular". */
export const POPULAR_PLAN: PricedPlan = 'intermediate';

/** Billing's "Upgrade to Unlock": the next plan's lines the current plan doesn't already have. */
export function unlockedFeatures(current: string[], next: string[]): string[] {
  const have = new Set(current);
  return next.filter((line) => !have.has(line) && !line.startsWith('Everything in'));
}
