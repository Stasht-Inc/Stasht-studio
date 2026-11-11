// tests/utils/engagementMetric.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 11 Nov 2026: the Dashboard's User Engagement chart showed 0 ("Story Views") — it must show All campaigns, with
// a filter for Newsletters and Storeels. These are the filter's choices/labels and the chart's empty (zero) series.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGAGEMENT_METRICS, engagementMetricInfo, emptyEngagementSeries } from '../../utils/engagementMetric.ts';

test('the filter is All campaigns (default) / Newsletters / Storeels with matching legends', () => {
  assert.deepEqual(ENGAGEMENT_METRICS.map((m) => m.value), ['campaigns', 'newsletters', 'storeels']);
  assert.deepEqual(ENGAGEMENT_METRICS.map((m) => m.label), ['All campaigns', 'Newsletters', 'Storeels']);
  assert.equal(engagementMetricInfo('newsletters').legend, 'Newsletter opens');
  assert.equal(engagementMetricInfo('storeels').legend, 'Storeel views');
  assert.equal(engagementMetricInfo(undefined).legend, 'Campaign views');
  assert.equal(engagementMetricInfo('nonsense').value, 'campaigns');
});

test('the empty chart is zeros for each period, never made-up numbers', () => {
  const week = emptyEngagementSeries('weekly');
  assert.deepEqual(week.map((p) => p.day), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.equal(emptyEngagementSeries('daily').length, 24);
  assert.equal(emptyEngagementSeries('monthly', new Date(2026, 1, 10)).length, 28);
  assert.equal(emptyEngagementSeries('annually').length, 12);
  for (const period of ['daily', 'weekly', 'monthly', 'annually']) {
    assert.ok(emptyEngagementSeries(period).every((p) => p.views === 0), period);
  }
});
