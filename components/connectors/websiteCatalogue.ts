// Website Catalogue connector (spec 2026-09-30 §8.1–8.2): the card's state, and small helpers the
// connect and manage dialogs share.
import type {
  CatalogueOverview,
  CatalogueScan,
  CatalogueScanOutcome,
  CatalogueSource,
  CatalogueSourceStatus,
  CatalogueSyncProgress,
} from '../../services/catalogueAPI';
import type { ConnectorCardOverride } from './catalog';

/** The progress Studio shows while the engine analyses a website (spec §8.2 step 3), in order. */
export const PROGRESS_STEPS = [
  { key: 'verifying', label: 'Verifying ownership' },
  { key: 'checking', label: 'Checking your website' },
  { key: 'discovering', label: 'Finding your products' },
  { key: 'learning', label: "Learning your site's layout" },
  { key: 'preview', label: 'Preparing your preview' },
] as const;

/** Index of the scan's current step in PROGRESS_STEPS (0 until the engine picks the scan up). */
export function progressIndex(scan: CatalogueScan | null): number {
  const index = PROGRESS_STEPS.findIndex((step) => step.key === scan?.progress_step);
  return index < 0 ? 0 : index;
}

export const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** "just now", "5 minutes ago", "2 hours ago", "3 days ago"; null when there is no (valid) date. */
export function formatRelative(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  return `${plural(Math.round(hours / 24), 'day')} ago`;
}

/** "We found about 42 items." / "We found more than 640 items. We'll import the first 500." (spec §8.2 step 4) */
export function foundSummary(outcome: CatalogueScanOutcome): string {
  const n = outcome.estimated_items ?? outcome.preview.length;
  const found = `We found ${outcome.estimated_items_is_minimum ? 'more than' : 'about'} ${plural(n, 'item')}`;
  return outcome.over_limit ? `${found}. We'll import the first ${outcome.item_limit.toLocaleString('en-US')}.` : `${found}.`;
}

/** The Sync now button's words for the source's state. */
export function syncNowLabel(status: CatalogueSourceStatus): string {
  if (status === 'blocked') return 'Retest';
  if (status === 'unverified') return 'Check again';
  return 'Sync now';
}

/** Teams → Business: the Billing page with its upgrade plans open (as InviteToMemoryModal does). */
export function openBillingUpgrade(): void {
  sessionStorage.setItem('billing_open_upgrade', 'true');
  window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'billing' }));
}

/**
 * Window event the connect and Sync now flows send when a sync has been queued, so the sidebar's
 * CatalogueSyncWatcher asks for the website's progress straight away instead of at its next check.
 */
export const CATALOGUE_SYNC_STARTED_EVENT = 'catalogue-sync-started';

export function announceCatalogueSync(): void {
  window.dispatchEvent(new CustomEvent(CATALOGUE_SYNC_STARTED_EVENT));
}

/**
 * The running import's percentage for a progress bar, or null when the API can't tell yet (starting, a total not
 * known yet, an unknown phase): show an indeterminate bar and no number then.
 */
export function syncPercent(sync: CatalogueSyncProgress): number | null {
  return sync.percent === null ? null : Math.round(Math.min(100, Math.max(0, sync.percent)));
}

export type WebsiteCatalogueAction = 'connect' | 'continue' | 'manage' | 'upgrade' | 'billing';

export interface WebsiteCatalogueCard {
  /** Outside the pilot list (spec §13.3): no card at all, not even an upsell. */
  hidden: boolean;
  /** Counts toward the sidebar's Connectors badge: a website connected on the Business plan (a paused-by-plan one doesn't). */
  connected: boolean;
  /** What clicking the card does. */
  action: WebsiteCatalogueAction;
  /** ConnectorCard's plain connected line and disabled look (a Starter account with a website). */
  status?: string;
  disabled?: boolean;
  override?: ConnectorCardOverride;
}

function sourceOverride(source: CatalogueSource): ConnectorCardOverride {
  const base = statusOverride(source);
  // An import is running: its live progress replaces the line ("shop.com · Reading products 120 of 500"), under the status's badge.
  if (source.sync) return { ...base, line: `${source.host} · ${source.sync.label}`, progress: syncPercent(source.sync) };
  return base;
}

function statusOverride(source: CatalogueSource): ConnectorCardOverride {
  const manage = { actionLabel: 'Manage', outlined: true };
  switch (source.status) {
    case 'active': {
      if (source.warning) {
        return { badge: { label: 'Action needed', tone: 'amber' }, line: `${source.host} · verification code missing`, ...manage };
      }
      const synced = formatRelative(source.last_sync_at);
      const when = source.sync_requested ? 'sync starting' : synced ? `synced ${synced}` : 'first sync pending';
      return { badge: { label: 'Connected', tone: 'green' }, line: [source.host, plural(source.item_count, 'item'), when].join(' · '), ...manage };
    }
    case 'paused':
      return { badge: { label: 'Paused', tone: 'gray' }, line: `${source.host} · syncing paused`, ...manage };
    case 'needs_attention':
      return { badge: { label: 'Needs attention', tone: 'amber' }, line: `${source.host} · needs attention: our team has been notified`, ...manage };
    case 'unverified':
      return { badge: { label: 'Action needed', tone: 'amber' }, line: `${source.host} · ownership not confirmed`, ...manage };
    case 'blocked':
      return { badge: { label: 'Action needed', tone: 'amber' }, line: `${source.host} · blocked by bot protection`, ...manage };
    default: // plan_required on an account that is on the Business plan again
      return { badge: { label: 'Paused', tone: 'amber' }, line: `${source.host} · resumes with the next sync`, ...manage };
  }
}

/**
 * The Website Catalogue card for the account's status (spec §8.1):
 * - outside the pilot list, or no answer yet / the load failed: hidden;
 * - Starter: the existing Connectors gate (clicking opens the upgrade plans);
 * - Teams: "Available on the Business plan" with a link to Billing (or its paused website after a downgrade);
 * - Business: Connect, an analysis in progress or finished, or the connected website and its status.
 */
export function websiteCatalogueCard(overview: CatalogueOverview | null, isStarter: boolean): WebsiteCatalogueCard {
  // No answer (loading, or the load failed): no card, since an account outside the pilot must never see one (spec §8.1).
  if (!overview || overview.reason === 'not_available') return { hidden: true, connected: false, action: 'connect' };
  const { source, scan } = overview;

  if (isStarter) {
    // The API reports a non-Business account as plan_required and pauses its source, so it isn't counted as connected.
    return source
      ? { hidden: false, connected: false, action: 'upgrade', status: source.host, disabled: true }
      : { hidden: false, connected: false, action: 'upgrade' };
  }

  if (overview.reason === 'plan_required') {
    return source
      ? {
          hidden: false,
          connected: false, // paused by the plan: not counted in the Connectors badge
          action: 'billing',
          override: { badge: { label: 'Paused', tone: 'amber' }, line: `${source.host} · paused: not on the Business plan`, actionLabel: 'Upgrade to Business', outlined: false },
        }
      : { hidden: false, connected: false, action: 'billing', override: { line: 'Available on the Business plan.', actionLabel: 'See plans', outlined: false } };
  }

  if (source) return { hidden: false, connected: true, action: 'manage', override: sourceOverride(source) };

  if (scan?.in_progress) {
    return { hidden: false, connected: false, action: 'continue', override: { line: `Analysing ${scan.host}…`, actionLabel: 'View progress', outlined: true } };
  }
  if (scan && scan.status === 'ready') {
    return { hidden: false, connected: false, action: 'continue', override: { line: `${scan.host} is ready to connect.`, actionLabel: 'Continue', outlined: false } };
  }
  if (scan && scan.status !== 'expired') {
    return { hidden: false, connected: false, action: 'continue', override: { line: `We couldn't finish checking ${scan.host}.`, actionLabel: 'See details', outlined: true } };
  }
  return { hidden: false, connected: false, action: 'connect' };
}
