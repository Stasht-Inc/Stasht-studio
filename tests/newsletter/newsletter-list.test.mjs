process.env.TZ = 'America/Toronto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_META, RECIPIENT_STATUS_META, ACTION_LABEL, actionsFor, primaryAction, canCancel, whenText, rate, rateBase, countLabel, plural,
  CHANNEL_FILTERS, RESULT_STATUS_FILTERS, countsFor,
} from '../../components/newsletters/lib/newsletterList.ts';

test('status chips and actions per status', () => {
  assert.deepEqual(Object.values(STATUS_META).map((m) => m.label), ['Draft', 'Scheduled', 'Sending', 'Sent', 'Failed', 'Cancelled']);
  assert.equal(RECIPIENT_STATUS_META.queued.label, 'Waiting');
  assert.deepEqual(actionsFor('draft'), ['edit', 'duplicate', 'delete']);
  assert.deepEqual(actionsFor('scheduled'), ['results', 'duplicate', 'cancel']);
  assert.deepEqual(actionsFor('sending'), ['results', 'duplicate', 'cancel']);
  assert.deepEqual(actionsFor('sent'), ['results', 'duplicate']);
  assert.deepEqual(actionsFor('failed'), ['results', 'duplicate']);
  assert.deepEqual(actionsFor('cancelled'), ['results', 'duplicate', 'delete']);
  assert.equal(ACTION_LABEL.cancel, 'Cancel sending');
  assert.equal(primaryAction('draft'), 'edit');
  assert.equal(primaryAction('sent'), 'results');
  assert.equal(canCancel('sending'), true);
  assert.equal(canCancel('sent'), false);
});

test('count labels follow the channel', () => {
  assert.equal(countLabel('opened', 'all'), 'Opened*');
  assert.equal(countLabel('opened', 'email'), 'Opened*');
  assert.equal(countLabel('opened', 'sms'), 'Link opened');
  assert.equal(countLabel('unsubscribed', 'sms'), 'Replied STOP');
  assert.equal(countLabel('unsubscribed', 'email'), 'Unsubscribed');
  assert.equal(countLabel('delivered', 'all'), 'Delivered');
});

test('whenText', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  assert.equal(whenText({ status: 'draft', scheduled_at: null, sent_at: null, updated_at: '2026-10-15T14:00:00Z' }, now), 'Edited Thu, Oct 15, 10:00 AM');
  assert.equal(whenText({ status: 'scheduled', scheduled_at: '2026-10-22T13:30:00Z', sent_at: null, updated_at: '' }, now), 'Sends Thu, Oct 22, 9:30 AM');
  assert.equal(whenText({ status: 'scheduled', scheduled_at: '2026-10-20T12:00:30Z', sent_at: null, updated_at: '' }, now), 'Sending in a minute');
  assert.equal(whenText({ status: 'sending', scheduled_at: null, sent_at: null, updated_at: '' }, now), 'Sending now');
  assert.equal(whenText({ status: 'sent', scheduled_at: null, sent_at: '2026-10-01T14:00:00Z', updated_at: '' }, now), 'Sent Thu, Oct 1, 10:00 AM');
  assert.equal(whenText({ status: 'failed', scheduled_at: null, sent_at: null, updated_at: '' }, now), 'Could not be sent');
  assert.equal(whenText({ status: 'cancelled', scheduled_at: null, sent_at: null, updated_at: '' }, now), 'Cancelled');
});

test('rate, its base (SendGrid never reports delivered) and plural', () => {
  assert.equal(rate(512, 1180), '43%');
  assert.equal(rate(1, 0), '—');
  assert.deepEqual(rateBase({ delivered: 1180, sent: 1198 }), { base: 1180, label: 'of delivered' });
  assert.deepEqual(rateBase({ delivered: 0, sent: 300 }), { base: 300, label: 'of sent' });
  assert.equal(plural(1, 'newsletter', 'newsletters'), '1 newsletter');
  assert.equal(plural(1204, 'newsletter', 'newsletters'), '1,204 newsletters');
});

test('results filters: channel options and every status the API takes (contract note 3)', () => {
  assert.deepEqual(CHANNEL_FILTERS.map((o) => o.label), ['All', 'Email', 'Text']);
  assert.deepEqual(RESULT_STATUS_FILTERS.map((o) => o.value), ['', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'unsubscribed', 'failed', 'skipped']);
  assert.equal(RESULT_STATUS_FILTERS.find((o) => o.value === 'unsubscribed').label, 'Unsubscribed or STOP');
});

test('countsFor picks totals or one channel', () => {
  const zero = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
  const counts = { ...zero, recipients: 3, email: { ...zero, recipients: 2 }, sms: { ...zero, recipients: 1 } };
  assert.equal(countsFor(counts, 'all').recipients, 3);
  assert.equal(countsFor(counts, 'email').recipients, 2);
  assert.equal(countsFor(counts, 'sms').recipients, 1);
  assert.equal('email' in countsFor(counts, 'all'), false, 'totals only');
});

// Review fixes (Tasks 13–14).
import { listRateBase, resultsRateBase, deliveredTile, isLive, needsStatusCheck } from '../../components/newsletters/lib/newsletterList.ts';

const Z = { recipients: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, unsubscribed: 0, failed: 0, skipped: 0 };
// 1,000 emails through the SendGrid fallback (no delivered) and 100 Twilio texts (all delivered).
const MIXED = {
  ...Z, recipients: 1100, sent: 1100, delivered: 100, opened: 420, clicked: 60,
  email: { ...Z, recipients: 1000, sent: 1000, delivered: 0, opened: 400, clicked: 50 },
  sms: { ...Z, recipients: 100, sent: 100, delivered: 100, opened: 20, clicked: 10 },
};

test('rates never go over 100%', () => {
  assert.equal(rate(420, 100), '100%');
  assert.equal(rate(50, 100), '50%');
});

test('drawer rate base is worked out per channel, so mixed channels never pass 100%', () => {
  assert.deepEqual(resultsRateBase(MIXED, 'all'), { base: 1100, label: 'of delivered or sent' });
  assert.equal(rate(MIXED.opened, resultsRateBase(MIXED, 'all').base), '38%');
  assert.deepEqual(resultsRateBase(MIXED, 'email'), { base: 1000, label: 'of sent' });
  assert.deepEqual(resultsRateBase(MIXED, 'sms'), { base: 100, label: 'of delivered' });
  const both = { ...Z, sent: 1300, delivered: 1280, email: { ...Z, sent: 1000, delivered: 990 }, sms: { ...Z, sent: 300, delivered: 290 } };
  assert.deepEqual(resultsRateBase(both, 'all'), { base: 1280, label: 'of delivered' });
  const sendgridOnly = { ...Z, sent: 300, email: { ...Z, sent: 300 }, sms: { ...Z } };
  assert.deepEqual(resultsRateBase(sendgridOnly, 'all'), { base: 300, label: 'of sent' });
});

test('list rate base: totals only, so out of sent unless everything sent was delivered', () => {
  assert.equal(listRateBase({ sent: 1100, delivered: 100 }), 1100);
  assert.equal(rate(420, listRateBase({ sent: 1100, delivered: 100 })), '38%');
  assert.equal(listRateBase({ sent: 300, delivered: 300 }), 300);
  assert.equal(listRateBase({ sent: 1198, delivered: 1180 }), 1198);
});

test('delivered tile wording follows the channel and the status', () => {
  assert.deepEqual(deliveredTile({ sent: 300, delivered: 0 }, 'email', 'sent'), { dash: true, note: 'Not every email service reports this' });
  assert.deepEqual(deliveredTile({ sent: 300, delivered: 0 }, 'all', 'sent'), { dash: true, note: 'Not every email service reports this' });
  assert.deepEqual(deliveredTile({ sent: 100, delivered: 0 }, 'sms', 'sent'), { dash: false, note: null });
  assert.deepEqual(deliveredTile({ sent: 100, delivered: 40 }, 'sms', 'sending'), { dash: false, note: 'Waiting for the phone company to confirm' });
  assert.deepEqual(deliveredTile({ sent: 300, delivered: 0 }, 'email', 'sending'), { dash: false, note: null });
  assert.deepEqual(deliveredTile({ sent: 300, delivered: 280 }, 'email', 'sent'), { dash: false, note: null });
});

test('polling: sending, or scheduled within about 10 minutes', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  assert.equal(isLive({ status: 'sending', scheduled_at: null }, now), true);
  assert.equal(isLive({ status: 'scheduled', scheduled_at: '2026-10-20T12:09:00Z' }, now), true);
  assert.equal(isLive({ status: 'scheduled', scheduled_at: '2026-10-20T11:50:00Z' }, now), true, 'overdue: about to go');
  assert.equal(isLive({ status: 'scheduled', scheduled_at: '2026-10-21T12:00:00Z' }, now), false);
  assert.equal(isLive({ status: 'sent', scheduled_at: null }, now), false);
  assert.equal(isLive({ status: 'draft', scheduled_at: null }, now), false);
});

test('the drawer re-reads the newsletter only when its status may have changed', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  assert.equal(needsStatusCheck({ status: 'scheduled', scheduled_at: '2026-10-20T11:59:00Z' }, { ...Z }, now), true, 'scheduled time passed');
  assert.equal(needsStatusCheck({ status: 'scheduled', scheduled_at: '2026-10-20T12:05:00Z' }, { ...Z }, now), false);
  assert.equal(needsStatusCheck({ status: 'sending', scheduled_at: null }, { ...Z, recipients: 10, sent: 6, failed: 2, skipped: 2 }, now), true, 'nobody left waiting');
  assert.equal(needsStatusCheck({ status: 'sending', scheduled_at: null }, { ...Z, recipients: 10, sent: 6 }, now), false);
  assert.equal(needsStatusCheck({ status: 'sending', scheduled_at: null }, { ...Z }, now), false, 'recipient rows not built yet');
});
