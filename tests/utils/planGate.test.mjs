// tests/utils/planGate.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 5 Nov 2026:
// - point 6: opening Pedalheads' property "Point Grey" got stuck on the non-closable "Upgrade Your Plan / Select a
//   plan to unlock the Stasht portal" picker. A property view works on its owner's plan, and an account that already
//   has a paid plan (its own, or covered by its main account) never needs the new-account picker.
// - point 1c: a brand-new account must be able to pick Starter (free) there.
// - point 4: TheBodyPolitik (a self sign-up, role 3) was upgraded to Teams and still had no Dashboard / Apps: the menu
//   hid them for role 3 whatever the plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newAccountPlanPicker, showsAccountTools, trialEndedPicker, phoneBarShowsAccountTools } from '../../utils/planGate.ts';

const overview = (plan_name, plan_covered_by = null) => ({ plan_name, plan_covered_by });

test('a new account on Starter (its default) gets the picker in its own view', () => {
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'personal', storageOverview: overview('Starter') }), 'show');
});

test('no new-account flag: no picker', () => {
  assert.equal(newAccountPlanPicker({ flagged: false, viewType: 'personal', storageOverview: overview('Starter') }), 'none');
});

test('an account that already has a paid plan never gets the picker (and the flag goes)', () => {
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'personal', storageOverview: overview('Intermediate') }), 'clear');
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'personal', storageOverview: overview('Teams') }), 'clear');
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'personal', storageOverview: overview('Business') }), 'clear');
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'property', storageOverview: overview('professional') }), 'clear');
});

test('an account covered by its paid main account never gets the picker', () => {
  const covered = overview('Business', { id: 959, name: 'Serpa Chrysler' });
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'personal', storageOverview: covered }), 'clear');
});

test('a property view is never gated: it waits until the account\'s own view', () => {
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'property', storageOverview: overview('Starter') }), 'later');
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'property', storageOverview: null }), 'later');
});

test('no answer from the server keeps the picker for a flagged account in its own view (as before)', () => {
  assert.equal(newAccountPlanPicker({ flagged: true, viewType: 'personal', storageOverview: null }), 'show');
});

test('Dashboard and Apps: every role but 3 as before; role 3 once the plan is Teams or Business', () => {
  assert.equal(showsAccountTools('2', { isStarter: true, known: true }), true);
  assert.equal(showsAccountTools(1, { isStarter: false, known: false }), true);
  assert.equal(showsAccountTools('3', { isStarter: false, known: true }), true, 'TheBodyPolitik on Teams');
  assert.equal(showsAccountTools(3, { isStarter: false, known: true }), true);
  assert.equal(showsAccountTools('3', { isStarter: true, known: true }), false, 'a Starter self sign-up, as before');
  assert.equal(showsAccountTools('3', { isStarter: false, known: false }), false, 'not before the server answered');
  assert.equal(showsAccountTools(undefined, { isStarter: true, known: true }), true);
});

// Review (5 Nov): MemoriesPage's "Trial Ended" picker (non-closable, paid plans only) was a second trap: it ignored the
// property view and coverage, and a failed storage-overview (e.g. 429) read as "starter".
const owned = (extra = {}) => [{ id: 41, trial_ended: false, ...extra }];
test('Trial Ended picker: a Starter self sign-up owning properties, or an ended property trial, in its own view', () => {
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter'), viewType: 'personal', role: '3', ownedProperties: owned() }), true);
  assert.equal(trialEndedPicker({ storageOverview: overview('starter'), viewType: 'personal', role: '2', ownedProperties: owned({ trial_ended: true }) }), true);
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter'), viewType: 'personal', role: '2', ownedProperties: owned() }), false);
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter'), viewType: 'personal', role: '3', ownedProperties: [] }), false);
});
test('Trial Ended picker: never on a paid plan, a covered account, a property view or an unknown plan', () => {
  assert.equal(trialEndedPicker({ storageOverview: overview('Business'), viewType: 'personal', role: '3', ownedProperties: owned({ trial_ended: true }) }), false);
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter', { id: 959, name: 'Serpa' }), viewType: 'personal', role: '3', ownedProperties: owned() }), false);
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter'), viewType: 'property', role: '3', ownedProperties: owned() }), false);
  assert.equal(trialEndedPicker({ storageOverview: null, viewType: 'personal', role: '3', ownedProperties: owned({ trial_ended: true }) }), false, 'storage-overview failed (429)');
  assert.equal(trialEndedPicker({ storageOverview: {}, viewType: 'personal', role: '3', ownedProperties: owned() }), false, 'no plan_name');
});
test('phone bottom bar: Dashboard / Apps follow the sidebar (never in a property view)', () => {
  assert.equal(phoneBarShowsAccountTools('personal', true), true);
  assert.equal(phoneBarShowsAccountTools('personal', false), false);
  assert.equal(phoneBarShowsAccountTools('property', true), false);
});

// Release fixes (5 Nov): the Trial Ended picker offers Starter too (it is the account's own choice); once the account
// chose Starter there, it isn't asked again.
test('Trial Ended picker: not again once the account chose Starter there', () => {
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter'), viewType: 'personal', role: '3', ownedProperties: owned({ trial_ended: true }), starterChosen: true }), false);
  assert.equal(trialEndedPicker({ storageOverview: overview('Starter'), viewType: 'personal', role: '3', ownedProperties: owned({ trial_ended: true }), starterChosen: false }), true);
});
