// tests/utils/leadsAssignedFilter.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris 11 Nov 2026 (d): "Assigned to" is a multi-select (choices unioned). Default Anyone + Open for owners and anyone
// switched in, Me + Open for staff; no "Assigned to:" prefix on the label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignedParams, assignedOptions, assignedLabel, toggleAssigned, ticksOf, offersAllLeads, DEFAULT, ALL_LEADS, ANY, OPEN,
} from '../../utils/leadsAssignedFilter.ts';

const owner = null;
const fullAdmin = { staff: true, can_see_all: true, scope: 'mine_and_new' };
const partial = { staff: true, can_see_all: false, scope: 'mine_and_new' };
const mates = [{ id: 7, name: 'Brenna' }, { id: 9, name: 'Lindsay H' }];

test('default asks the server for its default; labels without "Assigned to"', () => {
  for (const t of [owner, fullAdmin, partial]) assert.deepEqual(assignedParams(DEFAULT, t), { assigned: 'default' });
  assert.equal(assignedLabel(DEFAULT, owner, assignedOptions(owner, mates)), 'Anyone, Open');
  assert.equal(assignedLabel(DEFAULT, fullAdmin, assignedOptions(fullAdmin)), 'Me, Open');
  assert.equal(assignedLabel(DEFAULT, partial, assignedOptions(partial)), 'Me, Open');
  assert.deepEqual(ticksOf(DEFAULT, owner, assignedOptions(owner)), [ANY, OPEN]);
});

test('options: Partial Admins get no Anyone and no All leads', () => {
  assert.deepEqual(assignedOptions(owner, mates).map((o) => o.label), ['Anyone', 'Open', 'Me', 'Unassigned', 'Brenna', 'Lindsay H']);
  assert.deepEqual(assignedOptions(partial).map((o) => o.label), ['Open', 'Me', 'Unassigned']);
  assert.equal(offersAllLeads(owner), true);
  assert.equal(offersAllLeads(fullAdmin), true);
  assert.equal(offersAllLeads(partial), false);
});

test('ticking unions; back to the default ticks = default; never empty', () => {
  const opts = assignedOptions(owner, mates);
  const v1 = toggleAssigned(DEFAULT, 'unassigned', owner, opts);
  assert.equal(v1, 'any,open,unassigned');
  assert.equal(assignedLabel(v1, owner, opts), '3 selected');
  assert.deepEqual(assignedParams(v1, owner), { assigned: 'any,open,unassigned' });
  assert.equal(toggleAssigned(v1, 'unassigned', owner, opts), DEFAULT);
  const v2 = toggleAssigned(DEFAULT, ANY, owner, opts);
  assert.equal(v2, 'open');
  assert.equal(toggleAssigned(v2, OPEN, owner, opts), 'open', 'the last tick cannot be removed');
  assert.equal(assignedLabel(toggleAssigned(v2, '7', owner, opts), owner, opts), 'Open, Brenna');
});

test('All leads ticks everything; ticking every choice is All leads; unticking one leaves the rest', () => {
  const opts = assignedOptions(owner, mates);
  assert.equal(toggleAssigned(DEFAULT, ALL_LEADS, owner, opts), ALL_LEADS);
  assert.equal(assignedLabel(ALL_LEADS, owner, opts), 'All leads');
  assert.equal(ticksOf(ALL_LEADS, owner, opts).length, opts.length);
  assert.equal(toggleAssigned(ALL_LEADS, ALL_LEADS, owner, opts), DEFAULT);
  assert.equal(toggleAssigned(ALL_LEADS, '9', owner, opts), 'any,open,me,unassigned,7');
  assert.equal(toggleAssigned('any,open,me,unassigned,7', '9', owner, opts), ALL_LEADS);
  assert.deepEqual(assignedParams(ALL_LEADS, owner), {});
  assert.deepEqual(assignedParams(ALL_LEADS, fullAdmin), { team: 'all' });
  assert.deepEqual(assignedParams(ALL_LEADS, partial), { assigned: 'default' }, 'never widens a Partial Admin');
});

test('full Admins look across the team (team=all); Partial Admins never send it', () => {
  assert.deepEqual(assignedParams('any,open', fullAdmin), { team: 'all', assigned: 'any,open' });
  assert.deepEqual(assignedParams('me,unassigned', partial), { assigned: 'me,unassigned' });
  assert.deepEqual(assignedParams('42', owner), { assigned: '42' });
  assert.deepEqual(assignedParams('bogus', owner), { assigned: 'default' });
});
