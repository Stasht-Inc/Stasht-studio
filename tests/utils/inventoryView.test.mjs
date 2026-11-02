// tests/utils/inventoryView.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Deepak, 2 Nov 2026 (binding): a salesperson's personal account sees only its own cars and catalogue items; the main
// account's appear only in the External view of the salesperson's own property. Studio tells the API which view a
// request comes from with the X-Stasht-Property header — only from that External view.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROPERTY_VIEW_HEADER,
  inventoryViewPropertyId,
  propertyViewHeaders,
  setTabPropertyView,
  resetTabPropertyView,
  currentPropertyViewHeaders,
  propertyViewCacheKey,
  subscribePropertyView,
  inventoryViewRun,
} from '../../utils/inventoryView.ts';

// Bon Sun: stash 966; property 96 was made for him by Serpa (stash 889).
const bon = { id: 120, external_user_id: 966, name: 'Bon Sun' };
const serpa = { id: 708, external_user_id: 889, name: 'Serpa Chrysler' };
const bonsOwn = { id: 96, name: 'Bon Sun', user_id: 966, parent_user_id: 889, account_type: 'external', account_created_for_property: true, is_own_external_account: true };
const bonsOwnUnflagged = { id: 96, name: 'Bon Sun', user_id: 966, account_type: 'external', account_created_for_property: 1 };
const bonsLot = { id: 97, name: 'Bons Lot', user_id: 966, account_type: 'internal', is_own_external_account: false };
const serpaInternal = { id: 12, name: 'Downtown', user_id: 889, account_type: 'internal', is_own_external_account: false };
const bonAsSeenBySerpa = { id: 96, name: 'Bon Sun', user_id: 966, account_type: 'external', account_created_for_property: true, is_own_external_account: false };

function fakeStorage(values = {}) {
  const store = new Map(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

beforeEach(() => {
  resetTabPropertyView();
  delete globalThis.localStorage;
});

test('the External view of the salesperson\'s own property names it', () => {
  assert.equal(inventoryViewPropertyId('property', bonsOwn, bon), '96');
  assert.equal(inventoryViewPropertyId('property', bonsOwnUnflagged, bon), '96', 'worked out from the markers too');
  assert.deepEqual(propertyViewHeaders('property', bonsOwn, bon), { [PROPERTY_VIEW_HEADER]: '96' });
  assert.equal(PROPERTY_VIEW_HEADER, 'X-Stasht-Property');
});

test('the personal view and every other property view send nothing', () => {
  assert.equal(inventoryViewPropertyId('personal', bonsOwn, bon), null, 'personal view, even with the row still stored');
  assert.equal(inventoryViewPropertyId('property', null, bon), null);
  assert.equal(inventoryViewPropertyId('property', bonsLot, bon), null, 'his own internal property');
  assert.equal(inventoryViewPropertyId('property', serpaInternal, serpa), null, "the main account's internal property");
  assert.equal(inventoryViewPropertyId('property', bonAsSeenBySerpa, serpa), null, 'the main account viewing its salesperson');
  assert.deepEqual(propertyViewHeaders('personal', bonsOwn, bon), {});
});

test('a row from another sign-in or with a junk id sends nothing', () => {
  const someoneElse = { id: 555, external_user_id: 555 };
  assert.equal(inventoryViewPropertyId('property', bonsOwn, someoneElse), null, "the row's user_id is not the signed-in account");
  assert.equal(inventoryViewPropertyId('property', { ...bonsOwn, id: 'abc' }, bon), null);
  assert.equal(inventoryViewPropertyId('property', { ...bonsOwn, id: 0 }, bon), null);
  assert.equal(inventoryViewPropertyId('property', { ...bonsOwn, id: undefined }, bon), null);
});

test('a tab starts from the view localStorage holds when it loads', () => {
  globalThis.localStorage = fakeStorage({ view_type: 'property', selected_property: bonsOwn, stasht_user: bon });
  assert.deepEqual(currentPropertyViewHeaders(), { [PROPERTY_VIEW_HEADER]: '96' });
  assert.equal(propertyViewCacheKey(), '96');

  resetTabPropertyView();
  globalThis.localStorage = fakeStorage({ view_type: 'personal', stasht_user: bon });
  assert.deepEqual(currentPropertyViewHeaders(), {});
  assert.equal(propertyViewCacheKey(), '-');

  resetTabPropertyView();
  globalThis.localStorage = fakeStorage({ view_type: 'property', selected_property: '{not json', stasht_user: bon });
  assert.deepEqual(currentPropertyViewHeaders(), {}, 'unreadable: personal');
});

test("then follows this tab's switches, not another tab's localStorage", () => {
  globalThis.localStorage = fakeStorage({ view_type: 'personal', stasht_user: bon });
  assert.deepEqual(currentPropertyViewHeaders(), {});

  setTabPropertyView('property', bonsOwn);
  assert.deepEqual(currentPropertyViewHeaders(), { [PROPERTY_VIEW_HEADER]: '96' });

  setTabPropertyView('personal', null);
  globalThis.localStorage.setItem('view_type', 'property'); // another tab opened the External view
  globalThis.localStorage.setItem('selected_property', JSON.stringify(bonsOwn));
  assert.deepEqual(currentPropertyViewHeaders(), {}, 'this tab is still in the personal view');
});

test('a switch that changes what the API is told tells the inventory lists to load again; others do not', () => {
  globalThis.localStorage = fakeStorage({ view_type: 'personal', stasht_user: bon });
  let calls = 0;
  const stop = subscribePropertyView(() => { calls++; });
  setTabPropertyView('personal', null);
  assert.equal(calls, 0, 'the view it started in: nothing changed');
  setTabPropertyView('property', bonsOwn);
  assert.equal(calls, 1, 'personal → External view');
  setTabPropertyView('property', { ...bonsOwn, image: 'https://cdn.test/new.png' });
  assert.equal(calls, 1, 'same view, new image: no reload of the lists');
  setTabPropertyView('property', bonsLot);
  assert.equal(calls, 2, 'External view → his internal property (no header)');
  setTabPropertyView('personal', null);
  assert.equal(calls, 2, 'internal property → personal: the API is told the same (nothing)');
  stop();
  setTabPropertyView('property', bonsOwn);
  assert.equal(calls, 2, 'unsubscribed');
});

test('each view change starts a new run, so an answer asked for in the old view can be told apart and dropped', () => {
  globalThis.localStorage = fakeStorage({ view_type: 'property', selected_property: bonsOwn, stasht_user: bon });
  const asked = inventoryViewRun(); // a count request goes out in the External view
  setTabPropertyView('property', { ...bonsOwn, image: 'x.png' });
  assert.equal(inventoryViewRun(), asked, 'same view: the answer still counts');
  setTabPropertyView('personal', null); // Back to Bon Sun before it answers
  assert.notEqual(inventoryViewRun(), asked, 'switched: the External view\'s answer is stale');
  const personal = inventoryViewRun();
  setTabPropertyView('personal', null);
  assert.equal(inventoryViewRun(), personal);
});

test('the headers are worked out once per view and sign-in, and callers get their own copy', () => {
  const storage = fakeStorage({ view_type: 'property', selected_property: bonsOwn, stasht_user: bon });
  let userReads = 0;
  const getItem = storage.getItem;
  storage.getItem = (k) => { if (k === 'stasht_user') userReads++; return getItem(k); };
  globalThis.localStorage = storage;
  const first = currentPropertyViewHeaders();
  first[PROPERTY_VIEW_HEADER] = 'tampered';
  assert.deepEqual(currentPropertyViewHeaders(), { [PROPERTY_VIEW_HEADER]: '96' }, 'a caller changing its copy changes nothing');
  assert.equal(propertyViewCacheKey(), '96');
  assert.ok(userReads >= 1);
  // Another sign-in in this tab: worked out again.
  storage.setItem('stasht_user', JSON.stringify({ id: 9, external_user_id: 555 }));
  assert.deepEqual(currentPropertyViewHeaders(), {}, "the stored row isn't the new account's own");
});
