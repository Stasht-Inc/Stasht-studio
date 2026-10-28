import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGNS_VIEW_OPTIONS, DEFAULT_CAMPAIGNS_VIEW, NEWSLETTERS_CHANGED_EVENT, NEWSLETTER_FILTERS } from '../../components/newsletters/lib/campaignsView.ts';

test('the Campaigns page opens on Storeels, with Newsletters beside it', () => {
  // The default; the choice is then remembered per device (readCampaignsView).
  assert.equal(DEFAULT_CAMPAIGNS_VIEW, 'storeels');
  assert.deepEqual(CAMPAIGNS_VIEW_OPTIONS.map((o) => o.label), ['Storeels', 'Newsletters']);
  assert.equal(NEWSLETTERS_CHANGED_EVENT, 'stasht-newsletters-changed');
});

test('the Newsletters list filters by the statuses the API takes', () => {
  assert.deepEqual(NEWSLETTER_FILTERS.map((o) => [o.value, o.label]), [['all', 'All'], ['draft', 'Drafts'], ['scheduled', 'Scheduled'], ['sent', 'Sent']]);
});

test('openNewsletterResults leaves the id for the Campaigns page to take once', async () => {
  const { openNewsletterResults, takePendingNewsletterResults } = await import('../../components/newsletters/lib/campaignsView.ts');
  assert.equal(takePendingNewsletterResults(), null);
  openNewsletterResults(42); // no window in node: just remembers it
  assert.equal(takePendingNewsletterResults(), 42);
  assert.equal(takePendingNewsletterResults(), null);
});

// [wdy2xh2t3y] Storeels | Newsletters is remembered on this device. Reading it never calls the API, and the
// Newsletters view itself waits for a known paid plan; a Starter account goes back to Storeels.
test('the Storeels | Newsletters choice is remembered per device, safely', async () => {
  const { CAMPAIGNS_VIEW_KEY, readCampaignsView, writeCampaignsView, campaignsViewForPlan } = await import('../../components/newsletters/lib/campaignsView.ts');
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  assert.equal(readCampaignsView(storage), 'storeels', 'nothing saved yet');
  writeCampaignsView(storage, 'newsletters');
  assert.equal(store.get(CAMPAIGNS_VIEW_KEY), 'newsletters');
  assert.equal(readCampaignsView(storage), 'newsletters');
  store.set(CAMPAIGNS_VIEW_KEY, 'something-else');
  assert.equal(readCampaignsView(storage), 'storeels', 'an unknown value is ignored');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readCampaignsView(broken), 'storeels', 'blocked storage falls back');
  assert.doesNotThrow(() => writeCampaignsView(broken, 'newsletters'));
  assert.equal(readCampaignsView(null), 'storeels');
  // A remembered Newsletters choice only stands on a paid plan.
  assert.equal(campaignsViewForPlan('newsletters', { known: true, isStarter: true }), 'storeels');
  assert.equal(campaignsViewForPlan('newsletters', { known: true, isStarter: false }), 'newsletters');
  assert.equal(campaignsViewForPlan('newsletters', { known: false, isStarter: false }), 'newsletters', 'waits (the view makes no call until the plan is known)');
  assert.equal(campaignsViewForPlan('storeels', { known: true, isStarter: false }), 'storeels');
});

test('openNewsletterDraft leaves the draft to highlight for the Campaigns page to take once', async () => {
  const { openNewsletterDraft, takePendingNewsletterHighlight, DRAFT_SAVED_MESSAGE } = await import('../../components/newsletters/lib/campaignsView.ts');
  assert.equal(takePendingNewsletterHighlight(), null);
  openNewsletterDraft(77);
  assert.equal(takePendingNewsletterHighlight(), 77);
  assert.equal(takePendingNewsletterHighlight(), null);
  assert.equal(DRAFT_SAVED_MESSAGE, 'Draft saved. Find it in Campaigns › Newsletters.');
});

test('a highlighted newsletter goes to the top of the list', async () => {
  const { withHighlightFirst } = await import('../../components/newsletters/lib/campaignsView.ts');
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(withHighlightFirst(rows, 3).map((r) => r.id), [3, 1, 2]);
  assert.equal(withHighlightFirst(rows, null), rows);
  assert.equal(withHighlightFirst(rows, 9), rows);
});

// Review fix: a failed plan check never leaves a remembered Newsletters view loading forever.
test('campaignsViewForPlan goes back to Storeels when the plan check failed', async () => {
  const { campaignsViewForPlan } = await import('../../components/newsletters/lib/campaignsView.ts');
  assert.equal(campaignsViewForPlan('newsletters', { known: false, isStarter: false, failed: true }), 'storeels');
  assert.equal(campaignsViewForPlan('newsletters', { known: false, isStarter: false, failed: false }), 'newsletters');
});
