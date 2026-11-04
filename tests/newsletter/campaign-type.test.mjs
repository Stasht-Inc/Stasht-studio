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

// Chris, 4 Nov 2026: with the Campaigns page on Storeels, "+ Create a Campaign" opened the newsletter composer —
// Create Campaign always opened on its Newsletter tab. It now follows the Storeels | Newsletters view showing.
test('Create a Campaign follows the Campaigns page view: Storeels → Storeel, Newsletters → Newsletter', async () => {
  const { campaignTypeForView, initialCampaignType } = await import('../../components/newsletters/lib/campaignType.ts');
  assert.equal(campaignTypeForView('storeels'), 'storeel');
  assert.equal(campaignTypeForView('newsletters'), 'newsletter');
  assert.equal(campaignTypeForView(undefined), undefined, 'not from the Campaigns page: the old default applies');
  assert.equal(campaignTypeForView(null), undefined);
  assert.equal(initialCampaignType({ preferred: 'storeel' }), 'storeel', 'Storeels view → the Storeel tab');
  assert.equal(initialCampaignType({ preferred: 'newsletter' }), 'newsletter');
  assert.equal(initialCampaignType({ preferred: undefined }), 'newsletter', 'no view: Newsletter as before');
});

test('the view never overrides an explicit start: a newsletter being edited, a category, photos', async () => {
  const { initialCampaignType } = await import('../../components/newsletters/lib/campaignType.ts');
  assert.equal(initialCampaignType({ preferred: 'storeel', newsletterId: 9 }), 'newsletter', 'editing a newsletter');
  assert.equal(initialCampaignType({ preferred: 'newsletter', defaultCategory: 'Cars' }), 'storeel', 'a category picked');
  assert.equal(initialCampaignType({ preferred: 'newsletter', photoCount: 2 }), 'storeel', 'photos passed in');
  assert.equal(initialCampaignType({ preferred: 'newsletter', mediaCount: 1 }), 'storeel', 'media chosen');
});

test('Starter on the Storeels view opens Storeel (the view wins over STARTER_DEFAULT_CAMPAIGN_TYPE)', async () => {
  const { initialCampaignType } = await import('../../components/newsletters/lib/campaignType.ts');
  assert.equal(initialCampaignType({ preferred: 'storeel', isStarter: true }), 'storeel');
});

test('the "create a category first" gate follows: a property account with no category is sent to make one from Storeels', async () => {
  const { campaignTypeForView, initialCampaignType, needsCategoryFirst } = await import('../../components/newsletters/lib/campaignType.ts');
  const opensOn = initialCampaignType({ preferred: campaignTypeForView('storeels') });
  assert.equal(needsCategoryFirst({ viewType: 'property', ownedCategories: 0, opensOn }), true);
  const fromNewsletters = initialCampaignType({ preferred: campaignTypeForView('newsletters') });
  assert.equal(needsCategoryFirst({ viewType: 'property', ownedCategories: 0, opensOn: fromNewsletters }), false);
});
