import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialCampaignType } from '../../components/newsletters/lib/campaignType.ts';

test('Newsletter is the default tab', () => {
  assert.equal(initialCampaignType({}), 'newsletter');
  assert.equal(initialCampaignType({ newsletterId: null, defaultCategory: undefined, mediaCount: 0 }), 'newsletter');
});

test('Storeel when a category was picked or photos were chosen from the media library', () => {
  assert.equal(initialCampaignType({ defaultCategory: 'Cars' }), 'storeel');
  assert.equal(initialCampaignType({ mediaCount: 3 }), 'storeel');
});

test('opening a newsletter always shows the Newsletter tab', () => {
  assert.equal(initialCampaignType({ newsletterId: 12, defaultCategory: 'Cars', mediaCount: 2 }), 'newsletter');
});

test('Starter accounts open on STARTER_DEFAULT_CAMPAIGN_TYPE (Newsletter for now; Chris may flip it)', async () => {
  const { initialCampaignType, STARTER_DEFAULT_CAMPAIGN_TYPE } = await import('../../components/newsletters/lib/campaignType.ts');
  assert.equal(STARTER_DEFAULT_CAMPAIGN_TYPE, 'newsletter');
  assert.equal(initialCampaignType({ isStarter: true }), STARTER_DEFAULT_CAMPAIGN_TYPE);
  assert.equal(initialCampaignType({ isStarter: false }), 'newsletter');
  // An explicit choice still wins for Starter.
  assert.equal(initialCampaignType({ isStarter: true, defaultCategory: 'Service' }), 'storeel');
  assert.equal(initialCampaignType({ isStarter: true, newsletterId: 3 }), 'newsletter');
});

test('photos passed in (Scan Photo) open the Storeel tab', async () => {
  const { initialCampaignType } = await import('../../components/newsletters/lib/campaignType.ts');
  assert.equal(initialCampaignType({ photoCount: 1 }), 'storeel');
  assert.equal(initialCampaignType({ photoCount: 0 }), 'newsletter');
});

test('the "create a category first" gate only applies when Create Campaign opens on Storeel', async () => {
  const { needsCategoryFirst } = await import('../../components/newsletters/lib/campaignType.ts');
  assert.equal(needsCategoryFirst({ viewType: 'property', ownedCategories: 0, opensOn: 'newsletter' }), false);
  assert.equal(needsCategoryFirst({ viewType: 'property', ownedCategories: 0, opensOn: 'storeel' }), true);
  assert.equal(needsCategoryFirst({ viewType: 'property', ownedCategories: 2, opensOn: 'storeel' }), false);
  assert.equal(needsCategoryFirst({ viewType: 'personal', ownedCategories: 0, opensOn: 'storeel' }), false);
});
