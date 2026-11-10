// Chris 8 Nov 2026 (b), point 2: the campaign page's "Publish" is replaced by "Send", which opens the Storeel stepper at
// its Send step (Edit still opens it at step 1). Every publish option moves into the stepper's "Publishing" card —
// nothing is removed: Publish as View Only (2) / Public (1) / Private (3, the access-token link), Unpublish, and the
// published link's tools (copy, share, QR, share message).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLISH_CHOICES, PUBLISHING_SECTION_ID, publishStatus, opensAtTarget, campaignCanOpenStepper, PRIVATE_LINK_SEND_LINE, publishingLine,
} from '../../components/storeel/lib/publishing.ts';
import * as publishing from '../../components/storeel/lib/publishing.ts';
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

test('Publishing is a section at the top of the Send card (Deepak, 9 Nov): no separate card 4', () => {
  assert.deepEqual(FLOW_STEPS, ['campaign', 'moments', 'send'], 'still three cards');
  assert.equal(PUBLISHING_SECTION_ID, 'st-publishing');
  assert.equal('publishingStepNumber' in publishing, false);
});

// Chris 9 Nov 2026 (point 6): the three options are one choice (Public pre-selected), applied by Save & Send; Publish
// now publishes without sending; tapping an option publishes nothing.
test('the Send card\'s publishing line follows what Save & Send does', () => {
  const NOT_YET = 'Not published yet. Save & Send publishes it with the option chosen below, or use Publish now to publish it without sending.';
  assert.equal(publishingLine(0), NOT_YET);
  assert.equal(publishingLine(null), NOT_YET);
  assert.equal(publishingLine(1), null);
  assert.equal(publishingLine(2), null);
  assert.equal(publishingLine(3), "Private link only: it can't be sent. Choose Public or View Only to send it.");
});

test('the choice the Publishing card opens with: Public when not published, else the mode it is in', () => {
  for (const v of [0, null, undefined, '', '0']) assert.equal(publishing.defaultPublishChoice(v), 1, String(v));
  assert.equal(publishing.defaultPublishChoice(1), 1);
  assert.equal(publishing.defaultPublishChoice(2), 2);
  assert.equal(publishing.defaultPublishChoice('3'), 3);
});

test('Publish now: offered when not published, or when another mode is chosen on a published campaign', () => {
  for (const c of [1, 2, 3]) assert.equal(publishing.canPublishNow(0, c), true, `unpublished, ${c}`);
  assert.equal(publishing.canPublishNow(1, 1), false, 'already Public');
  assert.equal(publishing.canPublishNow(1, 2), true, 'Public → View Only');
  assert.equal(publishing.canPublishNow(3, 1), true, 'Private → Public');
});

test('the line under the options: Private can\'t be sent; another mode on a published campaign switches it', () => {
  const PRIVATE = "A Private campaign can't be sent: only people with its private link can open it. Publish now makes that link.";
  assert.equal(publishing.publishChoiceNote(0, 1), null);
  assert.equal(publishing.publishChoiceNote(0, 2), null);
  assert.equal(publishing.publishChoiceNote(0, 3), PRIVATE);
  assert.equal(publishing.publishChoiceNote(1, 3), PRIVATE);
  assert.equal(publishing.publishChoiceNote(3, 3), null, 'already private: the line above says it');
  assert.equal(publishing.publishChoiceNote(1, 1), null);
  assert.equal(publishing.publishChoiceNote(1, 2), 'Save & Send or Publish now changes it to View Only.');
  assert.equal(publishing.publishChoiceNote(3, 1), 'Save & Send or Publish now changes it to Public.');
});

test('what applies right away (no Save Changes): Publish now and / or Unpublish', () => {
  assert.equal(publishing.rightAwayLine(0, 1), "Publish now applies right away. It doesn't need Save Changes.");
  assert.equal(publishing.rightAwayLine(1, 1), "Unpublish applies right away. It doesn't need Save Changes.");
  assert.equal(publishing.rightAwayLine(1, 2), "Publish now and Unpublish apply right away. They don't need Save Changes.");
});

test('Save & Send: the mode it sends in, and Private blocks it', () => {
  assert.equal(publishing.sendRoleFor(0, 2), 2);
  assert.equal(publishing.sendRoleFor(0, null), 1, 'no choice (Create Campaign): Public, as the API does');
  assert.equal(publishing.sendRoleFor(2, null), 2);
  assert.equal(publishing.sendRoleFor(1, 3), 3);
  assert.equal(publishing.choiceSendProblem(3), 'Choose Public or View Only in Publishing. A Private campaign can\'t be sent.');
  for (const c of [1, 2, null, undefined]) assert.equal(publishing.choiceSendProblem(c), null, String(c));
});

test('the send confirm says what sending does to the campaign', () => {
  assert.equal(publishing.confirmPublishLine(0, null), 'Sending publishes your campaign (Public), so people can open it.');
  assert.equal(publishing.confirmPublishLine(0, 2), 'Sending publishes your campaign (View Only), so people can open it.');
  assert.equal(publishing.confirmPublishLine(1, 2), 'Sending changes your campaign to View Only.');
  assert.equal(publishing.confirmPublishLine(2, 2), null);
  assert.equal(publishing.confirmPublishLine(2, null), null);
  assert.equal(publishing.confirmPublishLine(1, 3), null, 'private is blocked, not described');
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

test('a private campaign: the send confirm points at the top of the Send card', () => {
  assert.equal(PRIVATE_LINK_SEND_LINE, 'This campaign is shared by private link only. Publish it as Public or View Only at the top of the Send card, then send it.');
});

// Review fixes (8 Nov 2026 b): one published normaliser; the device location never replaces a saved campaign's.
import { publishedRole } from '../../components/storeel/lib/publishing.ts';
import { detectsDeviceLocation, withDeviceLocation } from '../../components/storeel/lib/deviceLocation.ts';

test('publishedRole: one normaliser (1/2/3, numeric strings too) used everywhere; anything else is 0', () => {
  assert.equal(publishedRole(1), 1);
  assert.equal(publishedRole('2'), 2);
  assert.equal(publishedRole(' 3 '), 3);
  for (const v of [0, null, undefined, '', '0', 4, 'yes', true, false, NaN]) assert.equal(publishedRole(v), 0, String(v));
  assert.deepEqual(publishStatus('1'), { live: true, role: 1, label: 'Public' });
});

test('device location: only looked up when creating (never on a saved campaign: Edit / Send)', () => {
  assert.equal(detectsDeviceLocation({ open: true, campaignId: null, saved: false, deviceLocation: '' }), true);
  assert.equal(detectsDeviceLocation({ open: true, campaignId: 901, saved: true, deviceLocation: '' }), false, 'Edit / Send');
  assert.equal(detectsDeviceLocation({ open: true, campaignId: null, saved: true, deviceLocation: '' }), false, 'made in this flow');
  assert.equal(detectsDeviceLocation({ open: false, campaignId: null, saved: false, deviceLocation: '' }), false);
  assert.equal(detectsDeviceLocation({ open: true, campaignId: null, saved: false, deviceLocation: 'Mumbai, India' }), false);
});

test('device location: fills only a truly empty field, read from the current form (never overwrites)', () => {
  const empty = { title: 'T', location: '' };
  assert.deepEqual(withDeviceLocation(empty, 'Mumbai, India', false), { title: 'T', location: 'Mumbai, India' });
  const typed = { title: 'T', location: 'Paris' };
  assert.equal(withDeviceLocation(typed, 'Mumbai, India', false), typed, 'typed meanwhile: kept (same object)');
  const saved = { title: 'T', location: '' };
  assert.equal(withDeviceLocation(saved, 'Mumbai, India', true), saved, 'a saved campaign: never');
  assert.equal(withDeviceLocation({ location: '   ' }, 'Mumbai', false).location, 'Mumbai', 'blank counts as empty');
  assert.equal(withDeviceLocation(empty, '', false), empty);
});
