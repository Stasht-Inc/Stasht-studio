// Deepak, 9 Nov 2026: "Select from Existing Campaigns" back on Edit (commit 2c44261 had hidden it). The ticks are the
// campaign's SAVED linked campaigns plus the changes made in the list; Save Changes then links the newly ticked
// (POST /memories/{id}/linked-memories) and unlinks the unticked (DELETE /memories/{id}/linked-memories/{linked_id}).
// Kept as a change set (added / removed), so a campaign linked meanwhile with Add a Moment's "Campaigns (optional)" —
// or unlinked from step 2 — shows the same here. Pure, so `node --test` loads it.
import type { PreviewMoment } from './previewMoments.ts';

export interface LinkChanges { add: string[]; remove: string[] }
export const EMPTY_LINKS: LinkChanges = { add: [], remove: [] };

export const LINKS_SAVE_NOTE = 'Linked and removed when you press Save Changes.';
export const LINKS_FAILED = "Your changes were saved, but the linked campaigns couldn't be updated. Try again.";

/** The campaign's linked campaigns, from its saved moments (campaign cards; not vehicles or Shopify collections). */
export function savedLinkedCampaignIds(moments: ReadonlyArray<PreviewMoment | Record<string, any>> | null | undefined): string[] {
  if (!Array.isArray(moments)) return [];
  return moments
    .filter((m: any) => m && m.kind === 'campaign' && !String(m.key ?? '').startsWith('shopify-') && m.sourceId !== undefined)
    .map((m: any) => String(m.sourceId));
}

const uniq = (ids: string[]) => [...new Set(ids)];

/** What the list shows ticked. */
export function tickedLinks(saved: readonly string[], changes: LinkChanges): string[] {
  return uniq([...saved.filter((id) => !changes.remove.includes(id)), ...changes.add.filter((id) => !changes.remove.includes(id))]);
}

/** Tick / untick one campaign (relative to what is shown); a change undone leaves nothing behind. */
export function toggleLink(saved: readonly string[], changes: LinkChanges, id: string): LinkChanges {
  const shown = tickedLinks(saved, changes).includes(id);
  const isSaved = saved.includes(id);
  const add = changes.add.filter((x) => x !== id);
  const remove = changes.remove.filter((x) => x !== id);
  if (shown) return isSaved ? { add, remove: [...remove, id] } : { add, remove };
  return isSaved ? { add, remove } : { add: [...add, id], remove };
}

/** Select All (review fix): ADD the campaigns the list shows now (search / category) to the ticks; nothing else changes. */
export function selectVisible(saved: readonly string[], changes: LinkChanges, visible: readonly string[]): LinkChanges {
  return {
    add: uniq([...changes.add, ...visible.filter((id) => !saved.includes(id))]),
    remove: changes.remove.filter((id) => !visible.includes(id)),
  };
}

/** Deselect All (review fix): untick only the campaigns the list shows now. A saved link hidden by the search, or not in
 *  the list at all, is never unlinked this way. */
export function deselectVisible(saved: readonly string[], changes: LinkChanges, visible: readonly string[]): LinkChanges {
  return {
    add: changes.add.filter((id) => !visible.includes(id)),
    remove: uniq([...changes.remove, ...visible.filter((id) => saved.includes(id))]),
  };
}

/** Save Changes: what to link and unlink now (against the saved links at that moment). */
export function linkChanges(saved: readonly string[], changes: LinkChanges): { link: string[]; unlink: string[] } {
  const want = tickedLinks(saved, changes);
  return { link: want.filter((id) => !saved.includes(id)), unlink: saved.filter((id) => !want.includes(id)) };
}

const isInvite = (m: any): boolean => m?.is_invite === true || m?.is_invite === 1 || m?.is_invite === '1' || (m?.invite_id !== undefined && m?.invite_id !== null);

/** The Edit list: the account's campaigns from GET /memories, never the campaign itself or a pending invite. */
export function editPickerCampaigns<T extends Record<string, any>>(list: ReadonlyArray<T | null | undefined>, exclude: number | string | null | undefined): T[] {
  return (list ?? []).filter((m): m is T => Boolean(m) && m!.id !== undefined && m!.id !== null && String(m!.id) !== String(exclude ?? '') && !isInvite(m));
}
