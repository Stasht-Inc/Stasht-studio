import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGNS_VIEW_OPTIONS, DEFAULT_CAMPAIGNS_VIEW, NEWSLETTERS_CHANGED_EVENT, NEWSLETTER_FILTERS } from '../../components/newsletters/lib/campaignsView.ts';

test('the Campaigns page opens on Storeels, with Newsletters beside it', () => {
  // Never remembered: opening on Newsletters would call newsletter endpoints on page load (contract note 1).
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
