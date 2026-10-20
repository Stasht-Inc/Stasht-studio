import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP_ORDER, stepDomId, stepErrorsFrom, preSendProblems, firstProblemStep, allowanceLeft, allowanceProblem, allowanceLine, formatResetDate,
} from '../../components/newsletters/lib/sendChecks.ts';
import { emptyDraft } from '../../components/newsletters/lib/draft.ts';

const counts = { email: 1180, sms: 310, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 } };
const ready = {
  ...emptyDraft(), name: 'October', from_name: 'Serpa Chrysler', reply_to_email: 'sales@serpachrysler.ca', subject: 'October deals',
  blocks: [{ id: 'b1', type: 'title', data: { text: 'This month', size: 'large' } }],
};
const allowance = { plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 1200, sms_used: 40, resets_at: '2026-11-01T00:00:00Z' };

test('step order and DOM ids', () => {
  assert.deepEqual(STEP_ORDER, ['name', 'recipients', 'from', 'subject', 'content', 'schedule']);
  assert.equal(stepDomId('from'), 'nl-step-from');
});

test('a finished newsletter has no problems', () => {
  assert.deepEqual(preSendProblems(ready, counts, { mode: 'now' }), {});
});

// Alignment decision 5: from name and reply-to are pre-filled and never block sending (the API fills them in);
// only a reply-to that isn't an email address does.
test('an empty draft points at each unfinished step', () => {
  const p = preSendProblems(emptyDraft(), counts, { mode: 'now' });
  assert.deepEqual(p, {
    name: 'Give your newsletter a name.',
    subject: 'Add a subject line.',
    content: 'Add at least one section to the email.',
  });
  assert.equal(firstProblemStep(p), 'name');
  assert.equal(firstProblemStep({}), null);
});

test('recipients, SMS, reply-to, sections and schedule', () => {
  assert.equal(preSendProblems({ ...ready, audience: [] }, counts, { mode: 'now' }).recipients, 'Choose who gets this newsletter.');
  assert.equal(preSendProblems({ ...ready, channels: [] }, counts, { mode: 'now' }).recipients, 'Choose email, text or both.');
  assert.equal(preSendProblems({ ...ready, channels: ['email', 'sms'] }, counts, { mode: 'now' }).recipients, 'Write the text message.');
  assert.equal(preSendProblems(ready, { ...counts, email: 0 }, { mode: 'now' }).recipients, 'Nobody on these lists can get this newsletter yet.');
  assert.equal(preSendProblems({ ...ready, reply_to_email: '', from_name: '' }, counts, { mode: 'now' }).from, undefined, 'empty from details do not block');
  assert.equal(preSendProblems({ ...ready, reply_to_email: 'sales@' }, counts, { mode: 'now' }).from, 'Enter an email address like sales@yourbusiness.com.');
  assert.equal(preSendProblems({ ...ready, channels: ['sms'], sms_text: 'Hi', from_name: '', reply_to_email: '' }, counts, { mode: 'now' }).from, undefined, 'SMS-only needs no from details');
  assert.equal(preSendProblems({ ...ready, blocks: [{ id: 'x', type: 'title', data: { text: '', size: 'large' } }] }, counts, { mode: 'now' }).content, 'Finish or remove the sections marked in red.');
  assert.equal(preSendProblems(ready, counts, { mode: 'later', date: '', time: '' }).schedule, 'Pick a date and a time.');
});

test('stepErrorsFrom maps API 422 keys to steps', () => {
  assert.deepEqual(stepErrorsFrom({ 'blocks.2.data.url': 'Use https.', blocks: 'Use https.', allowance: 'Not enough emails left.', business_address: 'Add your address.', subject: 'Add a subject line.' }), {
    content: 'Use https.', recipients: 'Not enough emails left.', subject: 'Add a subject line.',
  });
  assert.deepEqual(stepErrorsFrom({ audience: 'Nobody here.', sms_text: 'Too long.' }), { recipients: 'Nobody here.' });
  assert.deepEqual(stepErrorsFrom({ scheduled_at: 'Must be in the future.' }), { schedule: 'Must be in the future.' });
  // The API's 422 when the account has no email and the reply-to is empty.
  assert.deepEqual(stepErrorsFrom({ reply_to_email: 'Add a reply-to email so people can answer you.' }), { from: 'Add a reply-to email so people can answer you.' });
  assert.deepEqual(stepErrorsFrom({ 'audience.0.id': 'That list was not found.', audience: 'That list was not found.' }), { recipients: 'That list was not found.' });
});

test('allowance', () => {
  assert.deepEqual(allowanceLeft(allowance), { email: 3800, sms: 460 });
  assert.equal(allowanceProblem(allowance, counts, ['email']), null);
  assert.equal(allowanceProblem(allowance, { ...counts, email: 4000 }, ['email']), 'This needs 4,000 emails, but your plan has 3,800 left this month.');
  assert.equal(allowanceProblem(allowance, { ...counts, sms: 900 }, ['email', 'sms']), 'This needs 900 texts, but your plan has 460 left this month.');
  assert.equal(formatResetDate('2026-11-01T00:00:00Z'), 'Nov 1');
  assert.equal(allowanceLine(allowance, ['email']), 'Your plan has 3,800 emails left this month. It resets on Nov 1.');
  assert.equal(allowanceLine(allowance, ['email', 'sms']), 'Your plan has 3,800 emails and 460 texts left this month. It resets on Nov 1.');
});
