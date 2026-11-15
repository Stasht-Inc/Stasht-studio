// The Newsletters list and the Results drawer: status chips, what each status allows, the "when" line, rates and
// their base, count labels per channel, and the results filters. Pure, so `node --test` loads it directly.
import type {
  NewsletterChannel, NewsletterCounts, NewsletterResultCounts, NewsletterStatus, NewsletterSummary, RecipientStatus, ResultsStatusFilter,
} from '../../../services/newslettersAPI.ts';
import { formatSendTime } from './schedule.ts';
import { formatCount } from './audience.ts';

export const STATUS_META: Record<NewsletterStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' },
  sending: { label: 'Sending', className: 'bg-amber-50 text-amber-800' },
  sent: { label: 'Sent', className: 'bg-green-50 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-500' },
};

export const RECIPIENT_STATUS_META: Record<RecipientStatus, { label: string; className: string }> = {
  queued: { label: 'Waiting', className: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Sent', className: 'bg-blue-50 text-blue-700' },
  delivered: { label: 'Delivered', className: 'bg-green-50 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },
  skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-500' },
};

// editScheduled: move a scheduled newsletter back to a draft (POST /newsletters/{id}/unschedule), then edit it.
export type NewsletterAction = 'edit' | 'editScheduled' | 'results' | 'duplicate' | 'cancel' | 'delete';

export const ACTION_LABEL: Record<NewsletterAction, string> = {
  edit: 'Edit', editScheduled: 'Edit', results: 'View results', duplicate: 'Duplicate', cancel: 'Cancel sending', delete: 'Delete',
};

// §8: only drafts can be edited; scheduled and sending can be cancelled (NewsletterSendController::cancel stops a
// sending one before its next batch). Everything but a sending one can be deleted (Chris, 10 Nov: tests): a scheduled
// one is cancelled and deleted together; a sending one only once it has finished (the API refuses it meanwhile).
const ACTIONS: Record<NewsletterStatus, NewsletterAction[]> = {
  draft: ['edit', 'duplicate', 'delete'],
  scheduled: ['editScheduled', 'results', 'duplicate', 'cancel', 'delete'],
  sending: ['results', 'duplicate', 'cancel'],
  sent: ['results', 'duplicate', 'delete'],
  failed: ['results', 'duplicate', 'delete'],
  cancelled: ['results', 'duplicate', 'delete'],
};

/** The delete confirm's line: drafts have no results; a scheduled one won't go out. */
export function deleteConfirmText(status: NewsletterStatus | undefined): string {
  if (status === 'draft') return "This can't be undone.";
  if (status === 'scheduled') return "It won't be sent. This can't be undone.";
  return "Its results will be deleted too. This can't be undone.";
}

export function actionsFor(status: NewsletterStatus): NewsletterAction[] {
  return ACTIONS[status] ?? ['results', 'duplicate'];
}

export function primaryAction(status: NewsletterStatus): 'edit' | 'results' {
  return status === 'draft' ? 'edit' : 'results';
}

export function canCancel(status: NewsletterStatus): boolean {
  return status === 'scheduled' || status === 'sending';
}

/** Why a newsletter failed (failure_reason, follow-up wdy2xh2p3h), in plain words. */
export function failureText(reason: NewsletterSummary['failure_reason']): string {
  return reason === 'too_late'
    ? "It was more than 6 hours late, so it wasn't sent. Duplicate it to send it now."
    : 'Something went wrong before it started sending.';
}

export function whenText(n: Pick<NewsletterSummary, 'status' | 'scheduled_at' | 'sent_at' | 'updated_at'> & Partial<Pick<NewsletterSummary, 'failure_reason'>>, now: Date = new Date()): string {
  switch (n.status) {
    case 'draft':
      return `Edited ${formatSendTime(n.updated_at)}`;
    case 'scheduled': {
      const at = n.scheduled_at ? new Date(n.scheduled_at).getTime() : NaN;
      if (Number.isFinite(at) && at <= now.getTime() + 60000) return 'Sending in a minute';
      return `Sends ${formatSendTime(n.scheduled_at)}`;
    }
    case 'sending':
      return 'Sending now';
    case 'sent':
      return `Sent ${formatSendTime(n.sent_at ?? n.updated_at)}`;
    case 'failed':
      return n.failure_reason === 'too_late' ? 'Too late to send' : 'Could not be sent';
    default:
      return 'Cancelled';
  }
}

export function rate(part: number, whole: number): string {
  // Capped: a rate over 100% only ever means a mismatched base.
  return whole > 0 ? `${Math.min(100, Math.round((part / whole) * 100))}%` : '—';
}

export type RateLabel = 'of delivered' | 'of sent' | 'of delivered or sent';

/**
 * One channel's base: out of delivered when the service reports it, otherwise out of sent. Email sent through the
 * SendGrid fallback never reports "delivered" (contract note 10).
 */
export function rateBase(c: Pick<NewsletterCounts, 'delivered' | 'sent'>): { base: number; label: 'of delivered' | 'of sent' } {
  return c.delivered > 0 ? { base: c.delivered, label: 'of delivered' } : { base: c.sent, label: 'of sent' };
}

/**
 * The Results drawer: totals mix channels (SendGrid email with no delivered, texts with it), so the base for All is
 * each channel's own base added up.
 */
export function resultsRateBase(counts: NewsletterResultCounts, channel: ChannelFilter): { base: number; label: RateLabel } {
  if (channel !== 'all') return rateBase(counts[channel]);
  const parts = [counts.email, counts.sms].filter((c) => c && c.sent > 0).map(rateBase);
  if (!parts.length) return rateBase(counts);
  const labels = new Set(parts.map((p) => p.label));
  return { base: parts.reduce((sum, p) => sum + p.base, 0), label: labels.size === 1 ? parts[0].label : 'of delivered or sent' };
}

/** The list has totals only: out of sent, unless everything sent was delivered (then the two are the same). */
export function listRateBase(c: Pick<NewsletterCounts, 'delivered' | 'sent'>): number {
  return c.delivered === c.sent ? c.delivered : c.sent;
}

/**
 * The Delivered tile. Email services may never report delivery (a dash, and say so); texts are confirmed by the
 * phone company a little later, so while sending that is what a gap means.
 */
export function deliveredTile(c: Pick<NewsletterCounts, 'delivered' | 'sent'>, channel: ChannelFilter, status: NewsletterStatus): { dash: boolean; note: string | null } {
  if (status === 'sending') {
    return { dash: false, note: channel === 'sms' && c.delivered < c.sent ? 'Waiting for the phone company to confirm' : null };
  }
  if (channel !== 'sms' && c.delivered === 0 && c.sent > 0) return { dash: true, note: 'Not every email service reports this' };
  return { dash: false, note: null };
}

const LIVE_WINDOW_MS = 10 * 60 * 1000;

/** Worth checking again soon: sending, or scheduled to go within about 10 minutes (or overdue). */
export function isLive(n: Pick<NewsletterSummary, 'status' | 'scheduled_at'>, now: Date = new Date()): boolean {
  if (n.status === 'sending') return true;
  if (n.status !== 'scheduled' || !n.scheduled_at) return false;
  const at = new Date(n.scheduled_at).getTime();
  return Number.isFinite(at) && at <= now.getTime() + LIVE_WINDOW_MS;
}

/** The drawer's poll fetches results only; it re-reads the newsletter when its status may have moved on. */
export function needsStatusCheck(n: Pick<NewsletterSummary, 'status' | 'scheduled_at'>, c: NewsletterCounts, now: Date = new Date()): boolean {
  if (n.status === 'scheduled') {
    const at = n.scheduled_at ? new Date(n.scheduled_at).getTime() : NaN;
    return Number.isFinite(at) && at <= now.getTime();
  }
  if (n.status === 'sending') return c.recipients > 0 && c.sent + c.failed + c.skipped >= c.recipients;
  return false;
}

export type ChannelFilter = 'all' | NewsletterChannel;

export const CHANNEL_FILTERS: ReadonlyArray<{ value: ChannelFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'Text' },
];

// The results filter also takes opened / clicked / unsubscribed (contract note 3).
export const RESULT_STATUS_FILTERS: ReadonlyArray<{ value: ResultsStatusFilter | ''; label: string }> = [
  { value: '', label: 'Everyone' }, { value: 'queued', label: 'Waiting' }, { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' }, { value: 'opened', label: 'Opened' }, { value: 'clicked', label: 'Clicked' },
  { value: 'unsubscribed', label: 'Unsubscribed or STOP' }, { value: 'failed', label: 'Failed' }, { value: 'skipped', label: 'Skipped' },
];

const COUNT_KEYS: Array<keyof NewsletterCounts> = ['recipients', 'sent', 'delivered', 'opened', 'clicked', 'unsubscribed', 'failed', 'skipped'];

/** The totals, or the email or text numbers, to match the Channel filter (contract note 2). */
export function countsFor(counts: NewsletterResultCounts, channel: ChannelFilter): NewsletterCounts {
  if (channel !== 'all') return counts[channel];
  const out = {} as NewsletterCounts;
  for (const key of COUNT_KEYS) out[key] = counts[key];
  return out;
}

const COUNT_LABELS: Record<keyof NewsletterCounts, string> = {
  recipients: 'Recipients', sent: 'Sent', delivered: 'Delivered', opened: 'Opened*', clicked: 'Clicked',
  unsubscribed: 'Unsubscribed', failed: 'Failed', skipped: 'Skipped',
};

/** Texts have no "open": the count is people who opened the link; unsubscribing is replying STOP (spec §2). */
export function countLabel(key: keyof NewsletterCounts, channel: ChannelFilter): string {
  if (channel === 'sms' && key === 'opened') return 'Link opened';
  if (channel === 'sms' && key === 'unsubscribed') return 'Replied STOP';
  return COUNT_LABELS[key];
}

export function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/**
 * Batch 3 (Chris, 1 Nov): the list's layout follows its own width, not the window's. At a 1280 px window App's two
 * sidebars leave the Campaigns page about 650 px, where the window-sized columns overlapped ("NewsStatus") and pushed
 * Edit and ⋯ past the right edge. 'wide': a When column and Edit with its word; 'table': When under the Status chip,
 * Edit as an icon; 'cards': the phone card rows. Each table layout's minimum column widths fit the narrowest width
 * it is used at (`from`), with the name column at least minColumns[0] (tests/newsletter/newsletters-table.test.mjs).
 */
export type NewslettersLayout = 'cards' | 'table' | 'wide';

export const NEWSLETTERS_TABLE = {
  // From 600: App's main column is 648 px at a 1280 px window with both sidebars open (a little less with a
  // scrollbar that takes room).
  table: {
    from: 600, paddingX: 16, gap: 8,
    minColumns: [140, 112, 76, 60, 60, 72],
    grid: 'grid grid-cols-[minmax(140px,1fr)_minmax(112px,150px)_76px_60px_60px_72px] items-center gap-2',
    padding: 'px-4',
  },
  wide: {
    from: 992, paddingX: 24, gap: 12,
    minColumns: [240, 96, 200, 88, 72, 72, 104],
    grid: 'grid grid-cols-[minmax(240px,1fr)_96px_200px_88px_72px_72px_104px] items-center gap-3',
    padding: 'px-6',
  },
} as const;

/** Not measured yet (0): 'wide', today's desktop look, until the first measure (before the first paint). */
export function newslettersLayout(width: number): NewslettersLayout {
  if (width <= 0 || width >= NEWSLETTERS_TABLE.wide.from) return 'wide';
  return width >= NEWSLETTERS_TABLE.table.from ? 'table' : 'cards';
}

/** The row's own controls (the name, Edit, ⋯) and the ⋯ menu's items act for themselves. */
const ROW_CONTROLS = 'button, a, input, select, textarea, label, [role="menuitem"]';

/**
 * A click anywhere else on a row opens it (Chris, 1 Nov: "it isn't obvious"). Not a click on one of its controls,
 * not one from the ⋯ menu (portalled outside the row, yet React bubbles its clicks to the row), not a text selection.
 */
export function opensRow(click: { target: { closest(selector: string): unknown } | null; contains(target: unknown): boolean; selection: string }): boolean {
  if (!click.target || !click.contains(click.target)) return false;
  if (click.selection.trim()) return false;
  return !click.target.closest(ROW_CONTROLS);
}
