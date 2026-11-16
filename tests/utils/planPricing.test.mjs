// tests/utils/planPricing.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris 16 Nov 2026: "Studio is wrong. Website is right." The Upgrade Your Plan cards (UpgradePlanModal) and Billing's
// "Plan Includes" list exactly the marketing website's lines: Starter free / 10 credits, Teams $19 / 100 (Popular),
// Business $39 / 250 (was $29). Yearly keeps the old "Save 17%" ratio (the old Teams $9 showed $7.47/month: 9 × 0.83).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN_PRICING, YEARLY_RATIO, yearlyMonthlyPrice, yearlyTotal, creditsFeature, priceLabel, emailsFeature,
  PLAN_FEATURES, PLAN_DESCRIPTIONS, POPULAR_PLAN, unlockedFeatures,
} from '../../utils/planPricing.ts';

test('Starter is free with 10 credits, Teams $19 with 100, Business $39 with 250', () => {
  assert.deepEqual(PLAN_PRICING, {
    starter: { monthly: 0, credits: 10 },
    intermediate: { monthly: 19, credits: 100 },
    professional: { monthly: 39, credits: 250 },
  });
});

test('yearly keeps the old Save 17% ratio', () => {
  assert.equal(YEARLY_RATIO, 0.83);
  assert.equal(yearlyMonthlyPrice(9), 7.47, 'the old Teams yearly price, unchanged ratio');
  assert.equal(yearlyMonthlyPrice(19), 15.77);
  assert.equal(yearlyMonthlyPrice(39), 32.37);
  assert.equal(yearlyMonthlyPrice(0), 0);
});

test('the yearly charge is twelve of those months: Business $388.44 a year (the Stripe price to create)', () => {
  assert.equal(yearlyTotal(19), 189.24);
  assert.equal(yearlyTotal(39), 388.44);
});

test('prices show whole dollars monthly and cents yearly', () => {
  assert.equal(priceLabel(19, false), '19');
  assert.equal(priceLabel(39, false), '39');
  assert.equal(priceLabel(19, true), '15.77');
  assert.equal(priceLabel(39, true), '32.37');
});

test('the credits and email lines read as on the website', () => {
  assert.equal(creditsFeature('starter'), 'AI Tokens\n(10 credits/mo)');
  assert.equal(creditsFeature('intermediate'), 'AI Tokens\n(100 credits/mo)');
  assert.equal(creditsFeature('professional'), 'AI Tokens\n(250 credits/mo)');
  assert.equal(emailsFeature('starter'), 'Email Campaigns\n(500 emails/mo)');
  assert.equal(emailsFeature('intermediate'), 'Email Campaigns\n(5,000 emails/mo)');
  assert.equal(emailsFeature('professional'), 'Email Campaigns\n(10,000 emails/mo)');
});

test('each card lists exactly the website lines (+ Contact Us Widget and Website Catalogue on Business)', () => {
  assert.deepEqual(PLAN_FEATURES.starter, [
    'AI Tokens\n(10 credits/mo)', 'Email Campaigns\n(500 emails/mo)', '3 Storeels', '1 Admin Role', '5 Collaborators', 'Leads Manager',
  ]);
  assert.deepEqual(PLAN_FEATURES.intermediate, [
    'AI Tokens\n(100 credits/mo)', 'Email Campaigns\n(5,000 emails/mo)', 'Unlimited Storeels', 'Connectors', '2 Admin Roles',
    'Unlimited Collaborators', 'Leads Manager',
  ]);
  assert.deepEqual(PLAN_FEATURES.professional, [
    'AI Tokens\n(250 credits/mo)', 'Email Campaigns\n(10,000 emails/mo)', 'Unlimited Storeels', 'Connectors', '5 Admin Roles',
    'Unlimited Collaborators', 'Leads Manager', 'Moderation Tool', 'Add Properties', 'Contact Us Widget',
    'Website Catalogue\n(up to 500 products)',
  ]);
  assert.deepEqual(PLAN_DESCRIPTIONS, {
    starter: 'Perfect for small teams getting started with brand storytelling.',
    intermediate: 'For growing organizations that need more features.',
    professional: 'For large organizations with marketing teams.',
  });
  assert.equal(POPULAR_PLAN, 'intermediate', 'the website marks Team "Popular"');
});

test('no old line survives: storage, sync, publishing, 3 admin roles on Teams, Property Accounts on Teams, $29', () => {
  const all = Object.values(PLAN_FEATURES).flat().join('|');
  for (const gone of ['GB', 'TB', 'Sync', 'Publishing', 'Property Accounts', 'Everything in', 'AI Credits']) {
    assert.ok(!all.includes(gone), `no "${gone}" line`);
  }
  assert.ok(!PLAN_FEATURES.intermediate.includes('3 Admin Roles'));
  assert.ok(!PLAN_FEATURES.intermediate.includes('Add Properties'), 'Add Properties is on the Business card only');
  assert.ok(!PLAN_FEATURES.starter.includes('Unlimited Collaborators'));
});

test("Billing's Upgrade to Unlock lists only what the next plan adds", () => {
  assert.deepEqual(unlockedFeatures(PLAN_FEATURES.starter, PLAN_FEATURES.intermediate), [
    'AI Tokens\n(100 credits/mo)', 'Email Campaigns\n(5,000 emails/mo)', 'Unlimited Storeels', 'Connectors', '2 Admin Roles', 'Unlimited Collaborators',
  ]);
  assert.deepEqual(unlockedFeatures(PLAN_FEATURES.intermediate, PLAN_FEATURES.professional), [
    'AI Tokens\n(250 credits/mo)', 'Email Campaigns\n(10,000 emails/mo)', '5 Admin Roles', 'Moderation Tool', 'Add Properties', 'Contact Us Widget',
    'Website Catalogue\n(up to 500 products)',
  ]);
});
