// tests/utils/trialBanner.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// The Dashboard trial banner (Chris, 29 Oct 2026). The Admin Portal's "Trial Period Ends" date is the ACCOUNT's plan
// trial; GET /properties now returns it as data.account_trial (1 Nov 2026). The banner used to read only an owned
// property's trial_ends_at, so TheRoyalWoodShop (Business, trial ends 2027-01-28, no property of its own) saw nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTrial, trialBannerFrom, trialEndDate } from '../../utils/trialBanner.ts';

const NOW = new Date(2026, 10, 1, 10, 0, 0); // 1 Nov 2026, 10:00 local

const royalwood = {
  owned_properties: [],
  shared_properties: [],
  account_trial: { trial_ends_at: '2027-01-28T23:59:59+00:00', trial_ends_on: '2027-01-28', trial_ended: false },
};

test('an account trial shows with no property of its own', () => {
  const b = trialBannerFrom(royalwood, NOW, 'en-US');
  assert.deepEqual(b, { ended: false, daysLeft: 88, endDate: 'Jan 28, 2027', name: undefined });
});

test('the account trial wins over an owned property trial', () => {
  const data = { ...royalwood, owned_properties: [{ id: 3, name: 'Downtown', trial_ends_at: '2026-12-01 23:59:59', trial_ended: false }] };
  assert.equal(pickTrial(data)?.name, undefined);
  assert.equal(trialBannerFrom(data, NOW, 'en-US')?.endDate, 'Jan 28, 2027');
});

test('without an account trial the first owned property with a trial date still shows, with its name', () => {
  const data = {
    owned_properties: [
      { id: 1, name: 'No Trial', trial_ends_at: null },
      { id: 2, name: 'Downtown', trial_ends_at: '2026-11-05 23:59:59', trial_ended: false },
    ],
    account_trial: null,
  };
  assert.deepEqual(trialBannerFrom(data, NOW, 'en-US'), { ended: false, daysLeft: 4, endDate: 'Nov 5, 2026', name: 'Downtown' });
});

test('an older API without account_trial behaves as before', () => {
  assert.equal(trialBannerFrom({ owned_properties: [] }, NOW), null);
  assert.equal(trialBannerFrom({}, NOW), null);
  assert.equal(trialBannerFrom(null, NOW), null);
});

test('an ended account trial says so', () => {
  const data = { account_trial: { trial_ends_at: '2026-10-31T23:59:59+00:00', trial_ends_on: '2026-10-31', trial_ended: true } };
  const b = trialBannerFrom(data, NOW, 'en-US');
  assert.equal(b?.ended, true);
  assert.equal(b?.endDate, 'Oct 31, 2026');
});

test('the last day of the trial is 0 days left, not ended', () => {
  const data = { account_trial: { trial_ends_at: '2026-11-01T23:59:59+00:00', trial_ends_on: '2026-11-01', trial_ended: false } };
  assert.deepEqual(trialBannerFrom(data, NOW, 'en-US'), { ended: false, daysLeft: 0, endDate: 'Nov 1, 2026', name: undefined });
});

test('the end date is the chosen calendar date in any time zone (never a day early from a UTC parse)', () => {
  // trial_ends_on is used as a local calendar date; a bare date-time without a zone keeps its own date too.
  assert.deepEqual(dateParts(trialEndDate({ trial_ends_on: '2027-01-28', trial_ends_at: '2027-01-28T23:59:59+00:00' })), [2027, 1, 28]);
  assert.deepEqual(dateParts(trialEndDate({ trial_ends_at: '2027-01-28 23:59:59' })), [2027, 1, 28]);
  assert.deepEqual(dateParts(trialEndDate({ trial_ends_at: '2027-01-28' })), [2027, 1, 28]);
  assert.equal(trialEndDate({ trial_ends_at: 'not a date' }), null);
  assert.equal(trialEndDate({}), null);
});

function dateParts(d) {
  return d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()] : null;
}
