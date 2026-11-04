// tests/utils/coverChoice.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Create New Campaign's "Cover photo | Add Intro Video" row (Chris, 4 Nov 2026). Both are saved in the same field
// (memories.last_update_img), so the campaign has ONE OR THE OTHER: choosing a cover photo replaces the intro video
// and the other way round. An upload that finishes after the person has already picked something else is ignored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_COVER_CHOICE,
  coverChoiceReducer,
  coverChoicePayload,
  coverPhotoFileError,
  COVER_PHOTO_MAX_BYTES,
  COVER_PHOTO_ACCEPT,
} from '../../utils/coverChoice.ts';

const photo = { name: 'storefront.jpg', type: 'image/jpeg', size: 2_000_000 };
const video = { name: 'welcome.mp4', type: 'video/mp4', size: 20_000_000 };
const run = (actions, start = EMPTY_COVER_CHOICE) => actions.reduce(coverChoiceReducer, start);

test('nothing chosen sends no cover', () => {
  assert.equal(EMPTY_COVER_CHOICE.kind, null);
  assert.deepEqual(coverChoicePayload(EMPTY_COVER_CHOICE), {});
});

test('a cover photo uploads, then is sent as last_update_img', () => {
  const picking = run([{ type: 'pick', seq: 1, kind: 'photo', file: photo, name: photo.name }]);
  assert.equal(picking.kind, 'photo');
  assert.equal(picking.uploading, true);
  assert.equal(picking.name, 'storefront.jpg');
  assert.deepEqual(coverChoicePayload(picking), {}, 'nothing is sent while it uploads');
  const done = coverChoiceReducer(picking, { type: 'uploaded', seq: 1, url: 'https://s3.test/cover.jpg' });
  assert.equal(done.uploading, false);
  assert.equal(done.url, 'https://s3.test/cover.jpg');
  assert.deepEqual(coverChoicePayload(done), { last_update_img: 'https://s3.test/cover.jpg' });
});

test('choosing an intro video replaces the cover photo', () => {
  const s = run([
    { type: 'pick', seq: 1, kind: 'photo', file: photo, name: photo.name },
    { type: 'uploaded', seq: 1, url: 'https://s3.test/cover.jpg' },
    { type: 'pick', seq: 2, kind: 'video', file: video, name: video.name },
    { type: 'uploaded', seq: 2, url: 'https://s3.test/intro.mp4' },
  ]);
  assert.equal(s.kind, 'video');
  assert.equal(s.name, 'welcome.mp4');
  assert.deepEqual(coverChoicePayload(s), { last_update_img: 'https://s3.test/intro.mp4' });
});

test('choosing a cover photo replaces the intro video', () => {
  const s = run([
    { type: 'ready', seq: 1, kind: 'video', file: null, name: 'recording.mp4', url: 'https://s3.test/rec.mp4' },
    { type: 'pick', seq: 2, kind: 'photo', file: photo, name: photo.name },
    { type: 'uploaded', seq: 2, url: 'https://s3.test/cover.jpg' },
  ]);
  assert.equal(s.kind, 'photo');
  assert.deepEqual(coverChoicePayload(s), { last_update_img: 'https://s3.test/cover.jpg' });
});

test('an upload that finishes after something else was picked is ignored', () => {
  const s = run([
    { type: 'pick', seq: 1, kind: 'video', file: video, name: video.name },
    { type: 'pick', seq: 2, kind: 'photo', file: photo, name: photo.name },
    { type: 'progress', seq: 1, progress: 80 },
    { type: 'uploaded', seq: 1, url: 'https://s3.test/intro.mp4' },
  ]);
  assert.equal(s.kind, 'photo');
  assert.equal(s.uploading, true);
  assert.equal(s.progress, 0);
  assert.equal(s.url, null);
  const done = coverChoiceReducer(s, { type: 'uploaded', seq: 2, url: 'https://s3.test/cover.jpg' });
  assert.deepEqual(coverChoicePayload(done), { last_update_img: 'https://s3.test/cover.jpg' });
});

test('progress is shown for the current upload', () => {
  const s = run([{ type: 'pick', seq: 3, kind: 'video', file: video, name: video.name }, { type: 'progress', seq: 3, progress: 42 }]);
  assert.equal(s.progress, 42);
});

test('a failed upload clears the choice (nothing half-saved)', () => {
  const s = run([{ type: 'pick', seq: 1, kind: 'photo', file: photo, name: photo.name }, { type: 'failed', seq: 1 }]);
  assert.equal(s.kind, null);
  assert.deepEqual(coverChoicePayload(s), {});
  // a stale failure leaves the newer pick alone
  const t = run([
    { type: 'pick', seq: 1, kind: 'photo', file: photo, name: photo.name },
    { type: 'pick', seq: 2, kind: 'video', file: video, name: video.name },
    { type: 'failed', seq: 1 },
  ]);
  assert.equal(t.kind, 'video');
});

test('removing it, or resetting the form, clears it', () => {
  const s = run([
    { type: 'pick', seq: 1, kind: 'photo', file: photo, name: photo.name },
    { type: 'uploaded', seq: 1, url: 'https://s3.test/cover.jpg' },
    { type: 'clear' },
  ]);
  assert.equal(s.kind, null);
  assert.equal(s.url, null);
  assert.equal(s.uploading, false);
  assert.deepEqual(coverChoicePayload(s), {});
  // and an upload still running when it was removed doesn't bring it back
  const t = run([{ type: 'pick', seq: 1, kind: 'photo', file: photo, name: photo.name }, { type: 'clear' }, { type: 'uploaded', seq: 1, url: 'x' }]);
  assert.equal(t.kind, null);
});

test('cover photos: the Media picker types (JPG, JPEG, PNG) up to 10MB', () => {
  assert.equal(COVER_PHOTO_MAX_BYTES, 10 * 1024 * 1024);
  assert.match(COVER_PHOTO_ACCEPT, /jpe?g/);
  assert.match(COVER_PHOTO_ACCEPT, /png/);
  assert.equal(coverPhotoFileError({ type: 'image/jpeg', size: 1000 }), null);
  assert.equal(coverPhotoFileError({ type: 'image/jpg', size: 1000 }), null);
  assert.equal(coverPhotoFileError({ type: 'image/png', size: COVER_PHOTO_MAX_BYTES }), null);
  assert.match(coverPhotoFileError({ type: 'image/gif', size: 1000 }), /JPG, JPEG or PNG/);
  assert.match(coverPhotoFileError({ type: 'video/mp4', size: 1000 }), /JPG, JPEG or PNG/);
  assert.match(coverPhotoFileError({ type: 'image/png', size: COVER_PHOTO_MAX_BYTES + 1 }), /10MB/);
});
