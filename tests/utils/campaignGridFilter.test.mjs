// tests/utils/campaignGridFilter.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Bug (real local E2E, 9 Nov 2026): once a campaign is published, the API files its card under the virtual
// "Published" category. An account with no "Published" row in the sidebar (the sidebar's auto-expand keeps only its
// own non-empty rows) then lost that campaign from the Storeels "All Campaigns" grid and its "N campaigns found"
// count. Collapsing a sidebar category may hide its campaigns; a category with no sidebar row can't be collapsed,
// so it never hides anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignSidebarBucket, hiddenByCollapsedCategory } from '../../utils/campaignGridFilter.ts';

const own = (id, category, extra = {}) => ({ id, title: `Campaign ${id}`, category: { name: category }, ...extra });
const published = own(12888, 'Published', { published: 1 });
const unpublished = [own(12889, 'Personal'), own(12890, 'Personal'), own(12891, 'Personal')];

test('the E2E account: a published campaign stays in All Campaigns next to the unpublished ones, exactly once', () => {
  // GET /memories: 4 campaigns, the published one under "Published"; sidebar rows: Personal (3) only.
  const sidebar = ['Personal'];
  const expanded = ['Personal']; // the sidebar's auto-expand: non-empty rows only
  const shown = [published, ...unpublished].filter((m) => !hiddenByCollapsedCategory(m, expanded, sidebar));
  assert.deepEqual(shown.map((m) => m.id), [12888, 12889, 12890, 12891]);
  assert.equal(shown.length, 4, '"4 campaigns found", not 3');
});

test('an account that has a "Published" row: expanded shows it, collapsed by the user hides it (unchanged)', () => {
  const sidebar = ['Personal', 'Published'];
  assert.equal(hiddenByCollapsedCategory(published, ['Personal', 'Published'], sidebar), false);
  assert.equal(hiddenByCollapsedCategory(published, ['Personal'], sidebar), true, 'the user collapsed Published');
  assert.equal(hiddenByCollapsedCategory(unpublished[0], ['Published'], sidebar), true, 'the user collapsed Personal');
  assert.equal(hiddenByCollapsedCategory(unpublished[0], ['Personal', 'Published'], sidebar), false);
});

test('nothing expanded means no sidebar filter at all (unchanged)', () => {
  assert.equal(hiddenByCollapsedCategory(published, [], ['Personal']), false);
  assert.equal(hiddenByCollapsedCategory(unpublished[0], [], ['Personal']), false);
});

test('shared campaigns belong to "Shared With", whatever their own category', () => {
  const shared = own(5, 'Cars Lot', { isShared: true });
  assert.equal(campaignSidebarBucket(shared), 'Shared With');
  assert.equal(hiddenByCollapsedCategory(shared, ['Personal', 'Shared With'], ['Personal', 'Shared With']), false);
  assert.equal(hiddenByCollapsedCategory(shared, ['Personal'], ['Personal', 'Shared With']), true, 'Shared With collapsed');
  assert.equal(hiddenByCollapsedCategory(shared, ['Personal'], ['Personal']), false, 'no Shared With row: nothing to collapse');
});

test('the bucket falls back to the property category, then to no category', () => {
  assert.equal(campaignSidebarBucket({ property_category: { name: 'Listings' } }), 'Listings');
  assert.equal(campaignSidebarBucket({ category: { name: 'Personal' }, property_category: { name: 'Listings' } }), 'Personal');
  assert.equal(campaignSidebarBucket({}), '');
  assert.equal(hiddenByCollapsedCategory({ property_category: { name: 'Listings' } }, ['Other'], ['Listings', 'Other']), true);
  assert.equal(hiddenByCollapsedCategory({ property_category: { name: 'Listings' } }, ['Listings'], ['Listings', 'Other']), false);
});

test('odd input never throws', () => {
  assert.equal(hiddenByCollapsedCategory(published, undefined, undefined), false);
  assert.equal(hiddenByCollapsedCategory(null, ['Personal'], ['Personal']), false);
});
