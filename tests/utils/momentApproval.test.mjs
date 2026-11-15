// Approve / Reject a pending moment from the notification bell (Chris, 13 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isPendingMoment, momentActionError, momentActionOk } from '../../utils/momentApproval.ts';

const GUEST = { type: 'moment', image_id: 55, accept_reject: 1, description: 'Deepak stasht a moment to "Example Event" — pending your approval' };

test('the API says which moments wait for this owner', () => {
  assert.equal(isPendingMoment({ ...GUEST, pending_approval: true }), true);
  assert.equal(isPendingMoment({ ...GUEST, pending_approval: false }), false, 'approved / rejected / not the owner');
  assert.equal(isPendingMoment({ type: 'moment', image_id: 9, accept_reject: 1, description: 'Sam stasht a moment to "X"', pending_approval: true }), true, 'a contributor upload (no wording) too');
});

test('older API answers: the guest submission wording', () => {
  assert.equal(isPendingMoment(GUEST), true);
  assert.equal(isPendingMoment({ ...GUEST, accept_reject: null }), false);
  assert.equal(isPendingMoment({ ...GUEST, description: 'Deepak stasht a moment to "Example Event"' }), false);
});

test('only moment items with a photo', () => {
  assert.equal(isPendingMoment({ ...GUEST, type: 'comment', pending_approval: true }), false);
  assert.equal(isPendingMoment({ ...GUEST, image_id: null, pending_approval: true }), false);
  assert.equal(isPendingMoment(null), false);
});

test('approve-image / deny-image answers', () => {
  assert.equal(momentActionOk(true, { status: 1, message: 'Image approved successfully' }), true);
  assert.equal(momentActionOk(true, { success: true }), true);
  assert.equal(momentActionOk(true, { status: 0, message: 'Unauthorized' }), false);
  assert.equal(momentActionOk(false, { status: 1 }), false);
  assert.equal(momentActionOk(true, null), false);
  assert.equal(momentActionError({ message: 'Unauthorized. Only memory owner can approve images.' }, 'approve'), 'Unauthorized. Only memory owner can approve images.');
  assert.equal(momentActionError(null, 'reject'), "Couldn't reject. Please try again.");
});
