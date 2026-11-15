// tests/products/postlive-rename.test.mjs — post-live P2+P3 (15 Nov): "Products" in place of "Website Catalogue".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignsWillAppear, categoryDisplayName, CATALOGUE_CATEGORY_NAME, noCampaignsTitle, refreshBannerCopy } from '../../utils/products.ts';

test('P2/P3 + review I2 (option A): the stored "Website Catalogue" category is shown as "Product campaigns"; every other name is unchanged', () => {
  assert.equal(CATALOGUE_CATEGORY_NAME, 'Website Catalogue');
  assert.equal(categoryDisplayName('Website Catalogue'), 'Product campaigns');
  assert.equal(categoryDisplayName(' website catalogue '), 'Product campaigns');
  for (const n of ['Cars', 'Shopify', 'Personal', 'Website', 'Catalogue', 'Products', '']) assert.equal(categoryDisplayName(n), n);
  assert.equal(categoryDisplayName(undefined), undefined);
});

test('P3: the website Refresh banner no longer says "catalogue"', () => {
  const c = refreshBannerCopy({ changed: 2, retired: 0 });
  assert.equal(c.button, 'Refresh');
  assert.equal(c.title, 'Refresh from your website?');
  assert.doesNotMatch(`${c.line} ${c.button} ${c.title} ${c.body}`, /catalog/i);
});

test('Empty states read naturally for the stored category, unchanged for every other one', () => {
  assert.equal(noCampaignsTitle('Website Catalogue'), 'No product campaigns yet');
  assert.equal(campaignsWillAppear('Website Catalogue', 'in'), 'Product campaigns will appear here.');
  assert.equal(campaignsWillAppear('Website Catalogue', 'your'), 'Your product campaigns will appear here.');
  assert.equal(noCampaignsTitle('Personal'), 'No personal campaigns');
  assert.equal(campaignsWillAppear('Cars', 'in'), 'Campaigns in Cars category will appear here.');
  assert.equal(campaignsWillAppear('Cars', 'your'), 'Your cars campaigns will appear here.');
});
