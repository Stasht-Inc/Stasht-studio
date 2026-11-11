// The Dashboard's "User Engagement" chart filter (Chris, 11 Nov 2026): All campaigns (default) / Newsletters / Storeels.
// GET /dashboard/user-engagement?metric=… answers the series, totals, peak and growth for the chosen one.

export type EngagementMetric = 'campaigns' | 'newsletters' | 'storeels';

export const ENGAGEMENT_METRICS: { value: EngagementMetric; label: string; legend: string; total: string }[] = [
  { value: 'campaigns', label: 'All campaigns', legend: 'Campaign views', total: 'Total Views' },
  { value: 'newsletters', label: 'Newsletters', legend: 'Newsletter opens', total: 'Total Opens' },
  { value: 'storeels', label: 'Storeels', legend: 'Storeel views', total: 'Total Views' },
];

export function engagementMetricInfo(metric: string | null | undefined) {
  return ENGAGEMENT_METRICS.find((m) => m.value === metric) ?? ENGAGEMENT_METRICS[0];
}

/** The chart's empty slots for a period — zeros, never made-up numbers (shown while loading or when the API fails). */
export function emptyEngagementSeries(period: string, now: Date = new Date()): { day: string; views: number; date: string }[] {
  const slot = (label: string) => ({ day: label, views: 0, date: label });
  switch (period) {
    case 'daily':
      return Array.from({ length: 24 }, (_, h) => slot(`${String(h).padStart(2, '0')}:00`));
    case 'monthly': {
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => slot(String(i + 1)));
    }
    case 'annually':
      return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(slot);
    default:
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(slot);
  }
}
