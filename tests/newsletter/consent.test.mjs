// [wdy2xh2p3e] Consent: the CSV date column becomes each row's consent_at; the recipients step names what consent
// and phone rules left out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildImportRows, detectColumns } from '../../components/newsletters/lib/csv.ts';
import { skippedSummary, ZERO_COUNT } from '../../components/newsletters/lib/audience.ts';
import { CONSENT_OPTIONS, consentLabel } from '../../components/newsletters/lib/consent.ts';

test('a date column is found by its header and kept as consent_at', () => {
  for (const header of ['Date', 'Signed up', 'Consent date', 'Signup date', 'Opt-in date', 'Date added', 'Subscribed on']) {
    const m = detectColumns([['Name', 'Email', header], ['Ava', 'ava@example.com', '2026-05-01']]);
    assert.equal(m.consentAt, 2, header);
  }
  const table = [['Name', 'Email', 'Signed up'], ['Ava', 'ava@example.com', '2026-05-01'], ['Ben', 'ben@example.com', ''], ['Cy', 'cy@example.com', ' May 3, 2026 ']];
  assert.deepEqual(buildImportRows(table, detectColumns(table)).rows, [
    { name: 'Ava', email: 'ava@example.com', consent_at: '2026-05-01' },
    { name: 'Ben', email: 'ben@example.com' },
    { name: 'Cy', email: 'cy@example.com', consent_at: '2026-05-03' },
  ]);
});

test('no date column: no consent_at, and a too-long cell is left out (the API ignores it anyway)', () => {
  const plain = [['Name', 'Email'], ['Ava', 'ava@example.com']];
  assert.equal(detectColumns(plain).consentAt, null);
  assert.deepEqual(buildImportRows(plain, detectColumns(plain)).rows, [{ name: 'Ava', email: 'ava@example.com' }]);
  const long = [['Email', 'Date'], ['ava@example.com', 'x'.repeat(41)]]; // unreadable: no date sent
  assert.deepEqual(buildImportRows(long, detectColumns(long)).rows, [{ email: 'ava@example.com' }]);
});

test('without a header row nothing is taken as a date column', () => {
  assert.equal(detectColumns([['Ava Chen', 'ava@example.com', '2026-05-01']]).consentAt, null);
});

test('consent choices: express and implied, in plain words', () => {
  assert.deepEqual(CONSENT_OPTIONS.map((o) => o.value), ['express', 'implied']);
  assert.match(CONSENT_OPTIONS[0].label, /signed up or asked to hear from us/);
  assert.match(CONSENT_OPTIONS[1].label, /customers or enquired recently/);
  assert.equal(consentLabel('express'), 'Express consent');
  assert.equal(consentLabel('implied'), 'Implied consent');
  assert.equal(consentLabel(null), 'Consent not recorded');
});

test('skipped counts include expired consent and numbers that cannot get texts', () => {
  const counts = { email: 10, sms: 4, skipped: { no_email: 0, no_phone: 0, unsubscribed: 2, duplicate: 0, consent_expired: 5, unsupported_number: 3 } };
  assert.equal(skippedSummary(counts, ['email', 'sms']),
    "Not included: 2 unsubscribed. 5 emails or texts left out: their consent is older than 6 months. 3 phone numbers can't get texts (only Canadian and US mobile numbers).");
  // Phone numbers only matter when texts are on.
  assert.equal(skippedSummary(counts, ['email']), 'Not included: 2 unsubscribed. 5 emails left out: their consent is older than 6 months.');
  assert.equal(skippedSummary({ ...counts, skipped: { ...counts.skipped, unsubscribed: 0 } }, ['email']), '5 emails left out: their consent is older than 6 months.');
  // An older API without the new keys.
  assert.equal(skippedSummary({ email: 1, sms: 0, skipped: { no_email: 1, no_phone: 0, unsubscribed: 0, duplicate: 0 } }, ['email']), 'Not included: 1 with no email address.');
  assert.equal(ZERO_COUNT.skipped.consent_expired, 0);
  assert.equal(ZERO_COUNT.skipped.unsupported_number, 0);
});
