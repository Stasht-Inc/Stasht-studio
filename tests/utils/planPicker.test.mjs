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
