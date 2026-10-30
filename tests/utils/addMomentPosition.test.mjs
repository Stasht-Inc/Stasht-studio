// tests/utils/addMomentPosition.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
// The "Add a moment" bar adds the guest's moment at the END of the timeline: after the last post shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endOfTimelinePostId } from '../../utils/addMomentPosition.ts';

const post = (id) => ({ type: 'post', id: String(id) });
const linked = (id) => ({ type: 'linked', id: String(id) });

test('the last item is a post: that post', () => {
  assert.equal(endOfTimelinePostId([post(11), post(12), post(13)]), '13');
});

test('the last item is a linked memory: the last post before it', () => {
  assert.equal(endOfTimelinePostId([post(11), linked(90), post(12), linked(91)]), '12');
  assert.equal(endOfTimelinePostId([post(11), linked(90), linked(91)]), '11');
});

test('no posts (empty, or linked memories only): null', () => {
  assert.equal(endOfTimelinePostId([]), null);
  assert.equal(endOfTimelinePostId([linked(90), linked(91)]), null);
  assert.equal(endOfTimelinePostId(null), null);
  assert.equal(endOfTimelinePostId(undefined), null);
});

test('ids come back as strings; empty ids are skipped', () => {
  assert.equal(endOfTimelinePostId([{ type: 'post', id: 42 }]), '42');
  assert.equal(endOfTimelinePostId([post(11), { type: 'post', id: '' }]), '11');
});
