// Review of Chris 6 Nov (point 2): the Storeel preview's cover is a whole phone screen (393x852). Judged against that
// tall box, an ordinary 640x400 cover photo counted as "too small" and showed contained over a blurred backdrop.
// A cover can be judged against another box (`judgeBox`) — the preview uses a square of the phone's width — so only
// genuinely small pictures get that treatment; every other cover keeps judging against its own box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignCoverLayout } from '../../utils/campaignCover.ts';

const phoneScreen = { width: 393, height: 852 };
const judgeBox = { width: 393, height: 393 };

test('a 640x400 photo fills the phone-screen cover when judged against the phone width', () => {
  assert.equal(campaignCoverLayout({ natural: { width: 640, height: 400 }, box: phoneScreen }).mode, 'contain', 'without judgeBox: the old rule (contained)');
  assert.deepEqual(campaignCoverLayout({ natural: { width: 640, height: 400 }, box: phoneScreen, judgeBox }), { mode: 'cover' });
  for (const natural of [{ width: 1024, height: 576 }, { width: 640, height: 480 }, { width: 1170, height: 2532 }, { width: 400, height: 300 }]) {
    assert.deepEqual(campaignCoverLayout({ natural, box: phoneScreen, judgeBox }), { mode: 'cover' }, JSON.stringify(natural));
  }
});

test('a genuinely small picture is still contained, sized in its real box', () => {
  const l = campaignCoverLayout({ natural: { width: 150, height: 150 }, box: phoneScreen, judgeBox });
  assert.equal(l.mode, 'contain');
  // sized against the real box (never enlarged past 1.5x): 225x225
  assert.deepEqual(l, { mode: 'contain', shape: 'rect', width: 225, height: 225 });
  assert.equal(campaignCoverLayout({ natural: { width: 300, height: 120 }, box: phoneScreen, judgeBox }).mode, 'contain');
});

test('a bad judge box is ignored (judged against the real box)', () => {
  assert.equal(campaignCoverLayout({ natural: { width: 640, height: 400 }, box: phoneScreen, judgeBox: { width: 0, height: 0 } }).mode, 'contain');
});
