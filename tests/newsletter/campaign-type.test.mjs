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
