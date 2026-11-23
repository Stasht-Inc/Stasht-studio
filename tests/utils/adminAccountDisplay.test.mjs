// tests/utils/adminAccountDisplay.test.mjs — node --test (Node >= 22.18, imports the TypeScript source).
// Chris 23 Nov 2026: Choose Account showed the account Neolegend Sports is an admin of as "Admin Account 1" with an "A".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountInitials, adminAccountDisplay, adminAccountsAfterChoice, adminRowUser, initialsInk } from '../../utils/adminSwitchAccounts.ts';

const royal = { owner_id: 959, role: 'admin', owner: { id: 708, external_user_id: 959, name: 'Royal Wood Shop', email: 'hello@royalwood.test', profile_image: 'https://cdn.test/rw.png', profile_color: 'ff8800', location: 'Ontario' } };

test('a sign-in row shows the business name, logo and email like the Personal row', () => {
  const d = adminAccountDisplay(royal);
  assert.equal(d.name, 'Royal Wood Shop');
  assert.equal(d.email, 'hello@royalwood.test');
  assert.equal(d.image, 'https://cdn.test/rw.png');
  assert.equal(d.color, '#ff8800');
  assert.equal(d.initials, 'RW');
});

test('no name: the email is the name (not repeated underneath); no email: the phone; nothing: never "Admin Account 1"', () => {
  const noName = adminAccountDisplay({ owner: { name: '  ', email: 'biz@x.test' } });
  assert.deepEqual([noName.name, noName.email, noName.initials], ['biz@x.test', '', 'B']);
  assert.equal(adminAccountDisplay({ owner: { phone_number: '+14165550100' } }).name, '+14165550100');
  assert.equal(adminAccountDisplay({ owner_name: 'Partial Biz', owner_email: 'p@x.test', owner: null }).name, 'Partial Biz');
  const nothing = adminAccountDisplay({ owner: null });
  assert.equal(nothing.name, 'Admin account');
  assert.doesNotMatch(nothing.name, /\d/);
});

test('a stored admin_switch_data row (user) reads the same way, colour with or without #', () => {
  const d = adminAccountDisplay({ owner_id: '959', user: { name: 'Serpa Chrysler', email: 's@serpa.test', profile_color: '#123456' } });
  assert.deepEqual([d.name, d.email, d.color, d.image], ['Serpa Chrysler', 's@serpa.test', '#123456', null]);
  assert.equal(adminAccountDisplay({ user: { name: 'X', profile_color: 'not-a-colour' } }).color, null);
});

test('admin_switch_data keeps picture, colour and phone for the profile menu', () => {
  assert.deepEqual(adminRowUser(royal), { name: 'Royal Wood Shop', email: 'hello@royalwood.test', location: 'Ontario', profile_image: 'https://cdn.test/rw.png', profile_color: 'ff8800', phone_number: '' });
  assert.equal(adminRowUser({ owner_id: 1, owner: null }), null);
  const rows = adminAccountsAfterChoice([royal, { owner_id: 5, owner: { phone_number: '+14165550100' } }], { owner_id: '1' }, null, '');
  assert.equal(rows[0].user.profile_color, 'ff8800');
  assert.equal(rows[1].user.phone_number, '+14165550100');
});

test('initials and their ink', () => {
  assert.equal(accountInitials('neolegend sports club'), 'NS');
  assert.equal(accountInitials('7 Eleven'), '7E');
  assert.equal(initialsInk('#FFFF00'), '#1f2937');
  assert.equal(initialsInk('#1f1f6f'), '#ffffff');
});
