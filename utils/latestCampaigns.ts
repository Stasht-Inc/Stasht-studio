// utils/latestCampaigns.ts
// Chris, 19 Nov 2026 (point 18): the Dashboard's "Latest Campaigns" — the API sends them most recently opened or
// edited first (the campaign's updated_at, shown as "Last Visited"). Sorting the Last Visited column sorts by that
// time, not by its "2 hours ago" / "Jul 20/26" text (which sorted alphabetically).

/** The time "Last Visited" shows, in ms (0 when unknown): the campaign's updated_at. */
export function lastVisitedTime(mem: { updated_at?: string | null; invited_at?: string | null; created_at?: string | null } | null | undefined): number {
  if (!mem) return 0;
  for (const v of [mem.updated_at, mem.created_at, mem.invited_at]) {
    const t = v ? Date.parse(v) : NaN;
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/** Compare two rows by their Last Visited time; 'desc' = most recent first. */
export function compareLastVisited(a: { lastVisitedAt?: number }, b: { lastVisitedAt?: number }, direction: 'asc' | 'desc'): number {
  const d = (a.lastVisitedAt ?? 0) - (b.lastVisitedAt ?? 0);
  return direction === 'asc' ? d : -d;
}
