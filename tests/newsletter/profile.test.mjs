import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFromApi, mergeProfileSources, initialsFrom } from '../../components/newsletters/lib/profile.ts';

test('profileFromApi reads /user/profile keys (phone, avatar) and keeps only https images and links', () => {
  const p = profileFromApi({
    name: 'Samantha Smith', email: 'sam@serpachrysler.ca', phone: '+1 416 555 0100', avatar: 'http://insecure/x.png',
    website: 'www.serpachrysler.ca', instagram_url: 'https://instagram.com/serpa', linkedin_url: '', tiktok_url: null, facebook_url: 'http://facebook.com/serpa',
  });
  assert.equal(p.name, 'Samantha Smith');
  assert.equal(p.phone, '+1 416 555 0100');
  assert.equal(p.photoUrl, null);
  assert.equal(p.color, null);
  assert.deepEqual(p.website, { text: 'www.serpachrysler.ca', href: 'https://www.serpachrysler.ca/' });
  assert.deepEqual(p.socials.map((s) => s.key), ['instagram']);
  assert.equal(profileFromApi(null), null);
  assert.equal(profileFromApi({ website: 'http://old.example.com/' }).website.href, null);
});

test('profileFromApi falls back to the stored auth user keys (phone_number, profile_image, profile_color)', () => {
  const p = profileFromApi({ name: 'Sam', phone_number: '+1 416 555 0199', profile_image: 'https://cdn.example/me.png', profile_color: '#FF8800' });
  assert.equal(p.phone, '+1 416 555 0199');
  assert.equal(p.photoUrl, 'https://cdn.example/me.png');
  assert.equal(p.color, '#FF8800');
  assert.equal(profileFromApi({ name: 'Sam', profile_color: 'red; background:url(x)' }).color, null);
  // /user/profile's keys win over the stored ones when both are present.
  assert.equal(profileFromApi({ phone: '+1 1', phone_number: '+1 2', avatar: 'https://a.example/a.png', profile_image: 'https://b.example/b.png' }).photoUrl, 'https://a.example/a.png');
});

test('mergeProfileSources lays the API user over the stored auth user, ignoring empty API values', () => {
  const stored = { name: 'Sam', profile_image: 'https://cdn.example/me.png', phone_number: '+1 416 555 0199', profile_color: '#FF8800' };
  const api = { name: 'Samantha Smith', email: 'sam@serpachrysler.ca', phone: '+1 416 555 0100', avatar: null, website: '' };
  const p = profileFromApi(mergeProfileSources(stored, api));
  assert.equal(p.name, 'Samantha Smith');
  assert.equal(p.phone, '+1 416 555 0100');
  assert.equal(p.photoUrl, 'https://cdn.example/me.png');
  assert.equal(p.color, '#FF8800');
  assert.deepEqual(mergeProfileSources(null, null), {});
});

test('initialsFrom', () => {
  assert.equal(initialsFrom('Samantha Smith'), 'SS');
  assert.equal(initialsFrom('serpa'), 'S');
  assert.equal(initialsFrom('  '), 'S');
});
