// Chris, 29 Oct (round 2), items 4 and 5: the Campaign section picker's "Chosen (N of 6)" strip and its infinite
// scroll. Pure, so `node --test` loads it directly.
import type { CampaignItem, CampaignKind, CampaignOption, CampaignSelection } from '../../../services/newslettersAPI.ts';
import { CAMPAIGNS_MAX, selectionKey } from './campaignsBlock.ts';
import { httpsUrl } from './urls.ts';

export const chosenHeading = (count: number): string => `Chosen (${count} of ${CAMPAIGNS_MAX})`;

export interface ChosenEntry {
  key: string;
  kind: CampaignKind;
  id: number;
  /** null when neither the loaded pages nor the section's cards know this pick. */
  title: string | null;
  cover: string | null;
}

/** Every pick, in picking order, with what is known about it: what was seen while the picker is open first, then
 *  the section's own cards (picks on pages that aren't loaded, or on another tab). */
export function chosenEntries(picked: readonly CampaignSelection[], seen: ReadonlyMap<string, CampaignItem>, known: readonly CampaignItem[]): ChosenEntry[] {
  const byKey = new Map(known.map((i) => [selectionKey(i), i]));
  return picked.map((s) => {
    const key = selectionKey(s);
    const found = seen.get(key) ?? byKey.get(key);
    return { key, kind: s.kind, id: s.id, title: found?.title?.trim() ? found.title : null, cover: httpsUrl(found?.cover_url ?? '') ?? null };
  });
}

/** A later page's rows added to the list: only ones not listed yet (the same kind and id). */
export function mergeOptionRows<T extends Pick<CampaignOption, 'id'> & { kind: CampaignKind }>(prev: readonly T[] | null, next: readonly T[]): T[] {
  const out = [...(prev ?? [])];
  const keys = new Set(out.map(selectionKey));
  for (const r of next) {
    const key = selectionKey(r);
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(r);
  }
  return out;
}

/** The page to ask for when the end of the list scrolls into view, or null: nothing more, already loading, or the
 *  last try failed (then the person asks again). */
export function nextPageToLoad(s: { page: number; totalPages: number; loading: boolean; failed: boolean }): number | null {
  if (s.loading || s.failed || s.page >= s.totalPages) return null;
  return s.page + 1;
}

/** The list a page belongs to: the request that started it and the tab, search and category it was asked with. */
export interface PickerList { request: number; kind: CampaignKind; query: string; category: string }

/** campaign-options for one page of that list (campaigns take no category). */
export function pageRequest(list: PickerList, page: number): { kind: CampaignKind; search: string; category: string | undefined; page: number } {
  return { kind: list.kind, search: list.query, category: list.kind === 'campaign' || !list.category ? undefined : list.category, page };
}
