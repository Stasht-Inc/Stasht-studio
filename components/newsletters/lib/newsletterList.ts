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

export type NewsletterAction = 'edit' | 'results' | 'duplicate' | 'cancel' | 'delete';

export const ACTION_LABEL: Record<NewsletterAction, string> = {
  edit: 'Edit draft', results: 'View results', duplicate: 'Duplicate', cancel: 'Cancel sending', delete: 'Delete',
};

// §8: only drafts can be edited; drafts and cancelled can be deleted; scheduled and sending can be cancelled
// (NewsletterSendController::cancel stops a sending one before its next batch).
const ACTIONS: Record<NewsletterStatus, NewsletterAction[]> = {
  draft: ['edit', 'duplicate', 'delete'],
  scheduled: ['results', 'duplicate', 'cancel'],
  sending: ['results', 'duplicate', 'cancel'],
  sent: ['results', 'duplicate'],
  failed: ['results', 'duplicate'],
  cancelled: ['results', 'duplicate', 'delete'],
};

export function actionsFor(status: NewsletterStatus): NewsletterAction[] {
  return ACTIONS[status] ?? ['results', 'duplicate'];
}

export function primaryAction(status: NewsletterStatus): 'edit' | 'results' {
  return status === 'draft' ? 'edit' : 'results';
}

export function canCancel(status: NewsletterStatus): boolean {
  return status === 'scheduled' || status === 'sending';
}

export function whenText(n: Pick<NewsletterSummary, 'status' | 'scheduled_at' | 'sent_at' | 'updated_at'>, now: Date = new Date()): string {
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
      return 'Could not be sent';
    default:
      return 'Cancelled';
  }
}

export function rate(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';
}

/**
 * Open and click rates are out of delivered when the service reports it, otherwise out of sent: email sent
 * through the SendGrid fallback never reports "delivered" (contract note 10).
 */
export function rateBase(c: Pick<NewsletterCounts, 'delivered' | 'sent'>): { base: number; label: 'of delivered' | 'of sent' } {
  return c.delivered > 0 ? { base: c.delivered, label: 'of delivered' } : { base: c.sent, label: 'of sent' };
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
