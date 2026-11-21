// tests/products/c21-products.test.mjs — Chris 21 Nov 2026 (P1): the editor's Cover photo / Intro Video is the product's
// first media item (the value the page's Edit Cover changes), none after Remove cover; a new product's cover pick goes
// first among its picks; an intro video replaces the product's one video.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editorCoverOf, pendingWithCover, videoToReplace, productPageCover } from '../../utils/products.ts';

const photo = (id, sort) => ({ id, url: `https://s3/p/${id}.jpg`, type: 'photo', sort_order: sort });
const video = (id, sort) => ({ id, url: `https://s3/p/${id}.mp4`, type: 'video', sort_order: sort });

test('editorCoverOf: the first media item by sort order — a photo is the cover photo, a video the intro video', () => {
  assert.equal(editorCoverOf([], false), null);
  assert.equal(editorCoverOf(null, false), null);
  assert.deepEqual(editorCoverOf([photo(2, 1), photo(1, 0)], false), { kind: 'photo', url: 'https://s3/p/1.jpg', id: 1 });
  assert.deepEqual(editorCoverOf([photo(1, 1), video(9, 0)], false), { kind: 'video', url: 'https://s3/p/9.mp4', id: 9 });
});

test('editorCoverOf: nothing once the cover was removed (the brand shows); the photos stay', () => {
  assert.equal(editorCoverOf([photo(1, 0)], true), null);
});

test('editorCoverOf agrees with the product page cover (same stored value)', () => {
  const d = { media: [video(9, 0), photo(1, 1)], main_image: 'https://s3/p/1.jpg', show_photos: true, cover_removed: false };
  assert.equal(editorCoverOf(d.media, d.cover_removed).url, productPageCover(d));
  assert.equal(productPageCover({ ...d, cover_removed: true }), null);
  assert.equal(editorCoverOf(d.media, true), null);
});

test('pendingWithCover: the pick goes first; an intro video replaces a picked video, photos stay', () => {
  const a = { key: 'a', type: 'photo' };
  const v = { key: 'v', type: 'video' };
  assert.deepEqual(pendingWithCover([a], { key: 'c', type: 'photo' }).map((m) => m.key), ['c', 'a']);
  assert.deepEqual(pendingWithCover([a, v], { key: 'w', type: 'video' }).map((m) => m.key), ['w', 'a']);
  assert.deepEqual(pendingWithCover([a, v], { key: 'c', type: 'photo' }).map((m) => m.key), ['c', 'a', 'v']);
});

test('videoToReplace: the product\'s one video, else null', () => {
  assert.equal(videoToReplace([photo(1, 0)]), null);
  assert.equal(videoToReplace([photo(1, 0), video(7, 1)]), 7);
  assert.equal(videoToReplace(undefined), null);
});
