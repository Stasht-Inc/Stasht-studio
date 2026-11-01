// Batch 3 (Chris, 1 Nov): the Newsletters list was clipped at about 1280 px wide. App's two sidebars leave the
// Campaigns page only about 650 px there, and the columns were sized by the window, not by the room the list has.
// The layout now follows the list's own width: every column (name, Edit, ⋯) always fits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEWSLETTERS_TABLE, newslettersLayout, opensRow } from '../../components/newsletters/lib/newsletterList.ts';

test('the list picks its layout from its own width', () => {
  assert.equal(newslettersLayout(360), 'cards', 'phones: the card rows');
  assert.equal(newslettersLayout(599), 'cards');
  assert.equal(newslettersLayout(600), 'table');
  assert.equal(newslettersLayout(648), 'table', 'both sidebars open at 1280 (main column 648 px): the table, When under Status');
  assert.equal(newslettersLayout(991), 'table');
  assert.equal(newslettersLayout(992), 'wide', 'room for a When column and Edit with its word');
  assert.equal(newslettersLayout(1400), 'wide');
  assert.equal(newslettersLayout(0), 'wide', 'not measured yet: today’s desktop look until the first measure');
});

// The narrowest width each layout is used at must hold its columns' minimum widths with the name column at least
// as wide as asked, so nothing overlaps or runs past the right edge.
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
for (const layout of ['table', 'wide']) {
  test(`${layout}: the columns fit the narrowest width it is used at`, () => {
    const t = NEWSLETTERS_TABLE[layout];
    const needed = t.paddingX * 2 + t.gap * (t.minColumns.length - 1) + sum(t.minColumns);
    assert.ok(needed <= t.from, `${layout} needs ${needed}px but is used from ${t.from}px`);
    assert.ok(t.minColumns[0] >= 140, 'the name column keeps at least 140 px');
  });
}

test('a click on the row opens it, but not one on its buttons or from its menu', () => {
  // Fake DOM nodes: contains() for the row, closest() for the clicked element.
  const row = { id: 'row' };
  const node = (inside, interactive) => ({
    closest: (sel) => (interactive && /button/.test(sel) ? { tag: 'button' } : null),
    inside,
  });
  const ctx = (target, selection = '') => ({ row, target, contains: (t) => t.inside, selection });
  assert.equal(opensRow(ctx(node(true, false))), true, 'a cell');
  assert.equal(opensRow(ctx(node(true, true))), false, 'Edit, ⋯ or the name button handle their own click');
  assert.equal(opensRow(ctx(node(false, false))), false, 'the ⋯ menu is portalled: its clicks bubble through React but are not in the row');
  assert.equal(opensRow(ctx(node(true, false), 'October')), false, 'selecting text is not a click');
});
