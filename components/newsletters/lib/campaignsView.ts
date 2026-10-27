// The Campaigns page's Storeels | Newsletters switch and the Newsletters list filters. Pure.
import type { NewsletterStatus } from '../../../services/newslettersAPI.ts';

export type CampaignsView = 'storeels' | 'newsletters';

export const CAMPAIGNS_VIEW_OPTIONS: ReadonlyArray<{ value: CampaignsView; label: string }> = [
  { value: 'storeels', label: 'Storeels' },
  { value: 'newsletters', label: 'Newsletters' },
];

/**
 * The Campaigns page always opens on Storeels, and the choice is not remembered: opening straight onto
 * Newsletters would call the newsletter endpoints on page load, which Starter accounts answer with a 403 that
 * opens the upgrade plans (contract note 1).
 */
export const DEFAULT_CAMPAIGNS_VIEW: CampaignsView = 'storeels';

export type NewsletterFilter = 'all' | Extract<NewsletterStatus, 'draft' | 'scheduled' | 'sent'>;

/** GET /newsletters?status= takes one status; "All" sends none (and is where sending, failed and cancelled show).
 *  Four, so the switch fits a 360 px phone. */
export const NEWSLETTER_FILTERS: ReadonlyArray<{ value: NewsletterFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
];

/** Fired after a newsletter is saved, sent, scheduled, cancelled or deleted, wherever the composer was opened from. */
export const NEWSLETTERS_CHANGED_EVENT = 'stasht-newsletters-changed';

export function announceNewslettersChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NEWSLETTERS_CHANGED_EVENT));
}

/** Fired (with the newsletter id as detail) to show one newsletter's results on Campaigns › Newsletters. */
export const OPEN_NEWSLETTER_RESULTS_EVENT = 'stasht-open-newsletter-results';

let pendingResultsId: number | null = null;

/**
 * "View" on the sent / scheduled toast: go to the Campaigns page, switch to Newsletters and open the results. The
 * id waits here until the page takes it (it may not be mounted yet when App navigates).
 */
export function openNewsletterResults(id: number): void {
  pendingResultsId = id;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'memories' }));
  window.dispatchEvent(new CustomEvent(OPEN_NEWSLETTER_RESULTS_EVENT, { detail: id }));
}

export function takePendingNewsletterResults(): number | null {
  const id = pendingResultsId;
  pendingResultsId = null;
  return id;
}
