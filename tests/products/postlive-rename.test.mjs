// tests/products/postlive-rename.test.mjs — post-live P2+P3 (15 Nov): "Products" in place of "Website Catalogue".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryDisplayName, CATALOGUE_CATEGORY_NAME, refreshBannerCopy } from '../../utils/products.ts';

test('P2/P3: the stored "Website Catalogue" category is shown as Products; every other name is unchanged', () => {
  assert.equal(CATALOGUE_CATEGORY_NAME, 'Website Catalogue');
  assert.equal(categoryDisplayName('Website Catalogue'), 'Products');
  assert.equal(categoryDisplayName(' website catalogue '), 'Products');
  for (const n of ['Cars', 'Shopify', 'Personal', 'Website', 'Catalogue', '']) assert.equal(categoryDisplayName(n), n);
  assert.equal(categoryDisplayName(undefined), undefined);
});

test('P3: the website Refresh banner no longer says "catalogue"', () => {
  const c = refreshBannerCopy({ changed: 2, retired: 0 });
  assert.equal(c.button, 'Refresh');
  assert.equal(c.title, 'Refresh from your website?');
  assert.doesNotMatch(`${c.line} ${c.button} ${c.title} ${c.body}`, /catalog/i);
});
