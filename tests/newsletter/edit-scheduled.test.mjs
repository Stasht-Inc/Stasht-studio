// [wdy2xh2p3m] Keep the picked time on a draft (planned_send_at), and the allowance month a scheduled send uses.
process.env.TZ = 'America/Toronto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftFromNewsletter, draftToInput, emptyDraft, changedFields } from '../../components/newsletters/lib/draft.ts';
import { plannedFromSchedule, scheduleFromPlanned, sameInstant } from '../../components/newsletters/lib/schedule.ts';
import { usesNextMonthAllowance, nextMonthLine } from '../../components/newsletters/lib/sendChecks.ts';

test('a draft carries planned_send_at to and from the API', () => {
  assert.equal(emptyDraft().planned_send_at, null);
  const n = { id: 1, name: 'x', subject: null, preview_text: null, from_name: null, reply_to_email: null, channels: ['email'], sms_text: null, template: 'basic', header: {}, blocks: [], audience: [], planned_send_at: '2026-10-27T14:00:00Z' };
  assert.equal(draftFromNewsletter(n).planned_send_at, '2026-10-27T14:00:00Z');
  assert.equal(draftFromNewsletter({ ...n, planned_send_at: undefined }).planned_send_at, null, 'older API: none');
  assert.equal(draftToInput({ ...emptyDraft(), planned_send_at: '2026-10-27T14:00:00.000Z' }).planned_send_at, '2026-10-27T14:00:00.000Z');
  assert.equal(draftToInput(emptyDraft()).planned_send_at, null);
  assert.deepEqual(changedFields({ ...emptyDraft() }, { ...emptyDraft(), planned_send_at: '2026-10-27T14:00:00.000Z' }), { planned_send_at: '2026-10-27T14:00:00.000Z' });
});

test('the chosen time goes to planned_send_at and comes back as Schedule for later', () => {
  assert.equal(plannedFromSchedule({ mode: 'now' }), null);
  assert.equal(plannedFromSchedule({ mode: 'later', date: '2026-10-27', time: '' }), null, 'unfinished: nothing kept yet');
  assert.equal(plannedFromSchedule({ mode: 'later', date: '2026-10-27', time: '10:00' }), '2026-10-27T14:00:00.000Z');
  assert.deepEqual(scheduleFromPlanned('2026-10-27T14:00:00Z'), { mode: 'later', date: '2026-10-27', time: '10:00' });
  assert.deepEqual(scheduleFromPlanned(null), { mode: 'now' });
  assert.deepEqual(scheduleFromPlanned('nonsense'), { mode: 'now' });
  assert.equal(sameInstant('2026-10-27T14:00:00Z', '2026-10-27T14:00:00.000Z'), true);
  assert.equal(sameInstant(null, null), true);
  assert.equal(sameInstant(null, '2026-10-27T14:00:00Z'), false);
});

test('a send after the monthly reset is checked against next month by the API', () => {
  const allowance = { plan: 'Teams', email_limit: 5000, sms_limit: 0, email_used: 4900, sms_used: 0, resets_at: '2026-11-01T04:00:00Z' };
  assert.equal(usesNextMonthAllowance(allowance, '2026-11-02T14:00:00Z'), true);
  assert.equal(usesNextMonthAllowance(allowance, '2026-11-01T04:00:00Z'), true, 'the reset moment itself is next month');
  assert.equal(usesNextMonthAllowance(allowance, '2026-10-30T14:00:00Z'), false);
  assert.equal(usesNextMonthAllowance(allowance, null), false, 'send now: this month');
  assert.equal(usesNextMonthAllowance(null, '2026-11-02T14:00:00Z'), false);
  assert.equal(nextMonthLine(allowance, 'en-US'), 'It goes out after your plan resets on Nov 1, so it uses next month’s allowance.');
});
