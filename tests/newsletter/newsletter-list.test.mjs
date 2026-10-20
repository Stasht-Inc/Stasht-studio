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
