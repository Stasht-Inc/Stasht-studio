// [wdy2xh2t3z] The Storeel tab's live preview: what it shows for the form as it is filled in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeelPreviewModel, momentsLabel, initialsOf, storeelBrandImage } from '../../components/storeel/storeelPreview.ts';

test('momentsLabel counts moments', () => {
  assert.equal(momentsLabel(0), '0 moments');
  assert.equal(momentsLabel(1), '1 moment');
  assert.equal(momentsLabel(12), '12 moments');
});

test('initialsOf takes the first letter', () => {
  assert.equal(initialsOf('samantha smith'), 'S');
  assert.equal(initialsOf('  '), 'U');
  assert.equal(initialsOf(undefined), 'U');
});

test('an empty form shows placeholders', () => {
  const m = storeelPreviewModel({ title: '  ', images: [], momentCount: 0, location: '', date: '', authorName: '' }, 'en-US');
  assert.equal(m.title, '');
  assert.equal(m.cover, null);
  assert.equal(m.coverKind, null);
  assert.equal(m.moments, '0 moments');
  assert.equal(m.firstImage, null);
  assert.equal(m.author, 'Username');
  assert.equal(m.location, '');
  assert.equal(m.date, '');
});

test('a filled form shows its own title, first image (on the moment card), place and date', () => {
  const m = storeelPreviewModel({
    title: 'Fall service event', images: ['blob:a', 'blob:b'], momentCount: 2, location: 'Vancouver, BC, Canada', date: '2026-07-04', authorName: 'Samantha Smith',
  }, 'en-US');
  assert.equal(m.title, 'Fall service event');
  // Chris, 4 Nov 2026: the first photo is NOT the cover (the saved campaign page doesn't use it either).
  assert.equal(m.cover, null);
  assert.equal(m.firstImage, 'blob:a');
  assert.equal(m.moments, '2 moments');
  assert.equal(m.author, 'Samantha Smith');
  assert.equal(m.initial, 'S');
  assert.equal(m.location, 'Vancouver, BC, Canada');
  assert.equal(m.date, 'Jul 4, 2026');
});

// Review fix: the live preview's cover and count come from the form's own photo lists.
test('storeelPreviewMedia: first photo (uploaded link, else the file), real count, no HEIC', async () => {
  const { storeelPreviewMedia } = await import('../../components/storeel/storeelPreview.ts');
  const file = (name, type) => ({ name, type });
  const jpg = file('a.jpg', 'image/jpeg');
  assert.deepEqual(storeelPreviewMedia({ withMetadata: [{ file: jpg, fileUrl: '' }], mainPhotos: [], mediaFiles: [] }), { first: jpg, count: 1 });
  assert.deepEqual(storeelPreviewMedia({ withMetadata: [{ file: jpg, fileUrl: 'https://x/a.jpg' }], mainPhotos: [], mediaFiles: [jpg, jpg] }), { first: 'https://x/a.jpg', count: 2 });
  assert.deepEqual(storeelPreviewMedia({ withMetadata: [], mainPhotos: [{ fileUrl: 'https://x/b.jpg' }, { fileUrl: '' }], mediaFiles: [] }), { first: 'https://x/b.jpg', count: 2 });
  assert.deepEqual(storeelPreviewMedia({ withMetadata: [], mainPhotos: [], mediaFiles: [file('p.HEIC', '')] }), { first: null, count: 1 });
  assert.deepEqual(storeelPreviewMedia({ withMetadata: [], mainPhotos: [], mediaFiles: [file('p.heic', 'image/heic')] }), { first: null, count: 1 });
  assert.deepEqual(storeelPreviewMedia({ withMetadata: [], mainPhotos: [], mediaFiles: [] }), { first: null, count: 0 });
});

// Chris, 4 Nov 2026 (point 6): the preview's cover is what the saved campaign page shows — the chosen cover photo, or
// the intro video (its first frame), else the BRAND: the account avatar (the property's image in the property view).
// Never the first photo, never a grey box.
const base = { title: 'Next Summit / 25', images: ['blob:first'], momentCount: 1, location: '', date: '2026-11-04', authorName: 'Next Summit' };

test('no cover chosen: the brand is the cover', () => {
  const m = storeelPreviewModel({ ...base, brandImage: 'https://cdn.test/logo.png' }, 'en-US');
  assert.equal(m.cover, 'https://cdn.test/logo.png');
  assert.equal(m.coverKind, 'brand');
  assert.equal(m.firstImage, 'blob:first');
});

test('a cover photo is the cover', () => {
  const m = storeelPreviewModel({ ...base, coverPhoto: 'blob:cover', brandImage: 'https://cdn.test/logo.png' }, 'en-US');
  assert.equal(m.cover, 'blob:cover');
  assert.equal(m.coverKind, 'photo');
});

test('an intro video is the cover (its first frame)', () => {
  const m = storeelPreviewModel({ ...base, introVideo: 'https://s3.test/intro.mp4', brandImage: 'https://cdn.test/logo.png' }, 'en-US');
  assert.equal(m.cover, 'https://s3.test/intro.mp4');
  assert.equal(m.coverKind, 'video');
});

test('no cover and no brand image: no picture (the preview shows the initial on the profile colour)', () => {
  const m = storeelPreviewModel({ ...base, brandImage: '  ' }, 'en-US');
  assert.equal(m.cover, null);
  assert.equal(m.coverKind, null);
});

test('the brand image is the one the campaign page falls back to', () => {
  assert.equal(storeelBrandImage({ viewType: 'property', propertyImage: 'https://cdn.test/prop.png', userAvatar: 'https://cdn.test/me.png' }), 'https://cdn.test/prop.png');
  assert.equal(storeelBrandImage({ viewType: 'property', propertyImage: null, userAvatar: 'https://cdn.test/me.png' }), 'https://cdn.test/me.png');
  assert.equal(storeelBrandImage({ viewType: 'personal', propertyImage: 'https://cdn.test/prop.png', userAvatar: 'https://cdn.test/me.png' }), 'https://cdn.test/me.png');
  assert.equal(storeelBrandImage({ viewType: 'personal', propertyImage: null, userAvatar: '' }), null);
});
