// Chris, 7 Nov 2026 (point 12): Moderation per campaign in the Storeel page's Advanced filters. memories.
// moderation_enabled NULL = follow the account's setting; the page shows the campaign's effective value and saves an
// explicit one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountModerationFrom, shownModeration, moderationTabVisible } from '../../components/storeel/lib/moderation.ts';
import { seedFromMemory } from '../../components/storeel/lib/storeelFlow.ts';

test("the account's setting (GET notification preferences): on unless it says off; on when it can't be read", () => {
  assert.equal(accountModerationFrom({ success: true, data: { status: 1, data: { moderation_enabled: false } } }), false);
  assert.equal(accountModerationFrom({ success: true, data: { status: 1, data: { moderation_enabled: true } } }), true);
  assert.equal(accountModerationFrom({ success: true, data: { data: {} } }), true);
  assert.equal(accountModerationFrom({ success: false }), true);
  assert.equal(accountModerationFrom(null), true);
});

test('what the switch shows: the person’s choice, else the campaign’s, else the account’s, else on', () => {
  assert.equal(shownModeration({ choice: false, campaign: true, account: true }), false);
  assert.equal(shownModeration({ choice: null, campaign: false, account: true }), false);
  assert.equal(shownModeration({ choice: null, campaign: null, account: false }), false);
  assert.equal(shownModeration({ choice: null, campaign: null, account: null }), true);
});

test("Edit: the campaign's effective value from GET /memories/{id} (moderation_effective, else its own value)", () => {
  const seed = (memory) => seedFromMemory({ data: { memory: { id: 4, title: 'T', ...memory } } });
  assert.equal(seed({ moderation_enabled: null, moderation_effective: true }).moderation, true);
  assert.equal(seed({ moderation_enabled: false, moderation_effective: false }).moderation, false);
  assert.equal(seed({ moderation_enabled: 1 }).moderation, true, 'an API without moderation_effective: its own value');
  assert.equal(seed({}).moderation, null, 'an API before the column: unknown (the account decides)');
});

test("the campaign page's Moderation tab follows the campaign's effective value (role 2), as before otherwise", () => {
  assert.equal(moderationTabVisible({ role: '2', isOwner: true, loaded: true, campaign: false, account: true }), false);
  assert.equal(moderationTabVisible({ role: '2', isOwner: true, loaded: true, campaign: true, account: false }), true);
  assert.equal(moderationTabVisible({ role: '2', isOwner: true, loaded: true, campaign: null, account: true }), true);
  assert.equal(moderationTabVisible({ role: '2', isOwner: true, loaded: false, campaign: true, account: true }), false, 'waits for the account answer');
  assert.equal(moderationTabVisible({ role: '2', isOwner: false, loaded: true, campaign: true, account: true }), false);
  assert.equal(moderationTabVisible({ role: '1', isOwner: true, loaded: true, campaign: false, account: false }), true);
  assert.equal(moderationTabVisible({ role: '3', isOwner: true, loaded: true, campaign: true, account: true }), false);
});

test('review M1: the tab stays while items still wait for approval, even with moderation now off', () => {
  assert.equal(moderationTabVisible({ role: '2', isOwner: true, loaded: true, campaign: false, account: false, pending: 2 }), true);
  assert.equal(moderationTabVisible({ role: '2', isOwner: false, loaded: true, campaign: false, account: false, pending: 2 }), false);
});

test('review M2: the switch only where moderation applies (a business owner; property / salesperson views of one)', async () => {
  const { moderationSwitchShown } = await import('../../components/storeel/lib/moderation.ts');
  assert.equal(moderationSwitchShown({ campaignApplies: true, role: '1', viewType: 'personal' }), true, 'Edit: the API says');
  assert.equal(moderationSwitchShown({ campaignApplies: false, role: '2', viewType: 'personal' }), false, 'Edit: the API says');
  assert.equal(moderationSwitchShown({ campaignApplies: null, role: '2', viewType: 'personal' }), true);
  assert.equal(moderationSwitchShown({ campaignApplies: null, role: '1', viewType: 'property' }), true);
  assert.equal(moderationSwitchShown({ campaignApplies: null, role: '1', viewType: 'personal' }), false, 'a personal account: hidden');
  assert.equal(moderationSwitchShown({ campaignApplies: null, role: '3', viewType: 'personal' }), false);
});

test('review I1: the value is sent only when the switch was touched', async () => {
  const { moderationPayload } = await import('../../components/storeel/lib/moderation.ts');
  assert.deepEqual(moderationPayload(null), {});
  assert.deepEqual(moderationPayload(false), { moderation_enabled: false });
  assert.deepEqual(moderationPayload(true), { moderation_enabled: true });
});

test("Edit: whether moderation applies, from GET /memories/{id}'s moderation_applies", () => {
  const seed = (memory) => seedFromMemory({ data: { memory: { id: 4, title: 'T', ...memory } } });
  assert.equal(seed({ moderation_applies: false }).moderationApplies, false);
  assert.equal(seed({ moderation_applies: true }).moderationApplies, true);
  assert.equal(seed({}).moderationApplies, null);
});
