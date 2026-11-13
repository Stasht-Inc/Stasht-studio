// tests/utils/messageSignoff.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 13 Nov 2026: Brenna (a Royal Wood team Admin switched into Royal Wood) got "— TheRoyalWoodShop at Chris Becks"
// on "+ Send Message". The sender must be the real person; "at …" the business, never an External person's account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actingPerson, messageSignoff, propertyNamesBusiness } from '../../utils/messageSignoff.ts';

const royalWood = { id: 959, external_user_id: 959, name: 'TheRoyalWoodShop', email: 'owner@royalwood.test' };
const brenna = { id: 1201, external_user_id: 1201, name: 'Brenna Weidrick', email: 'bweidrick@royalwood.test' };
const chrisBecksExternal = { id: 103, name: 'Chris Becks', account_type: 'external', account_created_for_property: true, user_id: 1300, parent_user_id: 959 };

const switchedIn = {
  has_admin_access: true,
  current_mode: 'admin',
  current_admin_owner_id: '959',
  personal_account: { user: brenna, token: 'brenna-token' },
  admin_accounts: [{ owner_id: '959', user: royalWood, token: 'royal-token' }],
};

test('switched-in admin: "Brenna at TheRoyalWoodShop", not the External account', () => {
  const acting = actingPerson(switchedIn, royalWood, 'royal-token');
  assert.equal(acting, brenna);
  const s = messageSignoff({ account: royalWood, acting, property: chrisBecksExternal });
  assert.equal(s.who, 'Brenna at TheRoyalWoodShop');
  assert.equal(s.business, 'TheRoyalWoodShop');
});

test('Serpa salesperson in their External view: "Bob at Serpa Chrysler"', () => {
  const bob = { id: 1500, external_user_id: 1500, name: 'Bob Bozic' };
  const ownExternal = {
    id: 77, name: 'Bob Bozic', account_type: 'external', account_created_for_property: true, is_own_external_account: true,
    user_id: 1500, invited_by: { name: 'Serpa Chrysler', external_user_id: 700 },
  };
  const s = messageSignoff({ account: bob, acting: actingPerson(null, bob, 't'), property: ownExternal, viewProperty: ownExternal });
  assert.equal(s.who, 'Bob at Serpa Chrysler');
  assert.equal(s.business, 'Serpa Chrysler');
});

test('the owner themselves: "TheRoyalWoodShop" alone, never "X at X"', () => {
  assert.equal(actingPerson(null, royalWood, 'royal-token'), null);
  const s = messageSignoff({ account: royalWood, acting: null, property: chrisBecksExternal });
  assert.equal(s.who, 'TheRoyalWoodShop');
  assert.doesNotMatch(s.who, / at /);
});

test('an External person account is never the business; unknown-kind rows neither', () => {
  assert.equal(propertyNamesBusiness(chrisBecksExternal), false);
  assert.equal(propertyNamesBusiness({ id: 5, name: 'Chris Becks' }), false); // my-properties row without account_type
  assert.equal(propertyNamesBusiness({ id: 6, name: 'Point Grey', account_type: 'internal' }), true);
  const s = messageSignoff({ account: royalWood, acting: brenna, property: { id: 5, name: 'Chris Becks' } });
  assert.equal(s.who, 'Brenna at TheRoyalWoodShop');
});

test('a real internal property names the business', () => {
  const s = messageSignoff({ account: royalWood, acting: brenna, property: { id: 6, name: 'Point Grey', account_type: 'internal' } });
  assert.equal(s.who, 'Brenna at Point Grey');
});

test('stale switch data (another sign-in) is not an acting person', () => {
  const other = { id: 42, name: 'Someone Else' };
  assert.equal(actingPerson(switchedIn, other, 'other-token'), null);
});

test('sender unknown: the business alone', () => {
  const s = messageSignoff({ account: royalWood, acting: { id: 9, name: '' } });
  assert.equal(s.who, 'TheRoyalWoodShop');
});
