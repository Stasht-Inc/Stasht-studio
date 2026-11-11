// tests/utils/leadsAssignedFilter.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris 11 Nov 2026: "Assigned to: Anyone" = only assigned leads, "Unassigned" = the rest, new "All leads" = everything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignedParams, leadingAssignedOptions, TEAM_ALL, ALL_LEADS } from '../../utils/leadsAssignedFilter.ts';

const owner = null;
const fullAdmin = { staff: true, can_see_all: true, scope: 'mine_and_new' };
const partial = { staff: true, can_see_all: false, scope: 'mine_and_new' };

test('default asks the server for its default (Anyone for owners, Me + new for staff)', () => {
  for (const t of [owner, fullAdmin, partial]) assert.deepEqual(assignedParams('all', t), { assigned: 'default' });
});

test('All leads = no filter for owners, team=all for full Admins, never widens a Partial Admin', () => {
  assert.deepEqual(assignedParams(ALL_LEADS, owner), {});
  assert.deepEqual(assignedParams(ALL_LEADS, fullAdmin), { team: 'all' });
  assert.deepEqual(assignedParams(ALL_LEADS, partial), {});
});

test("a full Admin's Anyone is oversight of assigned leads only", () => {
  assert.deepEqual(assignedParams(TEAM_ALL, fullAdmin), { team: 'all', assigned: 'any' });
});

test('me / unassigned / teammate unchanged', () => {
  assert.deepEqual(assignedParams('me', owner), { assigned: 'me' });
  assert.deepEqual(assignedParams('unassigned', owner), { assigned: 'unassigned' });
  assert.deepEqual(assignedParams('42', owner), { assigned: 42 });
});

test('options: owner Anyone + All leads; full Admin Me + new, Anyone, All leads; Partial Admin Me + new only', () => {
  assert.deepEqual(leadingAssignedOptions(owner).map((o) => o.label), ['Assigned to: Anyone', 'All leads']);
  assert.deepEqual(leadingAssignedOptions(fullAdmin).map((o) => o.label), ['Assigned to: Me + new', 'Assigned to: Anyone', 'All leads']);
  assert.deepEqual(leadingAssignedOptions(partial, true).map((o) => o.label), ['Me + new']);
  assert.deepEqual(leadingAssignedOptions(owner, true).map((o) => o.value), ['all', ALL_LEADS]);
});
