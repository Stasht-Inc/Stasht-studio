// tests/utils/planPicker.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Release E2E, 5 Nov 2026 (B2): a Teams account (Admin Portal "Teams", or Stripe "intermediate") could click the Teams
// card and get "Upgrade to Teams". Both name families count, the account's own plan is marked "Current plan" and can't
// be bought again; Business still offers Upgrade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPickerPlan, pickerButton, isCurrentPlan } from '../../utils/planPicker.ts';

test('the plan that opens selected: the next plan up, by either name family', () => {
  assert.equal(defaultPickerPlan('Teams'), 'professional');
  assert.equal(defaultPickerPlan('intermediate'), 'professional');
  assert.equal(defaultPickerPlan('Business'), 'professional');
  assert.equal(defaultPickerPlan('professional'), 'professional');
  assert.equal(defaultPickerPlan('Starter'), 'intermediate');
  assert.equal(defaultPickerPlan(undefined), 'intermediate');
});

test('the account\'s own plan is "Current plan" and disabled, whatever it is called', () => {
  for (const current of ['Teams', 'teams', 'Intermediate', 'intermediate', 'Team']) {
    assert.deepEqual(pickerButton(current, 'intermediate', 'Teams'), { label: 'Current plan', disabled: true }, current);
    assert.equal(isCurrentPlan(current, 'intermediate'), true, current);
  }
  assert.deepEqual(pickerButton('Business', 'professional', 'Business'), { label: 'Current plan', disabled: true });
  assert.deepEqual(pickerButton('starter', 'starter', 'Starter'), { label: 'Current plan', disabled: true });
});

test('Teams → Business is an upgrade; Business → Teams a downgrade; Starter is "Get Started"', () => {
  assert.deepEqual(pickerButton('Teams', 'professional', 'Business'), { label: 'Upgrade to Business', disabled: false });
  assert.deepEqual(pickerButton('intermediate', 'professional', 'Business'), { label: 'Upgrade to Business', disabled: false });
  assert.deepEqual(pickerButton('Business', 'intermediate', 'Teams'), { label: 'Downgrade to Teams', disabled: false });
  assert.deepEqual(pickerButton('Teams', 'starter', 'Starter'), { label: 'Get Started', disabled: false });
});

test('no plan known (a new account, the Trial Ended picker): nothing is "current"', () => {
  assert.deepEqual(pickerButton(undefined, 'intermediate', 'Teams'), { label: 'Upgrade to Teams', disabled: false });
  assert.deepEqual(pickerButton(undefined, 'starter', 'Starter'), { label: 'Get Started', disabled: false });
  assert.equal(isCurrentPlan(undefined, 'starter'), false);
  assert.equal(isCurrentPlan('Enterprise', 'professional'), false);
});

// Release fixes (5 Nov): Billing showed "0 / 100 Credits" for a full allowance (it read as none left).
test('credits left, plainly', async () => {
  const { creditsLeftLabel } = await import('../../utils/planPicker.ts');
  assert.equal(creditsLeftLabel(0, 100), '100 of 100 credits left');
  assert.equal(creditsLeftLabel(10, 100), '90 of 100 credits left');
  assert.equal(creditsLeftLabel(120, 100), '0 of 100 credits left');
  assert.equal(creditsLeftLabel(undefined, 1), '1 of 1 credit left');
  assert.equal(creditsLeftLabel(null, null), '0 of 0 credits left');
  assert.equal(creditsLeftLabel(0, 1500), '1,500 of 1,500 credits left');
});

// Release follow-up (5 Nov): an account on a running Admin Portal trial with no Stripe subscription must be able to buy
// its trial plan, so that plan is not "current" then. Current = an active subscription, or an admin-set plan with no
// trial (TheBodyPolitik: comped Teams). Until both answers are in (or if one fails) the plan stays current (no double buy).
test('which plan the picker treats as the account\'s own', async () => {
  const { pickerCurrentPlan, accountTrialOf, hasActiveSubscription } = await import('../../utils/planPicker.ts');
  const running = { trial_ends_on: '2026-12-01', trial_ended: false };
  const ended = { trial_ends_on: '2026-11-01', trial_ended: true };
  assert.equal(pickerCurrentPlan('Teams', { known: true, accountTrial: running, activeSubscription: false }), undefined, 'trial, no subscription: buyable');
  assert.equal(pickerCurrentPlan('Teams', { known: true, accountTrial: ended, activeSubscription: false }), undefined, 'ended trial, no subscription: buyable');
  assert.equal(pickerCurrentPlan('Teams', { known: true, accountTrial: running, activeSubscription: true }), 'Teams', 'paying');
  assert.equal(pickerCurrentPlan('Teams', { known: true, accountTrial: null, activeSubscription: false }), 'Teams', 'comped (admin-set, no trial)');
  assert.equal(pickerCurrentPlan('intermediate', { known: true, accountTrial: null, activeSubscription: true }), 'intermediate', 'Stripe Teams');
  assert.equal(pickerCurrentPlan('Teams', { known: false, accountTrial: running, activeSubscription: false }), 'Teams', 'not known yet: stays current');
  assert.equal(pickerCurrentPlan(undefined, { known: true, accountTrial: null, activeSubscription: false }), undefined);

  assert.deepEqual(accountTrialOf({ success: true, data: { data: { account_trial: running } } }), running);
  assert.deepEqual(accountTrialOf({ success: true, data: { account_trial: running } }), running);
  assert.equal(accountTrialOf({ success: true, data: { owned_properties: [{ trial_ends_at: 'x' }] } }), null, 'a property trial is not the plan trial');
  assert.equal(hasActiveSubscription({ success: true, active_subscriptions: [{ plan_name: 'intermediate' }] }), true);
  assert.equal(hasActiveSubscription({ success: true, active_subscriptions: [] }), false);
  assert.equal(hasActiveSubscription({ success: false }), null, 'unknown');
});
