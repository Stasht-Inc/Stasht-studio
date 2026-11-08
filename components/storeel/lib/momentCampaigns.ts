import type { PreviewMoment } from './previewMoments.ts';

// Chris, 8 Nov 2026 (point 2): Add a Moment's "Campaigns (optional)" — link existing campaigns into the campaign ("a
// Storeel can be a series of Storeels"), as Create Campaign's "Select from Existing Campaigns" always did
// (linked_memory_ids → memory_links). Pure, so `node --test` loads it.

/** A campaign as the multi-select lists it. */
export interface CampaignPick { id: string; title: string; image: string | null; count: number }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const link = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * GET /memories (dashboardAPI.getMemories) → the account's campaigns, read the way Create Campaign's picker reads it
 * (all_memories.data / all_memories / memories / user_memories), without `exclude` (the campaign being built).
 */
export function campaignsFromMemoriesResponse(res: any, exclude: string | number | null): CampaignPick[] {
  const d = res?.data?.data || res?.data || {};
  const list = d?.all_memories?.data || (Array.isArray(d?.all_memories) ? d.all_memories : null) || d?.memories || d?.user_memories || [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((m: any) => m && m.id !== undefined && m.id !== null && String(m.id) !== String(exclude ?? ''))
    .map((m: any) => ({
      id: String(m.id),
      title: text(m.title) || 'Untitled campaign',
      image: link(m.last_update_img) ?? link(m.cover_image) ?? link(m.image_link),
      count: Math.max(0, Math.floor(Number(m.posts_count ?? m.photos?.count ?? m.media_count) || 0)),
    }));
}

/** Picked campaigns as the live preview shows them before Save as Draft: a linked campaign card each. */
export function campaignPreviewMoments(picks: ReadonlyArray<CampaignPick>): PreviewMoment[] {
  return picks.map((c) => ({ kind: 'campaign', key: `campaign-${c.id}`, sourceId: c.id, image: c.image, title: c.title, meta: `${c.count} ${c.count === 1 ? 'photo' : 'photos'}` }));
}

/** The toast after campaigns are linked to a saved campaign. */
export function linkedCampaignsMessage(linked: number, already: number): string {
  if (!linked) return 'Those campaigns are already in this campaign.';
  return `${linked} ${linked === 1 ? 'campaign' : 'campaigns'} linked to your campaign.${already ? ` ${already} ${already === 1 ? 'was' : 'were'} already in it.` : ''}`;
}
