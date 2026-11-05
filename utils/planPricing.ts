// Plan prices and monthly AI credits as Studio shows them (Chris 5 Nov 2026, points 5 + 7; Deepak's decision the same day):
// Teams $19/month with 100 AI credits a month, Business $29/month with 250. Yearly keeps the old "Save 17%" ratio
// (0.83: the old Teams $9 showed $7.47/month yearly).
//
// What checkout CHARGES is the Stripe price the web API picks (STRIPE_PRICE_* in its .env), and what the monthly refresh
// GRANTS is plans.ai_connects in the database; these numbers only describe them, so keep all three in step.
// Ids as UpgradePlanModal's: starter / intermediate (Teams) / professional (Business).

export type PricedPlan = 'starter' | 'intermediate' | 'professional';

export const PLAN_PRICING: Record<PricedPlan, { monthly: number; credits: number }> = {
  starter: { monthly: 0, credits: 5 },
  intermediate: { monthly: 19, credits: 100 },
  professional: { monthly: 29, credits: 250 },
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

/** The plan card's credits line. */
export function creditsFeature(plan: PricedPlan): string {
  return `AI Credits\n(${PLAN_PRICING[plan].credits} credits/mo)`;
}

/** The price as the cards show it: whole dollars monthly ("19"), cents yearly ("15.77"). */
export function priceLabel(monthly: number, yearly: boolean): string {
  return yearly ? yearlyMonthlyPrice(monthly).toFixed(2) : String(monthly);
}
