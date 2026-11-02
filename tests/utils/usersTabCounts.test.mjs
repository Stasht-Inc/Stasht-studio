// tests/utils/usersTabCounts.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Users page tabs "All Users | Shared with | External | Properties" show each tab's count as on the Leads page tabs,
// and no number until that tab's data has loaded (null).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { usersTabCounts } from '../../utils/usersTabCounts.ts';

const page = (row) => ({ apiRow: row }); // UsersPage keeps the API row in apiRow
const apiRowOf = (p) => p.apiRow;

test('nothing loaded yet: no number on any tab', () => {
  assert.deepEqual(usersTabCounts({ users: null, sharedWith: null, properties: null }, apiRowOf), {
    users: null, sharedWith: null, external: null, properties: null,
  });
});

test('each count is its own list: users, shared-with campaigns, external rows, internal properties', () => {
  const properties = [
    page({ id: 1, account_type: 'internal' }),
    page({ id: 2, account_type: 'external' }),
    page({ id: 3, account_type: 'external' }),
    page({ id: 4 }), // older row without account_type: a Properties row, as the Properties tab lists it
    page({ id: 5, account_type: 'EXTERNAL' }),
  ];
  assert.deepEqual(usersTabCounts({ users: [{}, {}, {}], sharedWith: [{}], properties }, apiRowOf), {
    users: 3, sharedWith: 1, external: 3, properties: 2,
  });
});

test('loaded and empty is 0, not "no number"', () => {
  assert.deepEqual(usersTabCounts({ users: [], sharedWith: [], properties: [] }, apiRowOf), {
    users: 0, sharedWith: 0, external: 0, properties: 0,
  });
});

test('each tab waits only for its own data', () => {
  assert.deepEqual(usersTabCounts({ users: [{}, {}], sharedWith: null, properties: null }, apiRowOf), {
    users: 2, sharedWith: null, external: null, properties: null,
  });
  assert.deepEqual(usersTabCounts({ users: null, sharedWith: null, properties: [page({ account_type: 'external' })] }, apiRowOf), {
    users: null, sharedWith: null, external: 1, properties: 0,
  });
});

test('the external / properties counts match the External and Properties tabs (same split as rowsForPropertyTab)', async () => {
  const { rowsForPropertyTab } = await import('../../utils/propertyRows.ts');
  const rows = [{ account_type: 'external' }, { account_type: 'internal' }, { account_type: null }, { account_type: 'external', is_creator: true }];
  const counts = usersTabCounts({ users: [], sharedWith: [], properties: rows });
  assert.equal(counts.external, rowsForPropertyTab(rows, 'external').length);
  assert.equal(counts.properties, rowsForPropertyTab(rows, 'properties').length);
  assert.equal(counts.external, 2, "the viewer's own external row stays counted, as the External tab lists it");
});
