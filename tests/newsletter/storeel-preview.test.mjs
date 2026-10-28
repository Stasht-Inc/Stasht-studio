// [wdy2xh2t3z] The Storeel tab's live preview: what it shows for the form as it is filled in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeelPreviewModel, momentsLabel, initialsOf } from '../../components/storeel/storeelPreview.ts';

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
  assert.equal(m.moments, '0 moments');
  assert.equal(m.firstImage, null);
  assert.equal(m.author, 'Username');
  assert.equal(m.location, '');
  assert.equal(m.date, '');
});

test('a filled form shows its own title, first image, place and date', () => {
  const m = storeelPreviewModel({
    title: 'Fall service event', images: ['blob:a', 'blob:b'], momentCount: 2, location: 'Vancouver, BC, Canada', date: '2026-07-04', authorName: 'Samantha Smith',
  }, 'en-US');
  assert.equal(m.title, 'Fall service event');
  assert.equal(m.cover, 'blob:a');
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
