// Chris, 29 Oct (round 2), item 6 (Deepak's decision): when the emails can go, send them and skip the texts the
// plan has no parts left for, with a note at the button. Only texts, and none can go: still refused, with why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendAllowance, sendBlockedReason } from '../../components/newsletters/lib/sendChecks.ts';

const counts = (email, sms, extra = {}) => ({ email, sms, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 }, ...extra });
const allowance = (smsLeft, emailLeft = 3800) => ({ plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 5000 - emailLeft, sms_used: 500 - smsLeft, resets_at: '2026-11-01T00:00:00Z' });

test('enough of both: nothing to say', () => {
  assert.deepEqual(sendAllowance(allowance(460), counts(1180, 310), ['email', 'sms']), { problem: null, skippedTexts: 0, note: null });
});

test('no text parts left, emails going: allowed, with the note', () => {
  const r = sendAllowance(allowance(0), counts(1180, 310), ['email', 'sms']);
  assert.equal(r.problem, null);
  assert.equal(r.skippedTexts, 310);
  assert.equal(r.note, "310 text messages won't be sent: no text parts left this month. Emails will still go out.");
  assert.equal(sendAllowance(allowance(0), counts(5, 1), ['email', 'sms']).note, "1 text message won't be sent: no text parts left this month. Emails will still go out.");
});

test('some text parts left: the texts beyond them are skipped (long texts count their parts)', () => {
  const r = sendAllowance(allowance(100), counts(1180, 310), ['email', 'sms']);
  assert.equal(r.skippedTexts, 210);
  assert.equal(r.note, "210 text messages won't be sent: not enough text parts left this month. Emails will still go out.");
  // 2 parts each: 100 parts is 50 texts, so 260 are skipped.
  assert.equal(sendAllowance(allowance(100), counts(1180, 310), ['email', 'sms'], 2).skippedTexts, 260);
  // 1 part left and 2 parts each: none can go.
  assert.match(sendAllowance(allowance(1), counts(1180, 310), ['email', 'sms'], 2).note, /^310 text messages won't be sent: no text parts left/);
});

test('only texts and they can’t all go: refused with the numbers (as before)', () => {
  const r = sendAllowance(allowance(0), counts(0, 310), ['sms']);
  assert.equal(r.problem, 'This needs 310 text message parts, but your plan has 0 left this month.');
  assert.equal(r.note, null);
  // Email chosen but nobody on the lists has one: the same.
  assert.equal(sendAllowance(allowance(0), counts(0, 310), ['email', 'sms']).problem, 'This needs 310 text message parts, but your plan has 0 left this month.');
});

test('too few emails left: refused, whatever the texts', () => {
  assert.equal(sendAllowance(allowance(0, 100), counts(1180, 310), ['email', 'sms']).problem, 'This needs 1,180 emails, but your plan has 100 left this month.');
});

test('a newer API that says how many texts it will skip (sms_will_skip) is believed', () => {
  const r = sendAllowance(allowance(460), counts(1180, 310, { sms_will_skip: 12 }), ['email', 'sms']);
  assert.equal(r.skippedTexts, 12);
  assert.match(r.note, /^12 text messages won't be sent/);
  assert.equal(sendAllowance(allowance(0), counts(1180, 310, { sms_will_skip: 0 }), ['email', 'sms']).note, null);
});

test('nothing known yet, or texts not chosen: nothing to say', () => {
  assert.deepEqual(sendAllowance(null, counts(1, 1), ['email', 'sms']), { problem: null, skippedTexts: 0, note: null });
  assert.deepEqual(sendAllowance(allowance(0), null, ['email', 'sms']), { problem: null, skippedTexts: 0, note: null });
  assert.deepEqual(sendAllowance(allowance(0), counts(10, 10), ['email']), { problem: null, skippedTexts: 0, note: null });
});

test('sendBlockedReason: whenever Send is off, the reason to show at the button', () => {
  assert.equal(sendBlockedReason({ busy: false, countsLoading: true, problem: null, saved: true }), 'Counting who gets it…');
  assert.equal(sendBlockedReason({ busy: false, countsLoading: false, problem: 'This needs 310 text message parts, but your plan has 0 left this month.', saved: true }), 'This needs 310 text message parts, but your plan has 0 left this month.');
  assert.equal(sendBlockedReason({ busy: false, countsLoading: false, problem: null, saved: false }), 'Save the newsletter first, then try again.');
  assert.equal(sendBlockedReason({ busy: true, countsLoading: true, problem: 'x', saved: true }), null, 'busy shows its spinner');
  assert.equal(sendBlockedReason({ busy: false, countsLoading: false, problem: null, saved: true }), null);
});

// The API words the allowance in the singular for 1 ("needs 1 email", "needs 1 text message part"); Studio's copy
// of the message matches.
test('allowance messages: 1 email / 1 text message part, plurals otherwise', async () => {
  const { allowanceProblem, allowanceLine, allowanceUnits } = await import('../../components/newsletters/lib/sendChecks.ts');
  assert.equal(allowanceUnits(1, 'email'), '1 email');
  assert.equal(allowanceUnits(2, 'email'), '2 emails');
  assert.equal(allowanceUnits(1, 'sms'), '1 text message part');
  assert.equal(allowanceUnits(1180, 'sms'), '1,180 text message parts');
  assert.equal(allowanceUnits(0, 'sms'), '0 text message parts');
  assert.equal(allowanceProblem(allowance(0, 0), counts(1, 0), ['email']), 'This needs 1 email, but your plan has 0 left this month.');
  assert.equal(allowanceProblem(allowance(0), counts(0, 1), ['sms']), 'This needs 1 text message part, but your plan has 0 left this month.');
  assert.equal(allowanceProblem(allowance(1), counts(0, 1), ['sms'], 2), 'This needs 2 text message parts, but your plan has 1 left this month.');
  assert.equal(allowanceLine(allowance(1, 1), ['email', 'sms']), 'Your plan has 1 email and 1 text message part left this month. It resets on Nov 1.');
});

// A scheduled newsletter holds its whole text audience, so sms_pending can be more than what is left: never below 0.
test('pending more than what is left: 0 left, never negative, and the note counts every text as skipped', async () => {
  const { allowanceLeft, allowanceLine } = await import('../../components/newsletters/lib/sendChecks.ts');
  const held = { ...allowance(40), sms_pending: 900, email_pending: 9000 };
  assert.deepEqual(allowanceLeft(held), { email: 0, sms: 0 });
  assert.equal(allowanceLine(held, ['email', 'sms']), 'Your plan has 0 emails and 0 text message parts left this month. It resets on Nov 1.');
  const r = sendAllowance({ ...allowance(40), sms_pending: 900 }, counts(1180, 310), ['email', 'sms']);
  assert.equal(r.skippedTexts, 310);
  assert.equal(r.note, "310 text messages won't be sent: no text parts left this month. Emails will still go out.");
});
