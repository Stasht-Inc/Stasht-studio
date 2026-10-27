// tests/newsletter/api-result.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unwrap, flattenFieldErrors, toResult, resultFromRaw, testSendResult, GENERIC_ERROR, RATE_LIMITED_ERROR, PLAN_REQUIRED_ERROR, TEST_LIMIT_ERROR,
} from '../../components/newsletters/lib/apiResult.ts';

test('unwrap peels exactly one {success, data} envelope', () => {
  assert.deepEqual(unwrap({ success: true, data: { id: 12 } }), { id: 12 });
  assert.deepEqual(unwrap({ success: true, data: { data: [1], meta: { page: 1 } } }), { data: [1], meta: { page: 1 } });
  assert.deepEqual(unwrap({ counts: { sent: 1 } }), { counts: { sent: 1 } });
  assert.deepEqual(unwrap([1, 2]), [1, 2]);
  assert.equal(unwrap(undefined), undefined);
});

test('flattenFieldErrors keeps the full key and its first part, with all of a key\'s messages', () => {
  assert.deepEqual(
    flattenFieldErrors({ subject: ['Add a subject line.'], 'blocks.2.data.url': ['Use a link that starts with https://.'] }),
    { subject: 'Add a subject line.', 'blocks.2.data.url': 'Use a link that starts with https://.', blocks: 'Use a link that starts with https://.' },
  );
  // Send / schedule list every unfinished section under `blocks` (contract note 6).
  assert.deepEqual(
    flattenFieldErrors({ blocks: ['Section 2 (Image) needs a picture.', 'Section 4 (Button) needs a link.', 'Section 2 (Image) needs a picture.'] }),
    { blocks: 'Section 2 (Image) needs a picture. Section 4 (Button) needs a link.' },
  );
  assert.deepEqual(flattenFieldErrors(null), {});
  assert.deepEqual(flattenFieldErrors(['nope']), {});
});

test('toResult maps a wrapped success', () => {
  const r = toResult({ success: true, data: { success: true, data: { id: 3 } } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { id: 3 });
  assert.deepEqual(r.fieldErrors, {});
});

test('toResult maps 422, 409, 403 plan_required, 429 and the allowance shortfall', () => {
  const v = toResult({ success: false, error: 'The subject field is required.', message: 'The subject field is required.', errors: { subject: ['Add a subject line.'] } });
  assert.equal(v.ok, false);
  assert.equal(v.fieldErrors.subject, 'Add a subject line.');
  assert.equal(v.conflict, false);
  assert.equal(toResult({ success: false, error: 'Only drafts can be changed.', conflict: true }).conflict, true);
  const p = toResult({ success: false, error: 'Upgrade your plan to use this.', code: 'plan_required', statusCode: 403 });
  assert.equal(p.planRequired, true);
  assert.equal(p.error, PLAN_REQUIRED_ERROR);
  assert.equal(toResult({ success: false, error: 'Too many requests right now. Please wait a moment and try again.' }).error, RATE_LIMITED_ERROR);
  const a = toResult({
    success: false, error: 'Not enough emails left this month.', errors: { allowance: ['Not enough emails left this month.'] },
    allowance: { channel: 'email', needed: 1204, remaining: 900 },
  });
  assert.deepEqual(a.allowance, { channel: 'email', needed: 1204, remaining: 900 });
  assert.equal(toResult({ success: false, error: 'x', allowance: { channel: 'fax', needed: 1, remaining: 0 } }).allowance, undefined);
  assert.equal(toResult(null).error, GENERIC_ERROR);
});

test('toResult prefers apiRequest\'s rateLimited / statusCode 429 flags over the message text, and the server\'s own words', () => {
  // Review 9–12 #8: the server's message (apiRequest keeps it as `message`) says what happened; Laravel's default
  // throttle text ("Too Many Attempts.") is replaced with plain words.
  const r = toResult({ success: false, error: 'Too many requests right now. Please wait a moment and try again.', message: 'Slow down for a minute.', rateLimited: true, statusCode: 429 });
  assert.equal(r.rateLimited, true);
  assert.equal(r.error, 'Slow down for a minute.');
  assert.equal(toResult({ success: false, error: 'Too many requests right now.', message: 'Too Many Attempts.', rateLimited: true, statusCode: 429 }).error, RATE_LIMITED_ERROR);
  assert.equal(toResult({ success: false, error: 'Slow down', statusCode: 429 }).error, RATE_LIMITED_ERROR);
});

test('resultFromRaw maps a multipart upload response', () => {
  assert.deepEqual(resultFromRaw(201, { success: true, data: { url: 'https://cdn.example/a.png' } }), { ok: true, data: { url: 'https://cdn.example/a.png' }, fieldErrors: {} });
  const bad = resultFromRaw(422, { message: 'The file must be an image.', errors: { file: ['The file must be an image.'] } });
  assert.equal(bad.ok, false);
  assert.equal(bad.fieldErrors.file, 'The file must be an image.');
  assert.equal(resultFromRaw(403, { code: 'plan_required' }).planRequired, true);
  assert.equal(resultFromRaw(429, null).error, RATE_LIMITED_ERROR);
  assert.equal(resultFromRaw(500, null).error, GENERIC_ERROR);
});

// The test send's hourly limit is a 429 too; apiRequest swaps the server's message for a generic one.
test('testSendResult says the hourly test limit was reached on a 429, and leaves everything else alone', () => {
  assert.equal(TEST_LIMIT_ERROR, "You've sent the most test messages for this hour. Try again later.");
  const limited = toResult({ success: false, error: 'Too many requests right now. Please wait a moment and try again.', message: "You've sent the most tests allowed this hour. Try again later.", rateLimited: true, statusCode: 429 });
  assert.equal(limited.rateLimited, true);
  assert.equal(testSendResult(limited).error, TEST_LIMIT_ERROR);
  assert.equal(testSendResult(resultFromRaw(429, null)).error, TEST_LIMIT_ERROR);
  const other = toResult({ success: false, message: 'Add an email address to your profile to get a test email.', errors: { channel: ['Add an email address to your profile to get a test email.'] } });
  assert.deepEqual(testSendResult(other), other);
  const ok = toResult({ success: true, data: { success: true, data: { sent_to: 'a@b.ca' } } });
  assert.deepEqual(testSendResult(ok), ok);
});

test('toResult keeps the server code, and a 409 stale is a stale result, not a status conflict', async () => {
  const { toResult, STALE_ERROR } = await import('../../components/newsletters/lib/apiResult.ts');
  const r = toResult({ success: false, conflict: true, code: 'stale', message: 'Changed elsewhere.' });
  assert.equal(r.code, 'stale');
  assert.equal(r.stale, true);
  assert.equal(r.conflict, false);
  assert.equal(r.error, STALE_ERROR);
  assert.equal(toResult({ success: false, conflict: true, message: 'Only drafts can be changed.' }).conflict, true);
});

test('paused sending: plain words for the whole service and for one account, never a status conflict', async () => {
  const { toResult, PAUSED_ERROR, ACCOUNT_PAUSED_ERROR } = await import('../../components/newsletters/lib/apiResult.ts');
  const all = toResult({ success: false, conflict: true, code: 'newsletters_paused', message: 'Newsletters are paused. Try again later.' });
  assert.equal(all.error, PAUSED_ERROR);
  assert.equal(PAUSED_ERROR, 'Newsletters are paused right now. Your draft is saved. Try again later.');
  assert.equal(all.paused, 'all');
  assert.equal(all.conflict, false);
  const one = toResult({ success: false, code: 'newsletters_account_paused', message: 'x' });
  assert.equal(one.error, ACCOUNT_PAUSED_ERROR);
  assert.equal(ACCOUNT_PAUSED_ERROR, 'Sending is paused for your account. Contact support.');
  assert.equal(one.paused, 'account');
  assert.equal(toResult({ success: false, message: 'no' }).paused, undefined);
});
