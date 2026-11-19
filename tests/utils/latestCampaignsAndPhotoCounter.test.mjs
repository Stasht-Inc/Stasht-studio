// tests/utils/latestCampaignsAndPhotoCounter.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 19 Nov 2026: point 18 (Latest Campaigns "Last Visited" sorts by its real time) and point 19 (no "1 of 1"
// photo counter on a single-photo moment).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lastVisitedTime, compareLastVisited } from '../../utils/latestCampaigns.ts';
import { photoCounterLabel } from '../../utils/photoCounter.ts';

test('Last Visited time is the campaign updated_at (then created_at, invited_at), 0 when unknown', () => {
  assert.equal(lastVisitedTime({ updated_at: '2026-11-19T10:00:00Z', created_at: '2025-01-01T00:00:00Z' }), Date.parse('2026-11-19T10:00:00Z'));
  assert.equal(lastVisitedTime({ updated_at: null, created_at: '2025-01-01T00:00:00Z' }), Date.parse('2025-01-01T00:00:00Z'));
  assert.equal(lastVisitedTime({ invited_at: '2026-07-11T00:00:00Z' }), Date.parse('2026-07-11T00:00:00Z'));
  assert.equal(lastVisitedTime({ updated_at: 'not a date' }), 0);
  assert.equal(lastVisitedTime(null), 0);
});

test('sorting by Last Visited uses the time, not the "3 months ago" text', () => {
  const rows = [
    { title: 'Zoo Day', lastVisited: '4 months ago', lastVisitedAt: Date.parse('2026-07-20T00:00:00Z') },
    { title: 'Creamed Spinach', lastVisited: '2 hours ago', lastVisitedAt: Date.parse('2026-11-19T08:00:00Z') },
    { title: 'Remembering Addy', lastVisited: '3 months ago', lastVisitedAt: Date.parse('2026-08-01T00:00:00Z') },
  ];
  assert.deepEqual([...rows].sort((a, b) => compareLastVisited(a, b, 'desc')).map((r) => r.title), ['Creamed Spinach', 'Remembering Addy', 'Zoo Day']);
  assert.deepEqual([...rows].sort((a, b) => compareLastVisited(a, b, 'asc')).map((r) => r.title), ['Zoo Day', 'Remembering Addy', 'Creamed Spinach']);
});

test('photo counter only for 2+ photos', () => {
  assert.equal(photoCounterLabel(1, 1), null);
  assert.equal(photoCounterLabel(1, 0), null);
  assert.equal(photoCounterLabel(1, 2), 'Image 1 of 2');
  assert.equal(photoCounterLabel(3, 3, ''), '3 of 3');
  assert.equal(photoCounterLabel(9, 3), 'Image 3 of 3');
  assert.equal(photoCounterLabel(0, 3), 'Image 1 of 3');
});
