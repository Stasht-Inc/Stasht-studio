// Chris, 29 Oct (round 2), items 4 and 5: the picker shows what is chosen at the top ("Chosen (3 of 6)", ✕ to
// remove each, across tabs and for picks not on the loaded page), and loads more as the list scrolls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chosenEntries, chosenHeading, mergeOptionRows, nextPageToLoad } from '../../components/newsletters/lib/pickerPaging.ts';

const row = (kind, id, title = `${kind} ${id}`) => ({ kind, id, title, description: '', cover_url: null, public_url: null, date: null, shareable: true, reason: null });
const item = (kind, id, title, cover_url = null) => ({ kind, id, title, description: '', cover_url, url: '', date: null, price_text: null, meta: null });

test('chosenHeading: "Chosen (N of 6)"', () => {
  assert.equal(chosenHeading(1), 'Chosen (1 of 6)');
  assert.equal(chosenHeading(6), 'Chosen (6 of 6)');
});

test('chosenEntries: every pick in picking order, from what was seen or the section’s own cards', () => {
  const seen = new Map([['product:881', item('product', 881, 'Brass lever handle', 'https://x.ca/a.jpg')]]);
  const known = [item('campaign', 601, 'Fall service event'), item('vehicle', 45, 'Old title')];
  const picks = [{ kind: 'vehicle', id: 45 }, { kind: 'product', id: 881 }, { kind: 'campaign', id: 601 }, { kind: 'product', id: 999 }];
  const out = chosenEntries(picks, seen, known);
  assert.deepEqual(out.map((e) => e.key), ['vehicle:45', 'product:881', 'campaign:601', 'product:999']);
  assert.deepEqual(out.map((e) => e.title), ['Old title', 'Brass lever handle', 'Fall service event', null]);
  assert.equal(out[1].cover, 'https://x.ca/a.jpg');
  // What was seen while the picker is open wins over the section's older card.
  const fresher = chosenEntries([{ kind: 'vehicle', id: 45 }], new Map([['vehicle:45', item('vehicle', 45, 'New title')]]), known);
  assert.equal(fresher[0].title, 'New title');
  // The same id in two kinds is two picks.
  assert.equal(chosenEntries([{ kind: 'campaign', id: 7 }, { kind: 'product', id: 7 }], new Map(), []).length, 2);
});

test('mergeOptionRows: a later page adds only rows not already listed (kind + id)', () => {
  const first = [row('product', 1), row('product', 2)];
  const merged = mergeOptionRows(first, [row('product', 2), row('product', 3), row('campaign', 1)]);
  assert.deepEqual(merged.map((r) => `${r.kind}:${r.id}`), ['product:1', 'product:2', 'product:3', 'campaign:1']);
  assert.deepEqual(mergeOptionRows(null, [row('product', 1), row('product', 1)]).map((r) => r.id), [1], 'no repeats inside one page either');
});

test('nextPageToLoad: the next page while there are more, nothing while loading, after an error or at the last page', () => {
  assert.equal(nextPageToLoad({ page: 1, totalPages: 3, loading: false, failed: false }), 2);
  assert.equal(nextPageToLoad({ page: 3, totalPages: 3, loading: false, failed: false }), null);
  assert.equal(nextPageToLoad({ page: 1, totalPages: 3, loading: true, failed: false }), null);
  assert.equal(nextPageToLoad({ page: 1, totalPages: 3, loading: false, failed: true }), null);
  assert.equal(nextPageToLoad({ page: 4, totalPages: 3, loading: false, failed: false }), null);
});
