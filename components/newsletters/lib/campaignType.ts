// components/newsletters/lib/campaignType.ts
export type CampaignType = 'newsletter' | 'storeel';

/**
 * The tab Create Campaign opens on for Starter (free) accounts, which can't send newsletters: the Newsletter tab
 * shows them the upgrade card. NEEDS CHRIS'S DECISION (wdy2xh2p3n): keep Newsletter, or open Storeel. Flip here.
 */
export const STARTER_DEFAULT_CAMPAIGN_TYPE: CampaignType = 'newsletter';

/**
 * Create Campaign opens on Newsletter (spec 2026-10-13 §2). It opens on Storeel when the caller is clearly making
 * a Storeel: a category was picked (CategoryNav), photos were chosen from the media library, or photos were passed
 * in (Scan Photo). Opening an existing newsletter always shows the Newsletter tab. preferred: the Campaigns page's
 * Storeels | Newsletters view showing (campaignTypeForView; Chris, 4 Nov 2026) — it wins over the defaults below.
 */
export function initialCampaignType(opts: { newsletterId?: number | null; defaultCategory?: string; mediaCount?: number; photoCount?: number; isStarter?: boolean; preferred?: CampaignType }): CampaignType {
  if (opts.newsletterId) return 'newsletter';
  if (opts.defaultCategory || (opts.mediaCount ?? 0) > 0 || (opts.photoCount ?? 0) > 0) return 'storeel';
  if (opts.preferred === 'storeel' || opts.preferred === 'newsletter') return opts.preferred;
  if (opts.isStarter) return STARTER_DEFAULT_CAMPAIGN_TYPE;
  return 'newsletter';
}

/**
 * The tab "+ Create a Campaign" opens on from the Campaigns page: the Storeels | Newsletters view showing (Chris,
 * 4 Nov 2026 — on Storeels it opened the newsletter composer). undefined: not from that page (the defaults apply).
 */
export function campaignTypeForView(view: 'storeels' | 'newsletters' | null | undefined): CampaignType | undefined {
  if (view === 'storeels') return 'storeel';
  if (view === 'newsletters') return 'newsletter';
  return undefined;
}

/**
 * A property account with no category of its own is sent to make one first, but only when Create Campaign would
 * open on Storeel: newsletters don't use categories.
 */
export function needsCategoryFirst(opts: { viewType: string | null | undefined; ownedCategories: number; opensOn: CampaignType }): boolean {
  return opts.opensOn === 'storeel' && opts.viewType === 'property' && opts.ownedCategories === 0;
}
