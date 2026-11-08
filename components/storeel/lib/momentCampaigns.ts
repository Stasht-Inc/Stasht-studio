import type { PreviewMoment } from './previewMoments.ts';

// Chris, 8 Nov 2026 (point 2): Add a Moment's "Campaigns (optional)" — link existing campaigns into the campaign ("a
// Storeel can be a series of Storeels"), as Create Campaign's "Select from Existing Campaigns" always did
// (linked_memory_ids → memory_links). Pure, so `node --test` loads it.

/** A campaign as the multi-select lists it. */
export interface CampaignPick { id: string; title: string; image: string | null; count: number }

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const link = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A pending invite GET /memories merges into all_memories (another account's campaign): it can't be linked. */
const isInvite = (m: any): boolean => m?.is_invite === true || m?.is_invite === 1 || m?.is_invite === '1' || (m?.invite_id !== undefined && m?.invite_id !== null);

/**
 * GET /memories (dashboardAPI.getMemories) → the account's campaigns, read the way Create Campaign's picker reads it
 * (all_memories.data / all_memories / memories / user_memories), without `exclude` (the campaign being built) and
 * without pending invites (the web API links only the account's own campaigns; an invite would be refused with 422).
 */
export function campaignsFromMemoriesResponse(res: any, exclude: string | number | null): CampaignPick[] {
  const d = res?.data?.data || res?.data || {};
  const list = d?.all_memories?.data || (Array.isArray(d?.all_memories) ? d.all_memories : null) || d?.memories || d?.user_memories || [];
  if (!Array.isArray(list)) return [];
  return list
    .filter((m: any) => m && m.id !== undefined && m.id !== null && String(m.id) !== String(exclude ?? '') && !isInvite(m))
    .map((m: any) => ({
      id: String(m.id),
      title: text(m.title) || 'Untitled campaign',
      image: link(m.last_update_img) ?? link(m.cover_image) ?? link(m.image_link),
      count: Math.max(0, Math.floor(Number(m.posts_count ?? m.photos?.count ?? m.media_count) || 0)),
    }));
}

/** Campaigns per request (the web API allows up to 100). */
export const CAMPAIGNS_PER_PAGE = 50;

/** GET /memories for one page of the account's campaigns, searched on the server (review I2: not only the first 50). */
export function campaignsQuery({ search, page }: { search: string; page: number }): string {
  const q = search.trim();
  return `/memories?per_page=${CAMPAIGNS_PER_PAGE}&page=${Math.max(1, Math.floor(page) || 1)}${q ? `&search=${encodeURIComponent(q)}` : ''}`;
}

/** all_memories.pagination.last_page of a GET /memories answer (1 when it isn't there). */
export function campaignsLastPage(res: any): number {
  const d = res?.data?.data || res?.data || {};
  const n = Math.floor(Number(d?.all_memories?.pagination?.last_page));
  return Number.isFinite(n) && n > 0 ? n : 1;
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
