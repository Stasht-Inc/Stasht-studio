// tests/utils/leadsAssignedFilter.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris 11 Nov 2026: "Assigned to: Anyone" = only assigned leads, "Unassigned" = the rest, new "All leads" = everything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignedParams, leadingAssignedOptions, TEAM_ALL, ALL_LEADS, OPEN } from '../../utils/leadsAssignedFilter.ts';

const owner = null;
const fullAdmin = { staff: true, can_see_all: true, scope: 'mine_and_new' };
const partial = { staff: true, can_see_all: false, scope: 'mine_and_new' };

test('default asks the server for its default (Anyone for owners, Me + open for staff)', () => {
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

test('options: owner Anyone + All leads; full Admin Me + open, Anyone, All leads; Partial Admin Me + open only', () => {
  assert.deepEqual(leadingAssignedOptions(owner).map((o) => o.label), ['Assigned to: Anyone', 'Open', 'All leads']);
  assert.deepEqual(leadingAssignedOptions(fullAdmin).map((o) => o.label), ['Assigned to: Me + open', 'Open', 'Assigned to: Anyone', 'All leads']);
  assert.deepEqual(leadingAssignedOptions(partial, true).map((o) => o.label), ['Me + open', 'Open']);
  assert.deepEqual(leadingAssignedOptions(owner, true).map((o) => o.value), ['all', OPEN, ALL_LEADS]);
});

test('Open = waiting to be accepted; team=all only for staff who may see all', () => {
  assert.deepEqual(assignedParams(OPEN, owner), { assigned: 'open' });
  assert.deepEqual(assignedParams(OPEN, fullAdmin), { team: 'all', assigned: 'open' });
  assert.deepEqual(assignedParams(OPEN, partial), { assigned: 'open' });
});
