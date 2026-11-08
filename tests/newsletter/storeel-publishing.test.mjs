// Chris 8 Nov 2026 (b), point 2: the campaign page's "Publish" is replaced by "Send", which opens the Storeel stepper at
// its Send step (Edit still opens it at step 1). Every publish option moves into the stepper's "Publishing" card —
// nothing is removed: Publish as View Only (2) / Public (1) / Private (3, the access-token link), Unpublish, and the
// published link's tools (copy, share, QR, share message).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLISH_CHOICES, PUBLISHING_STEP_ID, publishingStepNumber, publishStatus, opensAtTarget, campaignCanOpenStepper, PRIVATE_LINK_SEND_LINE,
} from '../../components/storeel/lib/publishing.ts';
import { FLOW_STEPS } from '../../components/storeel/lib/storeelFlow.ts';

test('the three publish choices of today, in today\'s order and roles, with today\'s descriptions', () => {
  assert.deepEqual(PUBLISH_CHOICES.map((c) => [c.key, c.role]), [['view-only', 2], ['public', 1], ['private', 3]]);
  assert.deepEqual(PUBLISH_CHOICES.map((c) => c.title), ['Publish as View Only', 'Publish as Public', 'Publish as Private']);
  assert.deepEqual(PUBLISH_CHOICES.map((c) => c.description), [
    'Users can only view the campaign, no comments allowed',
    'Anyone can view and leave comments',
    'Only visible with a valid access token',
  ]);
});

test('publishStatus: 1 public, 2 view only, 3 private (access-token link); anything else is not published', () => {
  assert.deepEqual(publishStatus(1), { live: true, role: 1, label: 'Public' });
  assert.deepEqual(publishStatus(2), { live: true, role: 2, label: 'View Only' });
  assert.deepEqual(publishStatus('3'), { live: true, role: 3, label: 'Private' });
  for (const v of [0, null, undefined, '', '0', 4, 'yes']) assert.deepEqual(publishStatus(v), { live: false, role: null, label: null }, String(v));
});

test('Publishing is the card after Send (4), with its own id', () => {
  assert.deepEqual(FLOW_STEPS, ['campaign', 'moments', 'send'], 'the flow itself keeps its three steps (Create has no Publishing)');
  assert.equal(publishingStepNumber(), 4);
  assert.equal(PUBLISHING_STEP_ID, 'st-step-publishing');
});

test('Send opens the stepper at the Send card; Edit (or nothing) at the top', () => {
  assert.equal(opensAtTarget('send'), 'st-step-send');
  assert.equal(opensAtTarget('campaign'), null);
  assert.equal(opensAtTarget(undefined), null);
});

test('the stepper opens only on a saved campaign id (else the old Publish control stays)', () => {
  assert.equal(campaignCanOpenStepper(901), true);
  assert.equal(campaignCanOpenStepper('901'), true);
  for (const v of ['car:5', 'catalog_item:3', '', null, undefined, 'abc']) assert.equal(campaignCanOpenStepper(v), false, String(v));
});

test('a private campaign: the send confirm points at Publishing (no longer "on the campaign page")', () => {
  assert.match(PRIVATE_LINK_SEND_LINE, /private link only/);
  assert.match(PRIVATE_LINK_SEND_LINE, /in Publishing/);
  assert.doesNotMatch(PRIVATE_LINK_SEND_LINE, /on the campaign page/);
});
