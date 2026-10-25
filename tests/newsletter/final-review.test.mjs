// Final review of the Studio follow-ups: consent dates read in the browser, "left out" wording, putting an edited
// scheduled newsletter back on the schedule.
process.env.TZ = 'America/Toronto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readConsentDates, consentDateOrder, buildImportRows, detectColumns } from '../../components/newsletters/lib/csv.ts';
import { skippedSummary } from '../../components/newsletters/lib/audience.ts';
import { markUnscheduled, unscheduledFor, clearUnscheduled, putBackProblem } from '../../components/newsletters/lib/editScheduled.ts';

const NOW = new Date('2026-10-25T16:00:00Z');

test('consent dates: ISO and yyyy-mm-dd are read as they are', () => {
  const r = readConsentDates(['2026-05-01', '2026-05-01T14:30:00Z', '', ' 2026-06-02 '], null, NOW);
  assert.deepEqual(r.values, ['2026-05-01', '2026-05-01T14:30:00.000Z', null, '2026-06-02']);
  assert.equal(r.unreadable, 0);
});

test('consent dates: day/month or month/day is worked out from the column', () => {
  assert.equal(consentDateOrder(['13/05/2026', '01/06/2026']), 'dmy');
  assert.equal(consentDateOrder(['05/13/2026', '06/01/2026']), 'mdy');
  assert.equal(consentDateOrder(['01/06/2026', '03/04/2026']), 'ambiguous');
  assert.equal(consentDateOrder(['05/05/2026']), 'dmy', 'same either way');
  assert.equal(consentDateOrder(['2026-05-01', '']), null, 'no slashed dates');
  assert.deepEqual(readConsentDates(['13/05/2026', '01/06/2026'], null, NOW).values, ['2026-05-13', '2026-06-01']);
  assert.deepEqual(readConsentDates(['05/13/2026', '06.01.2026'], null, NOW).values, ['2026-05-13', '2026-06-01']);
  // Ambiguous: the person's answer decides; without one, nothing is guessed.
  assert.deepEqual(readConsentDates(['01/06/2026'], 'mdy', NOW).values, ['2026-01-06']);
  assert.deepEqual(readConsentDates(['01/06/2026'], 'dmy', NOW).values, ['2026-06-01']);
  assert.equal(readConsentDates(['01/06/2026', '03/04/2026'], null, NOW).needsOrder, true);
});

test('consent dates: unreadable, future or very old dates are counted (the import time is used)', () => {
  const r = readConsentDates(['soon', '2027-01-01', '1985-01-01', '31/31/2026', 'May 3, 2026'], null, NOW);
  assert.deepEqual(r.values, [null, null, null, null, '2026-05-03']);
  assert.equal(r.unreadable, 4);
});

test('import rows carry the browser-read ISO date', () => {
  const table = [['Email', 'Signed up'], ['a@x.ca', '13/05/2026'], ['b@x.ca', 'nope']];
  const rows = buildImportRows(table, detectColumns(table), null, NOW);
  assert.deepEqual(rows.rows, [{ email: 'a@x.ca', consent_at: '2026-05-13' }, { email: 'b@x.ca' }]);
  assert.equal(rows.unreadableDates, 1);
});

test('"left out" says emails or texts (the API counts it per channel)', () => {
  const counts = { email: 1, sms: 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0, consent_expired: 5, unsupported_number: 0 } };
  assert.equal(skippedSummary(counts, ['email', 'sms']), '5 emails or texts left out: their consent is older than 6 months.');
  assert.equal(skippedSummary(counts, ['email']), '5 emails left out: their consent is older than 6 months.');
  assert.equal(skippedSummary({ ...counts, skipped: { ...counts.skipped, consent_expired: 1 } }, ['sms']), '1 text left out: their consent is older than 6 months.');
});

test('an edited scheduled newsletter is remembered until it is scheduled again or left as a draft', () => {
  markUnscheduled(22, '2026-10-27T14:00:00Z');
  assert.deepEqual(unscheduledFor(22), { plannedAt: '2026-10-27T14:00:00Z' });
  assert.equal(unscheduledFor(23), null);
  clearUnscheduled(22);
  assert.equal(unscheduledFor(22), null);
});

test('put back on the schedule only for a time still allowed', () => {
  assert.equal(putBackProblem('2026-10-27T14:00:00Z', ['email'], NOW), null);
  assert.match(putBackProblem('2026-10-25T16:03:00Z', ['email'], NOW), /at least 5 minutes from now/);
  assert.match(putBackProblem('2026-10-25T10:00:00Z', ['email'], NOW), /at least 5 minutes from now/);
  assert.match(putBackProblem('2026-10-28T02:00:00Z', ['sms'], NOW), /Texts can only go out between 8am and 9pm/); // 22:00 Toronto
  assert.equal(putBackProblem('2026-10-28T02:00:00Z', ['email'], NOW), null);
  assert.equal(putBackProblem(null, ['email'], NOW), 'No time is picked.');
});
