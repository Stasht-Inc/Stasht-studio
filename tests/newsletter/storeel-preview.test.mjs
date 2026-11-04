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
  const m = storeelPreviewModel({ title: '  ', moments: [], location: '', date: '', authorName: '' }, 'en-US');
  assert.equal(m.title, '');
  assert.equal(m.cover, null);
  assert.equal(m.coverKind, null);
  assert.equal(m.moments, '0 moments');
  assert.deepEqual(m.momentCards, []);
  assert.equal(m.author, 'Username');
  assert.equal(m.location, '');
  assert.equal(m.date, '');
});

const PHOTO = (i, extra = {}) => ({ kind: 'photo', key: `photo-${i}`, image: `blob:${i}`, video: false, text: '', location: '', date: '', ...extra });

test('a filled form shows its own title, every moment (in order), place and date', () => {
  const m = storeelPreviewModel({
    title: 'Fall service event', moments: [PHOTO('a'), PHOTO('b', { date: '2026-10-01' })], location: 'Vancouver, BC, Canada', date: '2026-07-04', authorName: 'Samantha Smith',
  }, 'en-US');
  assert.equal(m.title, 'Fall service event');
  // Chris, 4 Nov 2026: the first photo is NOT the cover (the saved campaign page doesn't use it either).
  assert.equal(m.cover, null);
  assert.deepEqual(m.momentCards.map((c) => c.key), ['photo-a', 'photo-b']);
  assert.equal(m.moments, '2 moments');
  // A moment's own date (else the campaign's), in the person's language.
  assert.equal(m.momentCards[0].date, 'Jul 4, 2026');
  assert.equal(m.momentCards[1].date, 'Oct 1, 2026');
  // A moment's own place, else the campaign's.
  assert.equal(m.momentCards[0].location, 'Vancouver, BC, Canada');
  assert.equal(m.author, 'Samantha Smith');
  assert.equal(m.initial, 'S');
  assert.equal(m.location, 'Vancouver, BC, Canada');
  assert.equal(m.date, 'Jul 4, 2026');
});

// Chris, 4 Nov 2026 (point 6): the preview's cover is what the saved campaign page shows — the chosen cover photo, or
// the intro video (its first frame), else the BRAND: the account avatar (the property's image in the property view).
// Never the first photo, never a grey box.
const base = { title: 'Next Summit / 25', moments: [PHOTO('first')], location: '', date: '2026-11-04', authorName: 'Next Summit' };

test('no cover chosen: the brand is the cover', () => {
  const m = storeelPreviewModel({ ...base, brandImage: 'https://cdn.test/logo.png' }, 'en-US');
  assert.equal(m.cover, 'https://cdn.test/logo.png');
  assert.equal(m.coverKind, 'brand');
  assert.equal(m.momentCards[0].image, 'blob:first', 'the first photo is a moment, never the cover');
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
