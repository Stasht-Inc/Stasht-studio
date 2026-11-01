// tests/utils/effectivePlan.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Deepak, 1 Nov 2026 (batch 3 item 2): an external account covered by its main account (Serpa Chrysler pays) is on
// the main account's plan. Wherever it sees its plan it sees that plan — "Business", with "Covered by Serpa Chrysler" —
// never its own "Starter", and no upgrade prompt for what that plan already includes. The API sends the effective
// plan_name and plan_covered_by {id, name} on GET /user/storage-overview and GET /user/profile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planKey, planLabel, planCoveredBy, coveredByNote, offersUpgrade } from '../../utils/effectivePlan.ts';

test('plan names map to the plans Studio sells: Starter, Teams (intermediate), Business (professional)', () => {
  assert.equal(planKey('Starter'), 'starter');
  assert.equal(planKey('starter'), 'starter');
  assert.equal(planKey('Free'), 'starter');
  assert.equal(planKey('Intermediate'), 'intermediate');
  assert.equal(planKey('Teams'), 'intermediate');
  assert.equal(planKey('Professional'), 'professional');
  assert.equal(planKey('Business'), 'professional', 'the live plans row is named Business');
  assert.equal(planKey(' business '), 'professional');
  assert.equal(planKey(''), null);
  assert.equal(planKey(null), null);
  assert.equal(planKey('Enterprise'), null);
  assert.equal(planLabel('Business'), 'Business');
  assert.equal(planLabel('professional'), 'Business');
  assert.equal(planLabel('intermediate'), 'Teams');
  assert.equal(planLabel('Starter'), 'Starter');
  assert.equal(planLabel(undefined), null);
});

test('who covers the plan: plan_covered_by from storage-overview or the profile, else null', () => {
  assert.deepEqual(planCoveredBy({ plan_name: 'Business', plan_covered_by: { id: 889, name: 'Serpa Chrysler' } }), { id: 889, name: 'Serpa Chrysler' });
  assert.deepEqual(planCoveredBy({ plan_covered_by: { id: 889, name: null } }), { id: 889, name: '' });
  assert.equal(planCoveredBy({ plan_name: 'Starter', plan_covered_by: null }), null);
  assert.equal(planCoveredBy({ plan_name: 'Starter' }), null, 'an older API');
  assert.equal(planCoveredBy({ plan_covered_by: 'yes' }), null);
  assert.equal(planCoveredBy(null), null);
});

test('the note under the plan names the main account', () => {
  assert.equal(coveredByNote({ id: 889, name: 'Serpa Chrysler' }), 'Covered by Serpa Chrysler');
  assert.equal(coveredByNote({ id: 889, name: '  ' }), 'Covered by your main account');
  assert.equal(coveredByNote(null), null);
});

test('no upgrade prompt when the main account already covers the top plan', () => {
  const serpa = { id: 889, name: 'Serpa Chrysler' };
  assert.equal(offersUpgrade('Business', serpa), false, 'covered on Business: nothing to upgrade to');
  assert.equal(offersUpgrade('professional', serpa), false);
  assert.equal(offersUpgrade('Teams', serpa), true, 'covered on Teams: Business still adds features');
  assert.equal(offersUpgrade('Starter', null), true, 'own Starter: as before');
  assert.equal(offersUpgrade('Business', null), true, 'an account paying for Business itself: unchanged');
});

test('a covered account skips the new-account plan picker; everyone else still gets it', async () => {
  const { skipsPlanPicker, storageOverviewOf } = await import('../../utils/effectivePlan.ts');
  // E2E, 1 Nov 2026: a covered salesperson activating by email got the non-closable "Upgrade Your Plan" picker.
  const covered = { success: true, data: { data: { storage_overview: { plan_name: 'Business', plan_covered_by: { id: 889, name: 'Serpa Chrysler' } } } } };
  const own = { success: true, data: { data: { storage_overview: { plan_name: 'Starter', plan_covered_by: null } } } };
  assert.deepEqual(storageOverviewOf(covered), covered.data.data.storage_overview);
  assert.deepEqual(storageOverviewOf({ success: true, data: { storage_overview: { plan_name: 'Teams' } } }), { plan_name: 'Teams' });
  assert.equal(storageOverviewOf(null), null);
  assert.equal(skipsPlanPicker(storageOverviewOf(covered)), true);
  assert.equal(skipsPlanPicker(storageOverviewOf(own)), false);
  assert.equal(skipsPlanPicker(null), false, 'unknown (the check failed): the picker shows, as before');
});
