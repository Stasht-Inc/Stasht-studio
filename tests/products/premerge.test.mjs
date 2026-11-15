// tests/products/premerge.test.mjs — pre-merge fixes (15 Nov): D3 Refresh banner wording, D1 External view status filter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshBannerCopy, filterStatusesFor } from '../../utils/products.ts';

const WEBSITE_ONE = {
  line: '1 item changed on your website since this campaign was made',
  button: 'Refresh', // post-live P3 (15 Nov): "catalogue" no longer appears here (was "Refresh from catalogue")
  title: 'Refresh from your website?',
};

test('D3: website items keep today\'s wording exactly (and an API without manual_pending is website-only)', () => {
  for (const s of [{ changed: 1, retired: 0 }, { changed: 1, retired: 0, manual_pending: 0 }]) {
    const c = refreshBannerCopy(s);
    assert.equal(c.line, WEBSITE_ONE.line);
    assert.equal(c.button, WEBSITE_ONE.button);
    assert.equal(c.title, WEBSITE_ONE.title);
    assert.equal(c.body, "1 moment will be updated with the latest photos, price and details from your website. Any changes you made to that moment's descriptions will be overwritten. Items no longer on your website are marked \"No longer available\" and their \"View on website\" button is hidden.");
    assert.equal(c.toast(1), 'Updated 1 moment from your website');
  }
  const many = refreshBannerCopy({ changed: 2, retired: 1 });
  assert.equal(many.line, '3 items changed on your website since this campaign was made');
  assert.equal(many.body, "3 moments will be updated with the latest photos, price and details from your website. Any changes you made to those moments' descriptions will be overwritten. Items no longer on your website are marked \"No longer available\" and their \"View on website\" button is hidden.");
  assert.equal(many.toast(3), 'Updated 3 moments from your website');
});

test('D3: manual products never say "on your website"', () => {
  const one = refreshBannerCopy({ changed: 1, retired: 0, manual_pending: 1 });
  assert.equal(one.line, '1 product changed since this campaign was made');
  assert.equal(one.button, 'Refresh');
  assert.equal(one.title, 'Refresh products?');
  assert.doesNotMatch(one.body, /website/);
  assert.equal(one.toast(1), 'Updated 1 moment from your products');
  const two = refreshBannerCopy({ changed: 1, retired: 1, manual_pending: 2 });
  assert.equal(two.line, '2 products changed since this campaign was made');
  assert.doesNotMatch(two.line + two.body, /website/);
});

test('D3: website items and manual products together', () => {
  const mixed = refreshBannerCopy({ changed: 3, retired: 0, manual_pending: 1 });
  assert.equal(mixed.line, '3 items changed since this campaign was made');
  assert.equal(mixed.button, 'Refresh');
  assert.match(mixed.body, /from your website and products/);
  assert.match(mixed.body, /"View on website" button is hidden/);
  assert.equal(mixed.toast(3), 'Updated 3 moments from your website and products');
});

test('D1: the External view offers only statuses its active-only list can match; the account keeps every one', () => {
  assert.deepEqual(filterStatusesFor(true), ['active', 'draft', 'out_of_stock', 'archived']);
  assert.deepEqual(filterStatusesFor(false), ['active', 'out_of_stock']);
});
