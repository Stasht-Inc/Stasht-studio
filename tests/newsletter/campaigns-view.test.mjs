import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGNS_VIEW_OPTIONS, DEFAULT_CAMPAIGNS_VIEW, NEWSLETTERS_CHANGED_EVENT, NEWSLETTER_FILTERS } from '../../components/newsletters/lib/campaignsView.ts';

test('the Campaigns page opens on Newsletters first (Create Campaign opens on Newsletter), Storeels beside it', () => {
  // The default; the choice is then remembered per device (readCampaignsView). A Starter plan still lands on Storeels.
  assert.equal(DEFAULT_CAMPAIGNS_VIEW, 'newsletters');
  assert.deepEqual(CAMPAIGNS_VIEW_OPTIONS.map((o) => o.label), ['Newsletters', 'Storeels']);
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
  assert.equal(readCampaignsView(storage), 'newsletters', 'nothing saved yet');
  writeCampaignsView(storage, 'storeels');
  assert.equal(store.get(CAMPAIGNS_VIEW_KEY), 'storeels');
  assert.equal(readCampaignsView(storage), 'storeels');
  store.set(CAMPAIGNS_VIEW_KEY, 'something-else');
  assert.equal(readCampaignsView(storage), 'newsletters', 'an unknown value is ignored');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readCampaignsView(broken), 'newsletters', 'blocked storage falls back');
  assert.doesNotThrow(() => writeCampaignsView(broken, 'newsletters'));
  assert.equal(readCampaignsView(null), 'newsletters');
  // Fresh device on a Starter plan: Storeels.
  assert.equal(campaignsViewForPlan(readCampaignsView(null), { known: true, isStarter: true }), 'storeels');
  // A remembered Newsletters choice only stands on a paid plan.
  assert.equal(campaignsViewForPlan('newsletters', { known: true, isStarter: true }), 'storeels');
  assert.equal(campaignsViewForPlan('newsletters', { known: true, isStarter: false }), 'newsletters');
  assert.equal(campaignsViewForPlan('newsletters', { known: false, isStarter: false }), 'newsletters', 'waits (the view makes no call until the plan is known)');
  assert.equal(campaignsViewForPlan('storeels', { known: true, isStarter: false }), 'storeels');
  assert.equal(campaignsViewForPlan('newsletters', { known: false, isStarter: true }), 'storeels', 'stored role says Starter: no loading flash');
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

test('switch counts: a number beside each option, nothing while unknown', async () => {
  const { switchCountLabel } = await import('../../components/newsletters/lib/campaignsView.ts');
  assert.equal(switchCountLabel(0), '0');
  assert.equal(switchCountLabel(7), '7');
  assert.equal(switchCountLabel(1234), '999+');
  assert.equal(switchCountLabel(null), null);
  assert.equal(switchCountLabel(undefined), null);
  assert.equal(switchCountLabel(-1), null);
});
