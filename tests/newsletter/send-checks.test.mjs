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

// Chris, 29 Oct: the subject line and preview text live in step 1 ("Name and subject").
test('step order and DOM ids', () => {
  assert.deepEqual(STEP_ORDER, ['name', 'recipients', 'from', 'content', 'schedule']);
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
    name: 'Give your newsletter a name and a subject line.',
    content: 'Add at least one section to the email.',
  });
  assert.equal(firstProblemStep(p), 'name');
  assert.equal(firstProblemStep({}), null);
});

test('name and subject share step 1', () => {
  assert.equal(preSendProblems({ ...ready, name: '' }, counts, { mode: 'now' }).name, 'Give your newsletter a name.');
  assert.equal(preSendProblems({ ...ready, subject: '' }, counts, { mode: 'now' }).name, 'Add a subject line.');
  assert.equal(preSendProblems({ ...ready, subject: 'x'.repeat(151) }, counts, { mode: 'now' }).name, 'Use 150 characters or fewer.');
  assert.equal(preSendProblems({ ...ready, preview_text: 'x'.repeat(201) }, counts, { mode: 'now' }).name, 'Use 200 characters or fewer.');
  assert.equal(preSendProblems({ ...ready, name: 'x'.repeat(121), subject: '' }, counts, { mode: 'now' }).name, 'Use 120 characters or fewer.', 'the name problem first');
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
    content: 'Use https.', recipients: 'Not enough emails left.', name: 'Add a subject line.',
  });
  assert.deepEqual(stepErrorsFrom({ preview_text: 'Too long.' }), { name: 'Too long.' });
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
  assert.equal(allowanceProblem(allowance, { ...counts, sms: 900 }, ['email', 'sms']), 'This needs 900 text message parts, but your plan has 460 left this month.');
  assert.equal(formatResetDate('2026-11-01T00:00:00Z'), 'Nov 1');
  assert.equal(allowanceLine(allowance, ['email']), 'Your plan has 3,800 emails left this month. It resets on Nov 1.');
  assert.equal(allowanceLine(allowance, ['email', 'sms']), 'Your plan has 3,800 emails and 460 text message parts left this month. It resets on Nov 1.');
});

// GET /newsletter-allowance also says what is held back for newsletters sending or scheduled (email_pending,
// sms_pending): left = limit − used − pending, never below 0; a missing pending counts as 0.
test('allowance left takes off what is pending', () => {
  const withPending = { ...allowance, email_pending: 1000, sms_pending: 500 };
  assert.deepEqual(allowanceLeft(withPending), { email: 2800, sms: 0 });
  assert.deepEqual(allowanceLeft(allowance), { email: 3800, sms: 460 }, 'missing pending counts as 0');
  assert.equal(allowanceLine(withPending, ['email', 'sms']), 'Your plan has 2,800 emails and 0 text message parts left this month. It resets on Nov 1.');
  assert.equal(allowanceProblem(withPending, counts, ['email']), null);
  assert.equal(allowanceProblem(withPending, { ...counts, email: 3000 }, ['email']), 'This needs 3,000 emails, but your plan has 2,800 left this month.');
});

// [wdy2xh2p3f] Texts are counted in parts: a 2-part text to 300 people needs 600.
test('allowance counts text message parts', () => {
  assert.equal(allowanceProblem(allowance, { ...counts, sms: 300 }, ['sms'], 2), 'This needs 600 text message parts, but your plan has 460 left this month.');
  assert.equal(allowanceProblem(allowance, { ...counts, sms: 230 }, ['sms'], 2), null);
});

test('preSendProblems: a text over 3 parts and a text time in quiet hours', () => {
  const base = { ...emptyDraft(), name: 'Oct', subject: 'Hi', channels: ['email', 'sms'], blocks: [{ id: 'b1', type: 'title', data: { text: 'Hi', size: 'large' } }] };
  const now = new Date('2026-10-22T13:20:00Z');
  const long = preSendProblems({ ...base, sms_text: 'ą'.repeat(120), from_name: 'Serpa Chrysler' }, null, { mode: 'now' }, now);
  assert.match(long.recipients, /^This text is too long once sent \(\d parts\)\. Shorten it or remove emoji\.$/);
  const tz = process.env.TZ;
  process.env.TZ = 'America/Toronto';
  try {
    const night = preSendProblems({ ...base, sms_text: 'Hi' }, null, { mode: 'later', date: '2026-10-26', time: '22:00' }, now);
    assert.equal(night.schedule, 'Texts can only go out between 8am and 9pm. Pick a time in that window.');
  } finally {
    if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
  }
});
