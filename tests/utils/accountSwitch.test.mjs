// tests/utils/accountSwitch.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDifferentAccount, accountLabel } from '../../utils/accountSwitch.ts';

const stasht = JSON.stringify({ id: 707, name: 'Stasht', email: 'developers@stasht.com' });
const royal = JSON.stringify({ id: 708, name: 'TheRoyalWoodShop', email: 'bgerrits@royalwoodshop.com' });

test('switching to another account counts as a change', () => {
  assert.equal(isDifferentAccount(stasht, royal), true);
  assert.equal(isDifferentAccount(royal, stasht), true);
});

test('the same account saved again is not a change', () => {
  const refreshed = JSON.stringify({ id: 707, name: 'Stasht Inc', email: 'developers@stasht.com', location: 'Toronto' });
  assert.equal(isDifferentAccount(stasht, refreshed), false);
});

test('ids compare as strings (the API sends numbers or strings)', () => {
  assert.equal(isDifferentAccount(stasht, JSON.stringify({ id: '707' })), false);
});

test('without ids, falls back to email or phone', () => {
  assert.equal(isDifferentAccount(JSON.stringify({ email: 'a@x.com' }), JSON.stringify({ email: 'b@x.com' })), true);
  assert.equal(isDifferentAccount(JSON.stringify({ phone_number: '+1555' }), JSON.stringify({ phone_number: '+1555' })), false);
});

test('sign-in, sign-out and unreadable values are not account switches', () => {
  assert.equal(isDifferentAccount(null, royal), false);
  assert.equal(isDifferentAccount(royal, null), false);
  assert.equal(isDifferentAccount('not json', royal), false);
  assert.equal(isDifferentAccount(JSON.stringify({}), royal), false);
});

test('accountLabel names the account plainly', () => {
  assert.equal(accountLabel(royal), 'TheRoyalWoodShop');
  assert.equal(accountLabel(JSON.stringify({ email: 'a@x.com' })), 'a@x.com');
  assert.equal(accountLabel(JSON.stringify({ name: '  ' , phone_number: '+1555' })), '+1555');
  assert.equal(accountLabel('nope'), null);
  assert.equal(accountLabel(null), null);
});

test('isApiRequest matches Stasht API calls only', async () => {
  const { isApiRequest } = await import('../../utils/accountSwitch.ts');
  assert.equal(isApiRequest('/api/react/newsletters'), true);
  assert.equal(isApiRequest('https://studio.stasht.com/api/react/memories'), true);
  assert.equal(isApiRequest('https://restapi.stasht.com/public/x'), true);
  assert.equal(isApiRequest('/sso-api/sso/exchange'), true);
  assert.equal(isApiRequest('/assets/index.js'), false);
  assert.equal(isApiRequest('https://fonts.googleapis.com/css2'), false);
});

test('one side without an id compares by email (no false switch)', () => {
  assert.equal(isDifferentAccount(stasht, JSON.stringify({ email: 'developers@stasht.com' })), false);
  assert.equal(isDifferentAccount(stasht, JSON.stringify({ email: 'bgerrits@royalwoodshop.com' })), true);
});
