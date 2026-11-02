// Users page tabs "All Users | Shared with | External | Properties": each tab's count, shown as on the Leads page tabs
// (plain number text, no pill). A list that has not loaded yet is null, and its tab shows no number (never a "0" that
// then jumps).
//   users       the users list (the "N of N users" / Total Users count)
//   sharedWith  the Shared with campaigns (its "N campaigns" count)
//   properties  GET /properties, split by account_type as the External and Properties tabs list it (utils/propertyRows)
import { rowsForPropertyTab, type PropertyRow } from './propertyRows.ts';

export type UsersTabCounts = {
  users: number | null;
  sharedWith: number | null;
  external: number | null;
  properties: number | null;
};

export function usersTabCounts<T>(
  lists: { users: unknown[] | null; sharedWith: unknown[] | null; properties: T[] | null },
  apiRowOf?: (row: T) => PropertyRow,
): UsersTabCounts {
  const count = (list: unknown[] | null) => (Array.isArray(list) ? list.length : null);
  const { properties } = lists;
  return {
    users: count(lists.users),
    sharedWith: count(lists.sharedWith),
    external: Array.isArray(properties) ? rowsForPropertyTab(properties, 'external', apiRowOf).length : null,
    properties: Array.isArray(properties) ? rowsForPropertyTab(properties, 'properties', apiRowOf).length : null,
  };
}
