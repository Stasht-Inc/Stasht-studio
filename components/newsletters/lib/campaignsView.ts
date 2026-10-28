// The Campaigns page's Storeels | Newsletters switch and the Newsletters list filters. Pure.
import type { NewsletterStatus } from '../../../services/newslettersAPI.ts';

export type CampaignsView = 'storeels' | 'newsletters';

export const CAMPAIGNS_VIEW_OPTIONS: ReadonlyArray<{ value: CampaignsView; label: string }> = [
  { value: 'storeels', label: 'Storeels' },
  { value: 'newsletters', label: 'Newsletters' },
];

/**
 * The Campaigns page opens on Storeels the first time; after that it opens on the last choice made on this device
 * (wdy2xh2t3y). Opening on Newsletters calls no newsletter endpoint by itself: the Newsletters view waits until the
 * plan is known to be paid (a Starter account would get a 403 that opens the upgrade plans, contract note 1), and
 * a Starter account goes back to Storeels (campaignsViewForPlan).
 */
export const DEFAULT_CAMPAIGNS_VIEW: CampaignsView = 'storeels';

/** localStorage key for the Storeels | Newsletters choice (per device). */
export const CAMPAIGNS_VIEW_KEY = 'stasht_campaigns_view';

type ViewStorage = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

function defaultStorage(): ViewStorage {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The remembered choice, or Storeels (nothing saved, an unknown value, or storage that can't be read). */
export function readCampaignsView(storage: ViewStorage = defaultStorage()): CampaignsView {
  try {
    const value = storage?.getItem(CAMPAIGNS_VIEW_KEY);
    return value === 'newsletters' || value === 'storeels' ? value : DEFAULT_CAMPAIGNS_VIEW;
  } catch {
    return DEFAULT_CAMPAIGNS_VIEW;
  }
}

export function writeCampaignsView(view: CampaignsView): void;
export function writeCampaignsView(storage: ViewStorage, view: CampaignsView): void;
export function writeCampaignsView(a: ViewStorage | CampaignsView, b?: CampaignsView): void {
  const [storage, view] = typeof a === 'string' ? [defaultStorage(), a] : [a, b as CampaignsView];
  try {
    storage?.setItem(CAMPAIGNS_VIEW_KEY, view);
  } catch {
    // Private mode or blocked storage: the choice just isn't remembered.
  }
}

/** A remembered Newsletters choice stands on a paid plan (or while the plan is still loading: the view waits). */
export function campaignsViewForPlan(view: CampaignsView, plan: { known: boolean; isStarter: boolean }): CampaignsView {
  return view === 'newsletters' && plan.known && plan.isStarter ? 'storeels' : view;
}

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

/** Save Draft: the composer closes and the draft waits at the top of Campaigns › Newsletters (wdy2xh2t3y). */
export const DRAFT_SAVED_MESSAGE = 'Draft saved. Find it in Campaigns › Newsletters.';

/** Fired (with the newsletter id as detail) to show Campaigns › Newsletters with that newsletter highlighted. */
export const OPEN_NEWSLETTER_DRAFT_EVENT = 'stasht-open-newsletter-draft';

let pendingHighlightId: number | null = null;

/** Go to Campaigns › Newsletters with this draft highlighted at the top. The id waits until the page takes it. */
export function openNewsletterDraft(id: number): void {
  pendingHighlightId = id;
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'memories' }));
  window.dispatchEvent(new CustomEvent(OPEN_NEWSLETTER_DRAFT_EVENT, { detail: id }));
}

export function takePendingNewsletterHighlight(): number | null {
  const id = pendingHighlightId;
  pendingHighlightId = null;
  return id;
}

/** The highlighted newsletter first, the rest in the API's order (the same array when there is nothing to move). */
export function withHighlightFirst<T extends { id: number }>(rows: T[], id: number | null): T[] {
  if (id === null) return rows;
  const index = rows.findIndex((r) => r.id === id);
  if (index < 0) return rows;
  return [rows[index], ...rows.slice(0, index), ...rows.slice(index + 1)];
}
