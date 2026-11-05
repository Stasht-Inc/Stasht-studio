// tests/utils/planPricing.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris 5 Nov 2026 (points 5 + 7) + Deepak's decision: Teams $19/month with 100 AI credits a month, Business $29/month with
// 250. Yearly keeps the old "Save 17%" ratio (the old Teams $9 showed $7.47/month yearly: 9 × 0.83). The plan picker
// (UpgradePlanModal) and Billing's "Plan Includes" read these.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_PRICING, YEARLY_RATIO, yearlyMonthlyPrice, yearlyTotal, creditsFeature, priceLabel,
} from '../../utils/planPricing.ts';

test('Teams is $19 a month with 100 credits, Business $29 with 250, Starter free with 5', () => {
  assert.equal(PLAN_PRICING.intermediate.monthly, 19);
  assert.equal(PLAN_PRICING.intermediate.credits, 100);
  assert.equal(PLAN_PRICING.professional.monthly, 29);
  assert.equal(PLAN_PRICING.professional.credits, 250);
  assert.equal(PLAN_PRICING.starter.monthly, 0);
  assert.equal(PLAN_PRICING.starter.credits, 5);
});

test('yearly keeps the old Save 17% ratio', () => {
  assert.equal(YEARLY_RATIO, 0.83);
  assert.equal(yearlyMonthlyPrice(9), 7.47, 'the old Teams yearly price, unchanged ratio');
  assert.equal(yearlyMonthlyPrice(19), 15.77);
  assert.equal(yearlyMonthlyPrice(29), 24.07);
  assert.equal(yearlyMonthlyPrice(0), 0);
});

test('the yearly charge is twelve of those months', () => {
  assert.equal(yearlyTotal(19), 189.24);
  assert.equal(yearlyTotal(29), 288.84);
});

test('the credits line reads as on the plan cards', () => {
  assert.equal(creditsFeature('intermediate'), 'AI Credits\n(100 credits/mo)');
  assert.equal(creditsFeature('professional'), 'AI Credits\n(250 credits/mo)');
  assert.equal(creditsFeature('starter'), 'AI Credits\n(5 credits/mo)');
});

test('prices show whole dollars monthly and cents yearly', () => {
  assert.equal(priceLabel(19, false), '19');
  assert.equal(priceLabel(29, false), '29');
  assert.equal(priceLabel(19, true), '15.77');
  assert.equal(priceLabel(29, true), '24.07');
});
