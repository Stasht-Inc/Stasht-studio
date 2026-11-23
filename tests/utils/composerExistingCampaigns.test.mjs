// tests/utils/composerExistingCampaigns.test.mjs — node --test. "+ Campaign" = the account's existing campaigns
// (Chris 23 Nov 2026, G): "Title: link" lines into the box, and which one the server tracks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existingCampaignsText, trackedCampaignId } from '../../utils/composerCampaign.ts';

const a = { id: 701, title: 'Products for you', url: 'https://studio.stasht.com/published-memory/products-for-you-6b0' };
const b = { id: 703, title: '  Just 4 U -\n Jeremy ', url: 'https://studio.stasht.com/published-memory/just-4-u?viewonly=1' };

test('one "Title: link" line per campaign, titles on one line', () => {
  assert.equal(existingCampaignsText([a]), `Products for you: ${a.url}`);
  assert.equal(existingCampaignsText([a, b]), `Products for you: ${a.url}\nJust 4 U - Jeremy: ${b.url}`);
});

test('a campaign without a web link is left out; a blank title shows the link alone', () => {
  assert.equal(existingCampaignsText([{ id: 1, title: 'Draft', url: '' }, { id: 2, title: 'x', url: 'javascript:alert(1)' }]), '');
  assert.equal(existingCampaignsText([{ ...a, title: '  ' }]), a.url);
});

test('the tracked campaign is the first picked one whose link is still in the box', () => {
  assert.equal(trackedCampaignId(`Hi\n${existingCampaignsText([a, b])}`, [a, b]), 701);
  assert.equal(trackedCampaignId(`Hi\nJust 4 U: ${b.url}`, [a, b]), 703);
  assert.equal(trackedCampaignId('Hi, the links were deleted', [a, b]), null);
  assert.equal(trackedCampaignId('anything', []), null);
});
