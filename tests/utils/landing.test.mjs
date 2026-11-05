// tests/utils/landing.test.mjs
// Release E2E, 5 Nov 2026 (B1): the one-time landing redirect for role 3 / 4 (to Campaigns) only ran when the app opened
// on Dashboard; opened on any other page it stayed pending and fired on the person's FIRST Dashboard click, bouncing them
// to Campaigns. It is decided once, when the sign-in is ready, on the page the app opened on — never on a navigation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingAfterSignIn } from '../../utils/landing.ts';

const base = { authReady: true, done: false, inviteLanding: false };

test('opened on Dashboard: role 3 / 4 land on Campaigns, other roles stay', () => {
  assert.equal(landingAfterSignIn({ ...base, currentPage: 'dashboard', role: '3' }), 'campaigns');
  assert.equal(landingAfterSignIn({ ...base, currentPage: 'dashboard', role: 4 }), 'campaigns');
  assert.equal(landingAfterSignIn({ ...base, currentPage: 'dashboard', role: '2' }), 'done');
});

test('opened on another page: decided there and then (done), so a later Dashboard click is never redirected', () => {
  assert.equal(landingAfterSignIn({ ...base, currentPage: 'memories', role: '3' }), 'done');
  assert.equal(landingAfterSignIn({ ...base, currentPage: 'leads', role: '4' }), 'done');
});

test('an invite sign-in lands on Campaigns; nothing happens before the sign-in is ready or after it was decided', () => {
  assert.equal(landingAfterSignIn({ ...base, currentPage: 'dashboard', role: '2', inviteLanding: true }), 'campaigns');
  assert.equal(landingAfterSignIn({ ...base, authReady: false, currentPage: 'dashboard', role: '3' }), 'wait');
  assert.equal(landingAfterSignIn({ ...base, done: true, currentPage: 'dashboard', role: '3' }), 'wait');
});
