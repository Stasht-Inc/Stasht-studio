// tests/utils/propertyImage.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// A property's own business image (properties.image): set from Users → Properties → Edit Property and from the
// camera button on the property view's avatar (Chris, 1 Nov 2026). It is what every property avatar shows first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROPERTY_IMAGE_MAX_BYTES,
  propertyImageFileError,
  propertyAvatarImage,
  canChangePropertyImage,
  propertyImageErrorMessage,
  propertyUpdateFailure,
} from '../../utils/propertyImage.ts';

// Serpa Chrysler (stash 889) and Bon Sun (stash 966), whose external property 96 Serpa made for him.
const serpa = { id: 708, external_user_id: 889, name: 'Serpa Chrysler' };
const bon = { id: 120, external_user_id: 966, name: 'Bon Sun' };
const serpaLogo = 'https://cdn.test/serpa-logo.png';
const invitedBySerpa = { external_user_id: 889, name: 'Serpa Chrysler', profile_image: serpaLogo };

test('accepts PNG, JPG, GIF and WebP up to 10MB', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
    assert.equal(propertyImageFileError({ type, size: 1024 }), null, type);
  }
  assert.equal(propertyImageFileError({ type: 'image/png', size: PROPERTY_IMAGE_MAX_BYTES }), null);
});

test('refuses other files, files over 10MB and nothing at all, in words', () => {
  assert.match(propertyImageFileError({ type: 'application/pdf', size: 10 }), /PNG, JPG/);
  assert.match(propertyImageFileError({ type: 'image/heic', size: 10 }), /PNG, JPG/);
  assert.match(propertyImageFileError({ type: 'image/png', size: PROPERTY_IMAGE_MAX_BYTES + 1 }), /10MB/);
  assert.match(propertyImageFileError(null), /choose/i);
});

test("the property's own image comes first, even when someone else invited the viewer", () => {
  const row = { id: 96, name: 'Bon Sun', image: 'https://cdn.test/bon-store.jpg', invited_by: invitedBySerpa };
  const shown = propertyAvatarImage(row, bon);
  assert.equal(shown.image, 'https://cdn.test/bon-store.jpg');
  assert.equal(shown.invitedBy?.name, 'Serpa Chrysler', 'the inviter is still named');
});

test("without its own image: the inviter's logo when someone else invited the viewer, else nothing", () => {
  const row = { id: 96, name: 'Bon Sun', image: null, invited_by: invitedBySerpa };
  assert.equal(propertyAvatarImage(row, bon).image, serpaLogo);
  assert.equal(propertyAvatarImage(row, serpa).image, null, "the inviter doesn't see their own logo");
  assert.equal(propertyAvatarImage({ ...row, invited_by: [invitedBySerpa] }, bon).image, serpaLogo, 'invited_by may be a list');
  assert.equal(propertyAvatarImage({ id: 1, image: 'null' }, bon).image, null, "the string 'null' is no image");
  assert.equal(propertyAvatarImage({ id: 1, image: '  ' }, bon).image, null);
  assert.equal(propertyAvatarImage(null, bon).image, null);
});

test('who may change it: the main account and property admins (can_manage), and the property\'s own account', () => {
  // Serpa's view of Bon's property: shared row, can_manage true.
  assert.equal(canChangePropertyImage({ id: 96, user_id: 966, is_creator: false, can_manage: true }, serpa), true);
  // Bon's own external property: the API says can_manage false (he can't deactivate himself) but it is his.
  assert.equal(canChangePropertyImage({ id: 96, user_id: 966, is_creator: true, can_manage: false, account_type: 'external' }, bon), true);
  // An internal property the viewer made.
  assert.equal(canChangePropertyImage({ id: 12, user_id: 889, is_creator: true, can_manage: true }, serpa), true);
});

test('reps, viewers and anyone else may not', () => {
  assert.equal(canChangePropertyImage({ id: 96, user_id: 966, is_creator: false, user_role: 'viewer', can_manage: false }, serpa), false);
  assert.equal(canChangePropertyImage({ id: 96, user_id: 966, is_creator: false, user_role: 'rep', can_manage: false }, serpa), false);
  assert.equal(canChangePropertyImage({ id: 96, user_id: 966, is_creator: false, can_manage: '0' }, serpa), false);
  assert.equal(canChangePropertyImage(null, serpa), false);
  assert.equal(canChangePropertyImage({ id: 96, user_id: 966 }, null), false);
});

test('a row stored before can_manage existed: creators and admins/owners yes, others no', () => {
  assert.equal(canChangePropertyImage({ id: 12, user_id: 1, is_creator: true }, serpa), true);
  assert.equal(canChangePropertyImage({ id: 12, user_id: 1, is_creator: false, user_role: 'admin' }, serpa), true);
  assert.equal(canChangePropertyImage({ id: 12, user_id: 1, is_creator: false, user_role: 'owner' }, serpa), true);
  assert.equal(canChangePropertyImage({ id: 12, user_id: 1, is_creator: false, user_role: 'viewer' }, serpa), false);
});

test('error text: the image field message, then any field message, then the API message, then a plain fallback', () => {
  assert.equal(
    propertyImageErrorMessage({ success: false, error: 'Validation failed', errors: { image: ['The image must not be greater than 10240 kilobytes.'] } }),
    'The image must not be greater than 10240 kilobytes.',
  );
  assert.equal(propertyImageErrorMessage({ success: false, error: 'Validation failed', errors: { username: ['Taken.'] } }), 'Taken.');
  assert.equal(propertyImageErrorMessage({ success: false, error: 'Only the main account or a property admin can change this property.' }),
    'Only the main account or a property admin can change this property.');
  assert.equal(propertyImageErrorMessage({ success: false, message: 'Nope' }), 'Nope');
  assert.equal(propertyImageErrorMessage(null), 'The image could not be uploaded. Please try again.');
});

test("a linked external account's property: only that account may change its image", () => {
  const linked = { id: 2, user_id: 901, is_creator: false, account_type: 'external', can_manage: true, account_created_for_property: false };
  assert.equal(canChangePropertyImage(linked, serpa), false);
  assert.equal(canChangePropertyImage({ ...linked, account_created_for_property: true }, serpa), true);
  assert.equal(canChangePropertyImage(linked, { id: 9, external_user_id: 901 }), true);
});

// POST /properties/{id}/update failures, as dashboardAPI.updateProperty reports them (Chris, 1 Nov 2026: "still can't
// add an image" with no clear reason). The server's own words when it sent any, the HTTP status always.
test('update failure: the API message, with its field errors and the status', () => {
  const denied = propertyUpdateFailure({ status: 403, data: { status: 'error', message: 'Only the main account or a property admin can change this property.' } });
  assert.equal(denied.error, 'Only the main account or a property admin can change this property. (HTTP 403)');
  assert.equal(denied.errors, null);
  const invalid = propertyUpdateFailure({ status: 422, data: { status: 'error', message: 'Validation failed', errors: { image: ['The image must be a file of type: jpeg, png, jpg, gif, webp.'] } } });
  assert.deepEqual(invalid.errors, { image: ['The image must be a file of type: jpeg, png, jpg, gif, webp.'] });
  assert.equal(propertyImageErrorMessage(invalid), 'The image must be a file of type: jpeg, png, jpg, gif, webp.', 'the field message wins');
  assert.equal(propertyUpdateFailure({ status: 500, data: { message: 'The image could not be uploaded. Please try again.' } }).error,
    'The image could not be uploaded. Please try again. (HTTP 500)');
});

test('update failure: a proxy 413 (an HTML page) says the server refused the size, without promising 10MB', () => {
  const big = propertyUpdateFailure({ status: 413, data: null });
  assert.match(big.error, /too large/);
  assert.match(big.error, /HTTP 413/);
  assert.doesNotMatch(big.error, /10 ?MB/, 'the proxy limit can be lower than the API\'s 10MB');
});

test('update failure: no JSON, or no answer at all, still says what happened', () => {
  assert.equal(propertyUpdateFailure({ status: 502, data: null }).error, 'The server could not save the property (HTTP 502). Please try again.');
  const offline = propertyUpdateFailure({ networkError: 'Failed to fetch' });
  assert.match(offline.error, /Could not reach the server/);
  assert.match(offline.error, /Failed to fetch/);
  assert.equal(propertyUpdateFailure({ status: 404, data: { error: 'Property not found.' } }).error, 'Property not found. (HTTP 404)');
});
