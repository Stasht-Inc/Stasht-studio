// components/newsletters/lib/campaignType.ts
export type CampaignType = 'newsletter' | 'storeel';

/**
 * Create Campaign opens on Newsletter (spec 2026-10-13 §2). It opens on Storeel when the caller is clearly making
 * a Storeel: a category was picked (CategoryNav) or photos were chosen from the media library. Opening an
 * existing newsletter always shows the Newsletter tab.
 */
export function initialCampaignType(opts: { newsletterId?: number | null; defaultCategory?: string; mediaCount?: number }): CampaignType {
  if (opts.newsletterId) return 'newsletter';
  if (opts.defaultCategory || (opts.mediaCount ?? 0) > 0) return 'storeel';
  return 'newsletter';
}
