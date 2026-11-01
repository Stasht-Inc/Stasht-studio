// tests/utils/salespersonLanding.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// A salesperson = an account made for a main account's external property (account_type 'external',
// account_created_for_property true, the property's user_id = the salesperson's own stash id). They sign in
// to their own account and are never put in the property view of that property. The API may also leave the
// row out of owned_properties entirely; both shapes must land in the account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCarPhotoId,
  mediaItemIsReadOnly,
  withoutOwnExternalProperties,
  ownStashId,
  isOwnExternalProperty,
  visiblePropertyLists,
  visiblePropertyCounts,
  resolvePendingPropertySwitch,
  cachedPropertyViewIsOwnAccount,
  inventoryItemIsReadOnly,
  carOwnerAuthor,
} from '../../utils/salespersonLanding.ts';

// Bon Sun: users.id 120, stash (external_user_id) 966. Property 96 was made for him by Serpa (stash 889).
const bon = { id: 120, external_user_id: 966, name: 'Bon Sun' };
const serpa = { id: 708, external_user_id: 889, name: 'Serpa Chrysler' };
const bonsOwnRow = { id: 96, name: 'Bon Sun', account_type: 'external', account_created_for_property: true, user_id: 966, is_creator: true };
const internalRow = { id: 12, name: 'Downtown', account_type: 'internal', user_id: 889, is_creator: true };
const bonAsSeenBySerpa = { id: 96, name: 'Bon Sun', account_type: 'external', account_created_for_property: true, user_id: 966, is_creator: false, can_manage: true };

test('own stash id is external_user_id, falling back to id only when it is missing', () => {
  assert.equal(ownStashId(bon), '966');
  assert.equal(ownStashId({ id: 5 }), '5');
  assert.equal(ownStashId({ id: 5, external_user_id: null }), '5');
  assert.equal(ownStashId(null), null);
  assert.equal(ownStashId({}), null);
});

test('the salesperson\'s own external, created-for row is recognised (flags as boolean, 1 or "1")', () => {
  assert.equal(isOwnExternalProperty(bonsOwnRow, bon), true);
  assert.equal(isOwnExternalProperty({ ...bonsOwnRow, account_created_for_property: 1, user_id: '966' }, bon), true);
  assert.equal(isOwnExternalProperty({ ...bonsOwnRow, account_created_for_property: '1' }, bon), true);
  assert.equal(isOwnExternalProperty({ ...bonsOwnRow, account_type: 'External' }, bon), true);
  // An explicit API marker is enough on an external row.
  assert.equal(isOwnExternalProperty({ id: 96, account_type: 'external', is_own_account: true }, bon), true);
});

test('everything else is not the own account: internal, joined, someone else\'s, older rows, no user', () => {
  assert.equal(isOwnExternalProperty(internalRow, serpa), false, 'internal property of the main account');
  assert.equal(isOwnExternalProperty({ ...internalRow, user_id: 966 }, bon), false, 'internal property the user created');
  assert.equal(isOwnExternalProperty({ ...bonsOwnRow, account_created_for_property: false }, bon), false, 'joined account');
  assert.equal(isOwnExternalProperty({ ...bonsOwnRow, account_created_for_property: undefined }, bon), false, 'older API: no flag');
  assert.equal(isOwnExternalProperty(bonAsSeenBySerpa, serpa), false, 'the main account sees its salesperson\'s row');
  assert.equal(isOwnExternalProperty({ id: 96, name: 'Bon Sun', user_id: 966 }, bon), false, 'older API: no account_type');
  assert.equal(isOwnExternalProperty({ id: 96, account_type: 'internal', is_own_account: true }, bon), false);
  assert.equal(isOwnExternalProperty(bonsOwnRow, null), false);
  assert.equal(isOwnExternalProperty(null, bon), false);
  // users.id must not be confused with the stash id when external_user_id is known.
  assert.equal(isOwnExternalProperty({ ...bonsOwnRow, user_id: 120 }, bon), false);
});

test('property lists drop only the own external row, and say how many went', () => {
  const otherShared = { id: 40, name: 'Partner lot', account_type: 'external', account_created_for_property: true, user_id: 501 };
  const lists = visiblePropertyLists({ owned: [bonsOwnRow, internalRow], shared: [otherShared] }, bon);
  assert.deepEqual(lists.owned.map((p) => p.id), [12]);
  assert.deepEqual(lists.shared.map((p) => p.id), [40], 'someone else\'s external property stays');
  assert.equal(lists.removedOwned, 1);
  assert.equal(lists.removedShared, 0);

  const serpaLists = visiblePropertyLists({ owned: [internalRow], shared: [bonAsSeenBySerpa] }, serpa);
  assert.deepEqual(serpaLists.owned, [internalRow], 'main account unchanged');
  assert.deepEqual(serpaLists.shared, [bonAsSeenBySerpa], 'main account still opens the salesperson\'s account');
  assert.equal(serpaLists.removedOwned + serpaLists.removedShared, 0);

  // API that already omits the row: nothing to drop.
  const omitted = visiblePropertyLists({ owned: [], shared: [] }, bon);
  assert.deepEqual(omitted, { owned: [], shared: [], removedOwned: 0, removedShared: 0 });

  // Junk-tolerant: missing lists, null entries.
  const junk = visiblePropertyLists({ owned: undefined, shared: [null, bonsOwnRow] }, bon);
  assert.deepEqual(junk.owned, []);
  assert.deepEqual(junk.shared, [null]);
  assert.equal(junk.removedShared, 1);
});

test('counts from the API lose the dropped rows and never go negative', () => {
  assert.deepEqual(visiblePropertyCounts({ owned: 2, shared: 1, total: 3 }, 1, 0), { owned: 1, shared: 1, total: 2 });
  assert.deepEqual(visiblePropertyCounts({ owned: 1, shared: 0, total: 1 }, 1, 0), { owned: 0, shared: 0, total: 0 });
  assert.deepEqual(visiblePropertyCounts({ owned: 0, shared: 0, total: 0 }, 1, 1), { owned: 0, shared: 0, total: 0 });
  assert.deepEqual(visiblePropertyCounts({ owned: 4, shared: 2, total: 6 }, 0, 0), { owned: 4, shared: 2, total: 6 });
});

test('pending property switch: a main account still opens its property', () => {
  assert.deepEqual(resolvePendingPropertySwitch('12', [internalRow, bonAsSeenBySerpa], serpa), { action: 'switch', property: internalRow });
  assert.deepEqual(resolvePendingPropertySwitch('first', [internalRow], serpa), { action: 'switch', property: internalRow });
  assert.deepEqual(resolvePendingPropertySwitch(12, [null, internalRow], serpa), { action: 'switch', property: internalRow });
});

test('pending property switch: the salesperson\'s own property is never opened, the flag is cleared', () => {
  assert.deepEqual(resolvePendingPropertySwitch('96', [bonsOwnRow], bon), { action: 'clear' });
  assert.deepEqual(resolvePendingPropertySwitch('first', [bonsOwnRow], bon), { action: 'clear' });
  // Another property is still the "first" one when they have one.
  assert.deepEqual(resolvePendingPropertySwitch('first', [bonsOwnRow, { ...internalRow, user_id: 966 }], bon),
    { action: 'switch', property: { ...internalRow, user_id: 966 } });
  // API omitted the row: nothing to open, so the flag goes (no endless "Loading Stasht Studio...").
  assert.deepEqual(resolvePendingPropertySwitch('96', [], bon), { action: 'clear' });
  assert.deepEqual(resolvePendingPropertySwitch('first', [], bon), { action: 'clear' });
  assert.deepEqual(resolvePendingPropertySwitch('first', undefined, bon), { action: 'clear' });
});

test('no pending flag: nothing to do', () => {
  assert.deepEqual(resolvePendingPropertySwitch(null, [internalRow], serpa), { action: 'none' });
  assert.deepEqual(resolvePendingPropertySwitch('', [internalRow], serpa), { action: 'none' });
});

test('cached property view of the salesperson\'s own property goes back to the account', () => {
  // Flags on the stored row.
  assert.equal(cachedPropertyViewIsOwnAccount(bonsOwnRow, bon), true);
  // Stored before the flags existed: decided by the fresh row ...
  const stale = { id: 96, name: 'Bon Sun', user_id: 966 };
  assert.equal(cachedPropertyViewIsOwnAccount(stale, bon), false, 'no fresh list: cannot tell, keep it');
  assert.equal(cachedPropertyViewIsOwnAccount(stale, bon, [bonsOwnRow]), true);
  // ... or, when the API no longer lists it, by it being theirs (their own internal one would be listed).
  assert.equal(cachedPropertyViewIsOwnAccount(stale, bon, []), true);
  assert.equal(cachedPropertyViewIsOwnAccount({ id: 77, user_id: 889 }, bon, []), false, 'someone else\'s, unlisted: unchanged');
});

test('cached property view: main account and internal properties are unchanged', () => {
  assert.equal(cachedPropertyViewIsOwnAccount(internalRow, serpa), false);
  assert.equal(cachedPropertyViewIsOwnAccount(internalRow, serpa, [internalRow]), false);
  assert.equal(cachedPropertyViewIsOwnAccount({ ...internalRow, user_id: 966 }, bon, [{ ...internalRow, user_id: 966 }]), false);
  assert.equal(cachedPropertyViewIsOwnAccount(null, bon, []), false);
  assert.equal(cachedPropertyViewIsOwnAccount(bonsOwnRow, null, []), false);
});

test('inventory rows: own or unknown stay editable; parent\'s rows are read-only', () => {
  assert.equal(inventoryItemIsReadOnly({ id: 1 }, bon), false, 'no ownership hint: today\'s behaviour');
  assert.equal(inventoryItemIsReadOnly({ id: 1, user_id: 966 }, bon), false, 'own car');
  assert.equal(inventoryItemIsReadOnly({ id: 1, user_id: 889 }, bon), true, 'parent\'s car');
  assert.equal(inventoryItemIsReadOnly({ id: 1, user_id: '889' }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, read_only: true }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, is_read_only: 1 }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, can_edit: false }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, can_manage: 0 }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, is_owner: false }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, is_own: false }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, is_parent_inventory: true }, bon), true);
  assert.equal(inventoryItemIsReadOnly({ id: 1, user_id: 889, can_edit: true }, serpa), false, 'main account\'s own car');
  assert.equal(inventoryItemIsReadOnly({ id: 1, user_id: 889 }, null), false, 'no signed-in user known: unchanged');
  assert.equal(inventoryItemIsReadOnly(null, bon), false);
});

// API (1 Nov): every row carries is_own_external_account; sign-in omits the own row, GET /properties keeps it flagged.
test('is_own_external_account true marks the own row, on its own', () => {
  assert.equal(isOwnExternalProperty({ id: 96, name: 'Bon Sun', is_own_external_account: true }, bon), true);
  assert.equal(isOwnExternalProperty({ id: 96, is_own_external_account: 1 }, bon), true);
  assert.equal(isOwnExternalProperty({ id: 96, is_own_external_account: true }, null), true, 'the API decided: no user needed');
  assert.equal(isOwnExternalProperty({ ...internalRow, is_own_external_account: false }, serpa), false);
  assert.equal(isOwnExternalProperty({ ...bonAsSeenBySerpa, is_own_external_account: false }, serpa), false, 'main account: its salesperson stays');
});

test('invite sign-up (pending "first") with GET /properties listing only the flagged own row: stays in the account', () => {
  const listed = { id: 96, name: 'Bon Sun', user_id: 966, account_type: 'external', is_own_external_account: true };
  assert.deepEqual(resolvePendingPropertySwitch('first', [listed], bon), { action: 'clear' });
  assert.deepEqual(resolvePendingPropertySwitch('96', [listed], bon), { action: 'clear' });
});

test('Users → Properties: the own row is hidden, everything else kept', () => {
  const listed = { id: 96, name: 'Bon Sun', is_own_external_account: true };
  const other = { id: 40, name: 'Partner lot', account_type: 'external', is_own_external_account: false };
  assert.deepEqual(withoutOwnExternalProperties([listed, other, bonsOwnRow], bon), [other]);
  assert.deepEqual(withoutOwnExternalProperties([internalRow, bonAsSeenBySerpa], serpa), [internalRow, bonAsSeenBySerpa]);
  assert.deepEqual(withoutOwnExternalProperties(undefined, bon), []);
});

test('an explicit read_only false is final: no user_id fallback', () => {
  assert.equal(inventoryItemIsReadOnly({ id: 1, read_only: false, user_id: 889 }, bon), false);
  assert.equal(inventoryItemIsReadOnly({ id: 1, read_only: 0, user_id: 889 }, bon), false);
  assert.equal(inventoryItemIsReadOnly({ id: 1, read_only: '0', user_id: 889 }, bon), false);
  assert.equal(inventoryItemIsReadOnly({ id: 1, read_only: true, user_id: 966 }, bon), true, 'read_only true wins too');
});

// A car campaign's posts are its own memory_images; car photos (car_images) only exist on a car's own page, as
// posts with id car_image_<id>. Only those are deleted with is_car=1.
test('only car_image_<id> posts are car photos', () => {
  assert.equal(isCarPhotoId('car_image_77'), true);
  assert.equal(isCarPhotoId('car_image_x'), false);
  assert.equal(isCarPhotoId('car_photo_0'), false, 'a car photo without an id cannot be deleted at all');
  assert.equal(isCarPhotoId('1234'), false, 'a campaign\'s own photo, even in a car campaign');
  assert.equal(isCarPhotoId(1234), false);
  assert.equal(isCarPhotoId(null), false);
});

test('a media item is read-only when it says so, or when it is a photo of a read-only linked car', () => {
  const linked = [
    { id: 501, is_car: true, user_id: 889, read_only: true },
    { id: 502, is_car: true, user_id: 966, read_only: false },
    { id: 9, title: 'A linked campaign', user_id: 889 },
  ];
  assert.equal(mediaItemIsReadOnly({ id: '10', car_id: 501 }, linked, bon), true, 'parent\'s car photo');
  assert.equal(mediaItemIsReadOnly({ id: '11', car_id: 502 }, linked, bon), false, 'own car photo');
  assert.equal(mediaItemIsReadOnly({ id: '12' }, linked, bon), false, 'the campaign\'s own upload');
  assert.equal(mediaItemIsReadOnly({ id: '13', read_only: true }, linked, bon), true);
  assert.equal(mediaItemIsReadOnly({ id: '14', car_id: 9 }, linked, bon), false, 'only car entries count');
  assert.equal(mediaItemIsReadOnly({ id: '15', car_id: 501 }, undefined, bon), false, 'no linked list: unchanged');
  assert.equal(mediaItemIsReadOnly(null, linked, bon), false);
});

test("a read-only car's card names its owner (the API's owner block), never the signed-in salesperson", () => {
  const serpaCar = { id: 501, user_id: 889, read_only: true, owner: { id: 889, name: 'Serpa Chrysler', profile_image: 'https://cdn.test/serpa.png', profile_color: '1d4ed8' } };
  assert.deepEqual(carOwnerAuthor(serpaCar), { name: 'Serpa Chrysler', avatar: 'https://cdn.test/serpa.png', profile_color: '1d4ed8' });
  // No photo or colour: the name alone (the card shows the initial, never Bon's photo).
  assert.deepEqual(carOwnerAuthor({ ...serpaCar, owner: { id: 889, name: 'Serpa Chrysler', profile_image: null, profile_color: null } }),
    { name: 'Serpa Chrysler', avatar: '', profile_color: '' });
  assert.deepEqual(carOwnerAuthor({ ...serpaCar, owner: { id: 889, name: 'Serpa Chrysler', profile_image: 'null' } }).avatar, '');
  // No name: an empty author (no author line) rather than the signed-in account.
  assert.deepEqual(carOwnerAuthor({ ...serpaCar, owner: { id: 889, name: null } }), { name: '', avatar: '', profile_color: '' });
});

test('own cars, and read-only rows from an API without the owner block, keep today\'s author', () => {
  assert.equal(carOwnerAuthor({ id: 7, user_id: 966, read_only: false }), null);
  assert.equal(carOwnerAuthor({ id: 7, user_id: 966, read_only: false, owner: { name: 'Bon Sun' } }), null);
  assert.equal(carOwnerAuthor({ id: 7, user_id: 966 }), null);
  assert.equal(carOwnerAuthor({ id: 501, user_id: 889, read_only: true }), null);
  assert.equal(carOwnerAuthor(null), null);
});
