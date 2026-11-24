// tests/utils/momentVideo.test.mjs
// Deepak, 24 Nov 2026 (P5): "+" → Video. Upload of any length; over 30 s the note "Only the first 30 seconds will be
// used." (never refused); Record on phones and on computers with a camera; the upload's reply → the moment's video.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOMENT_VIDEO_MAX_SECONDS, momentVideoNote, canRecordVideo, isPhoneDevice, uploadedMomentVideoFrom, MOMENT_VIDEO_ACCEPT } from '../../utils/momentVideo.ts';
import { MAX_COVER_VIDEO_SECONDS } from '../../utils/uploadFiles.ts';
import { addWidgetOptions } from '../../components/widgets/addWidgetOptions.ts';

test('a moment video keeps 30 s; the Intro Video limit stays 2 minutes', () => {
  assert.equal(MOMENT_VIDEO_MAX_SECONDS, 30);
  assert.equal(MAX_COVER_VIDEO_SECONDS, 120);
});

test('the note shows only over 30 s, and never when the length is unknown', () => {
  assert.equal(momentVideoNote(40), 'Only the first 30 seconds will be used.');
  assert.equal(momentVideoNote(30.5), 'Only the first 30 seconds will be used.');
  assert.equal(momentVideoNote(30), null);
  assert.equal(momentVideoNote(30.04), null); // rounding of a 30 s recording
  assert.equal(momentVideoNote(12), null);
  assert.equal(momentVideoNote(null), null);
  assert.equal(momentVideoNote(undefined), null);
  assert.equal(momentVideoNote(Number.NaN), null);
  assert.equal(momentVideoNote(Infinity), null);
});

test('Record: on phones always; on computers only with a camera; never throws', async () => {
  const iphone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' };
  assert.equal(isPhoneDevice(iphone), true);
  assert.equal(await canRecordVideo(iphone), true);
  assert.equal(await canRecordVideo({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }), true);
  const mac = (devices) => ({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', mediaDevices: { enumerateDevices: async () => devices } });
  assert.equal(await canRecordVideo(mac([{ kind: 'audioinput' }, { kind: 'videoinput' }]), 1280), true);
  assert.equal(await canRecordVideo(mac([{ kind: 'audioinput' }]), 1280), false);
  assert.equal(await canRecordVideo({ userAgent: 'Mac', mediaDevices: { enumerateDevices: async () => { throw new Error('denied'); } } }, 1280), false);
  assert.equal(await canRecordVideo({ userAgent: 'Mac' }, 1280), false);
  assert.equal(await canRecordVideo(undefined), false);
  // A narrow window counts as a phone (as Intro Video decides).
  assert.equal(await canRecordVideo({ userAgent: 'Mac' }, 390), true);
});

test('the upload reply gives the moment its video URL and size', () => {
  assert.deepEqual(uploadedMomentVideoFrom({ success: true, fileUrl: 'https://s3/x.mp4', compressedSizeMB: 3.2, originalSizeMB: 9 }), { fileUrl: 'https://s3/x.mp4', sizeMB: 3.2 });
  assert.deepEqual(uploadedMomentVideoFrom({ fileUrl: 'https://s3/y.webm', originalSizeMB: '1.5' }), { fileUrl: 'https://s3/y.webm', sizeMB: 1.5 });
  assert.equal(uploadedMomentVideoFrom({ success: false }), null);
  assert.equal(uploadedMomentVideoFrom(null), null);
  assert.equal(MOMENT_VIDEO_ACCEPT, 'video/*,video/quicktime,.mov,.mp4,.m4v');
});

test('"Video" is offered right after Moment in every "+" chooser', () => {
  const opts = addWidgetOptions({ docuSign: false, shopifyProduct: true });
  assert.deepEqual(opts.slice(0, 2).map((o) => [o.kind, o.label, o.desc]), [
    ['moment', 'Moment', 'Add a special moment'],
    ['video', 'Video', 'Upload or record a video'],
  ]);
});
