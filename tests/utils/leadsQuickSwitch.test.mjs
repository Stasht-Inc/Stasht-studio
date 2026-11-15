// tests/utils/leadsQuickSwitch.test.mjs — node --test (imports the TypeScript source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quickSwitchAccounts, quickSwitchState, unreadBadge, accountInitials } from '../../utils/leadsQuickSwitch.ts';

const personal = { id: 1300, name: 'Christian Beckermann', email: 'c@test', profile_color: 'D9915B' };
const switchData = (extra = {}) => ({
  has_admin_access: true,
  current_mode: 'personal',
  personal_account: { user: personal, token: 't' },
  admin_accounts: [
    { owner_id: '959', user: { name: 'TheRoyalWoodShop', email: 'o@royal.test' }, token: '' },
    { owner_id: 'property_12', user: { name: 'A property' }, token: '' },
  ],
  ...extra,
});
const api = [
  { owner_id: 959, name: 'TheRoyalWoodShop', email: 'o@royal.test', profile_image: 'https://x/logo.png', role: 'admin', unread: 4 },
  { owner_id: 958, name: 'Stasht', email: 's@test', role: 'partial_admin', unread: 0 },
];

test('server list wins (with unread, partial flag); property rows never listed', () => {
  const a = quickSwitchAccounts(switchData(), api);
  assert.deepEqual(a.map((x) => [x.ownerId, x.unread, x.partial]), [['959', 4, false], ['958', 0, true]]);
  assert.equal(a[0].image, 'https://x/logo.png');
});

test('API failed: Profile menu rows without counts, no property rows', () => {
  const a = quickSwitchAccounts(switchData(), null);
  assert.deepEqual(a.map((x) => [x.ownerId, x.unread]), [['959', null]]);
});

test('personal mode lists accounts; nobody with no accounts sees nothing', () => {
  assert.equal(quickSwitchState(switchData(), api).mode, 'personal');
  assert.equal(quickSwitchState(null, []).mode, 'none');
  assert.equal(quickSwitchState(null, null).mode, 'none');
  assert.equal(quickSwitchState(switchData(), api, true).mode, 'none', 'property view');
});

test('switched into a business: back to personal + the other accounts', () => {
  const s = quickSwitchState(switchData({ current_mode: 'admin', current_admin_owner_id: '959' }), api);
  assert.equal(s.mode, 'business');
  assert.equal(s.current.ownerId, '959');
  assert.equal(s.personal.name, 'Christian Beckermann');
  assert.deepEqual(s.others.map((x) => x.ownerId), ['958']);
});

test('switched into an external property (not an admin account): nothing', () => {
  assert.equal(quickSwitchState(switchData({ current_mode: 'admin', current_admin_owner_id: '777' }), api).mode, 'none');
});

test('badge and initials', () => {
  assert.equal(unreadBadge(0), '');
  assert.equal(unreadBadge(null), '');
  assert.equal(unreadBadge(7), '7');
  assert.equal(unreadBadge(140), '99+');
  assert.equal(accountInitials('TheRoyalWoodShop'), 'TH');
  assert.equal(accountInitials('Royal Wood Shop'), 'RW');
});
