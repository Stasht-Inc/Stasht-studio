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

// ── Add a card (Chris, 4 Nov 2026) ───────────────────────────────────────
// While the trial runs and no card is on file, the banner adds "Add credit card info to avoid disruption to service.
// You won't be billed until the trial is over" with an action that opens the add-card modal. Card on file: the existing
// GET /stripe/payment-methods (an account with no Stripe customer answers success + an empty list).
test('card on file: read from GET /stripe/payment-methods; unknown (null) when the call failed', async () => {
  const { cardOnFileFrom } = await import('../../utils/trialBanner.ts');
  assert.equal(cardOnFileFrom({ success: true, payment_methods: [] }), false);
  assert.equal(cardOnFileFrom({ success: true, payment_methods: [{ id: 'pm_1', brand: 'visa', last4: '4242' }] }), true);
  assert.equal(cardOnFileFrom({ success: false, error: 'Stripe down' }), null);
  assert.equal(cardOnFileFrom({ success: true }), null, 'no list: unknown');
  assert.equal(cardOnFileFrom(null), null);
  assert.equal(cardOnFileFrom(undefined), null);
});

test('the add-card line shows only while the trial runs and the account is known to have no card', async () => {
  const { showAddCardNotice } = await import('../../utils/trialBanner.ts');
  const running = { ended: false, daysLeft: 85, endDate: 'Jan 28, 2027' };
  assert.equal(showAddCardNotice(running, false), true);
  assert.equal(showAddCardNotice(running, true), false, 'a card is on file');
  assert.equal(showAddCardNotice(running, null), false, 'unknown: never nag on a failed check');
  assert.equal(showAddCardNotice({ ...running, ended: true }, false), false, 'the trial is over: not "won\'t be billed until"');
  assert.equal(showAddCardNotice(null, false), false, 'no banner (no trial, or covered by the main account)');
});

test('the add-card wording is exactly Chris\'s', async () => {
  const { ADD_CARD_NOTICE } = await import('../../utils/trialBanner.ts');
  assert.equal(ADD_CARD_NOTICE, "Add credit card info to avoid disruption to service. You won't be billed until the trial is over");
});

// Review (4 Nov): an expired card isn't "on file" — a card counts only while it is still valid at the trial's end
// (a card is good through the last day of its exp_month / exp_year).
test('card on file: only a card still valid on the trial\'s last day counts', async () => {
  const { cardOnFileFrom } = await import('../../utils/trialBanner.ts');
  const trialEnd = new Date(2027, 0, 28); // Jan 28, 2027
  const card = (exp_month, exp_year) => ({ success: true, payment_methods: [{ id: 'pm', brand: 'visa', last4: '4242', exp_month, exp_year }] });
  assert.equal(cardOnFileFrom(card(1, 2027), trialEnd), true, 'expires end of Jan 2027: still good on Jan 28');
  assert.equal(cardOnFileFrom(card(12, 2026), trialEnd), false, 'expires before the trial ends');
  assert.equal(cardOnFileFrom(card(4, 2030), trialEnd), true);
  assert.equal(cardOnFileFrom(card('03', '2031'), trialEnd), true, 'strings from the API');
  assert.equal(cardOnFileFrom({ success: true, payment_methods: [card(12, 2026).payment_methods[0], { id: 'pm2', exp_month: 6, exp_year: 2028 }] }, trialEnd), true, 'one good card is enough');
  assert.equal(cardOnFileFrom({ success: true, payment_methods: [{ id: 'pm3' }] }, trialEnd), true, 'no expiry given: counts');
  assert.equal(cardOnFileFrom(card(12, 2026), null), true, 'no trial end known: any card counts');
});

// Review (4 Nov): GET /stripe/payment-methods is asked once per login (token), not on every Dashboard visit; adding a
// card clears it.
test('payment methods are fetched once per token; a failure is not kept; clearing asks again', async () => {
  const { cachedPaymentMethods, clearPaymentMethodsCache } = await import('../../utils/paymentMethodsCache.ts');
  clearPaymentMethodsCache();
  let calls = 0;
  const ok = async () => { calls += 1; return { success: true, payment_methods: [] }; };
  const a = await cachedPaymentMethods('tok-1', ok);
  const b = await cachedPaymentMethods('tok-1', ok);
  assert.equal(calls, 1, 'one call for two Dashboard visits');
  assert.deepEqual(a, b);
  await cachedPaymentMethods('tok-2', ok);
  assert.equal(calls, 2, 'another login asks again');
  clearPaymentMethodsCache();
  await cachedPaymentMethods('tok-2', ok);
  assert.equal(calls, 3, 'cleared (a card was added): asks again');
  let fails = 0;
  const bad = async () => { fails += 1; return { success: false, error: 'Stripe down' }; };
  await cachedPaymentMethods('tok-3', bad);
  await cachedPaymentMethods('tok-3', bad);
  assert.equal(fails, 2, 'a failed answer is not kept');
  let throws = 0;
  const boom = async () => { throws += 1; throw new Error('network'); };
  assert.equal(await cachedPaymentMethods('tok-4', boom), null, 'a thrown call answers null');
  await cachedPaymentMethods('tok-4', boom);
  assert.equal(throws, 2, 'and is not kept either');
  assert.equal(await cachedPaymentMethods(null, ok), null, 'no token: nothing asked');
});
