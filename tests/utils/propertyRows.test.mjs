// tests/utils/propertyRows.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  propertyAccountType,
  isExternalProperty,
  opensAsFullAccount,
  propertyIsActive,
  propertyTypeLabel,
  propertyStatusBadge,
  propertyRowActions,
  deletePropertyMessage,
} from '../../utils/propertyRows.ts';

// Rows as the new API sends them (getUserProperties).
const internalRow = {
  id: 1, name: 'Pedalheads North', user_id: 707, is_creator: true, user_role: 'admin',
  property_type: 'internal', status: 'inactive', account_type: 'internal', is_active: true, can_manage: true,
};
const externalActive = {
  id: 2, name: 'Bob Bozic', user_id: 901, parent_user_id: 707, is_creator: false, user_role: 'admin',
  property_type: 'external', status: 1, account_type: 'external', is_active: true, can_manage: true,
};
const externalInactive = { ...externalActive, id: 3, name: 'Sam Seller', user_id: 902, status: 0, is_active: false };
const externalNoManage = { ...externalActive, id: 4, name: 'Rita Rep', user_id: 903, user_role: 'viewer', can_manage: false };

test('account type comes from account_type only', () => {
  assert.equal(propertyAccountType(internalRow), 'internal');
  assert.equal(propertyAccountType(externalActive), 'external');
  assert.equal(propertyAccountType({ account_type: 'EXTERNAL' }), 'external');
  assert.equal(propertyAccountType({ property_type: 'external' }), null);
  assert.equal(propertyAccountType({ account_type: 'other' }), null);
  assert.equal(propertyAccountType(null), null);
});

test('external = account_type external; older API (no account_type) is never treated as external', () => {
  assert.equal(isExternalProperty(externalActive), true);
  assert.equal(isExternalProperty(internalRow), false);
  // Old API: shared rows say property_type 'external' and the user may even be an admin of it — still not
  // an external account, so we keep today's property view and never call login-as-admin on a guess.
  assert.equal(isExternalProperty({ property_type: 'external', is_creator: false, user_role: 'admin', user_id: 5 }), false);
});

test('only someone else\'s external property opens as a full account', () => {
  assert.equal(opensAsFullAccount(externalActive), true);
  assert.equal(opensAsFullAccount(externalInactive), true); // shown, but disabled (see actions)
  assert.equal(opensAsFullAccount(internalRow), false);
  // The external account looking at its own property: it is already that account.
  assert.equal(opensAsFullAccount({ ...externalActive, is_creator: true }), false);
  // No owner id to switch to → keep property view.
  assert.equal(opensAsFullAccount({ ...externalActive, user_id: null }), false);
});

test('is_active wins; older API falls back to the status field', () => {
  assert.equal(propertyIsActive(internalRow), true); // status 'inactive' is only the invite-link state
  assert.equal(propertyIsActive(externalInactive), false);
  assert.equal(propertyIsActive({ is_active: 0 }), false);
  assert.equal(propertyIsActive({ is_active: '1' }), true);
  assert.equal(propertyIsActive({ status: 1 }), true);
  assert.equal(propertyIsActive({ status: '0' }), false);
  assert.equal(propertyIsActive({ status: 'active' }), true);
  assert.equal(propertyIsActive({ status: 'inactive' }), false);
  assert.equal(propertyIsActive({ status: true }), true);
  assert.equal(propertyIsActive({}), true);
});

test('type label: Internal / External, older API keeps property_type', () => {
  assert.equal(propertyTypeLabel(internalRow), 'Internal');
  assert.equal(propertyTypeLabel(externalActive), 'External');
  assert.equal(propertyTypeLabel({ property_type: 'external' }), 'External');
  assert.equal(propertyTypeLabel({ property_type: 'internal' }), 'Internal');
  assert.equal(propertyTypeLabel({}), null);
});

test('status badge: Active / Inactive, never "Internal"; pending payment first', () => {
  assert.deepEqual(propertyStatusBadge(internalRow), { label: 'Active', tone: 'green' });
  assert.deepEqual(propertyStatusBadge(externalActive), { label: 'Active', tone: 'green' });
  assert.deepEqual(propertyStatusBadge(externalInactive), { label: 'Inactive', tone: 'red' });
  assert.deepEqual(propertyStatusBadge({ status: '1' }), { label: 'Active', tone: 'green' });
  assert.deepEqual(propertyStatusBadge({ status: 'pending_payment', is_active: true }), { label: 'Pending Payment', tone: 'orange' });
});

test('row actions: deactivate / reactivate / delete only when the API says can_manage', () => {
  assert.deepEqual(propertyRowActions(internalRow), {
    canManage: true, toggle: { label: 'Deactivate', nextActive: false }, canDelete: true,
    view: { mode: 'property', disabled: false, note: null },
  });
  assert.deepEqual(propertyRowActions(externalActive), {
    canManage: true, toggle: { label: 'Deactivate', nextActive: false }, canDelete: true,
    view: { mode: 'account', disabled: false, note: null },
  });
  assert.deepEqual(propertyRowActions(externalInactive), {
    canManage: true, toggle: { label: 'Reactivate', nextActive: true }, canDelete: true,
    view: { mode: 'account', disabled: true, note: 'Deactivated' },
  });
  assert.deepEqual(propertyRowActions(externalNoManage), {
    canManage: false, toggle: null, canDelete: false,
    view: { mode: 'account', disabled: false, note: null },
  });
});

test('row actions on an older API (no can_manage / is_active / account_type) behave as today', () => {
  const legacy = { id: 9, name: 'Old', is_creator: true, property_type: 'internal', status: 'active' };
  assert.deepEqual(propertyRowActions(legacy), {
    canManage: true, toggle: { label: 'Deactivate', nextActive: false }, canDelete: true,
    view: { mode: 'property', disabled: false, note: null },
  });
  const legacyShared = { id: 10, name: 'Shared', is_creator: false, property_type: 'external', status: 0, user_id: 5 };
  assert.deepEqual(propertyRowActions(legacyShared).view, { mode: 'property', disabled: false, note: null });
  assert.deepEqual(propertyRowActions(legacyShared).toggle, { label: 'Reactivate', nextActive: true });
});

test('delete message says exactly what happens', () => {
  assert.equal(
    deletePropertyMessage(externalActive),
    "Removes Bob Bozic from your properties. If this account was created for this property, it's closed: they can't sign in, its own campaigns, leads and newsletters are removed and any subscription is cancelled. Campaigns you transferred to it come back to you.",
  );
  assert.equal(deletePropertyMessage(internalRow), 'Removes the property. Campaigns in it come back to your account — nothing is deleted.');
  assert.equal(deletePropertyMessage({ ...externalActive, name: '  ' }).startsWith('Removes this property from your properties.'), true);
});

test('delete toast follows the API answer', async () => {
  const { deletePropertyToast } = await import('../../utils/propertyRows.ts');
  // apiRequest hands back the JSON body as response.data; the fields may sit at its top level or under data.
  assert.equal(deletePropertyToast('Bob Bozic', { success: true, data: { success: true, data: { account_closed: true, campaigns_returned: 3 } } }),
    "Bob Bozic's account was closed. 3 campaigns came back to you.");
  assert.equal(deletePropertyToast('Bob Bozic', { success: true, data: { success: true, account_closed: false, campaigns_returned: 1 } }),
    'Bob Bozic was removed from your properties. 1 campaign came back to you.');
  assert.equal(deletePropertyToast('Pedalheads North', { success: true, data: { account_closed: false, campaigns_returned: 0 } }),
    'Pedalheads North was removed from your properties.');
  assert.equal(deletePropertyToast('Pedalheads North', { success: true, data: { data: { account_closed: 'false', campaigns_returned: '2' } } }),
    'Pedalheads North was removed from your properties. 2 campaigns came back to you.');
  // Older API: no fields.
  assert.equal(deletePropertyToast('Old', { success: true, data: { message: 'Property deleted' } }), 'Old was removed from your properties.');
  assert.equal(deletePropertyToast('', { success: true, data: { account_closed: true } }), "The property's account was closed.");
});

test('login rows that already carry account_type and user_id need no extra lookup', async () => {
  const { needsFullPropertyRow } = await import('../../utils/propertyRows.ts');
  assert.equal(needsFullPropertyRow({ id: 2, account_type: 'external', user_id: 901, is_active: true }), false);
  assert.equal(needsFullPropertyRow({ id: 2, account_type: 'internal', user_id: 707 }), false);
  assert.equal(needsFullPropertyRow({ id: 2, name: 'Old login row' }), true);
  assert.equal(needsFullPropertyRow({ id: 2, account_type: 'external' }), true);
});

test('findPropertyRow finds a row in any properties list shape', async () => {
  const { findPropertyRow } = await import('../../utils/propertyRows.ts');
  const row = { id: 2, name: 'Bob Bozic', account_type: 'external' };
  assert.deepEqual(findPropertyRow({ data: { owned_properties: [], shared_properties: [row] } }, 2), row);
  assert.deepEqual(findPropertyRow({ data: { data: { properties: [row] } } }, '2'), row);
  assert.equal(findPropertyRow({ data: { shared_properties: [row] } }, 3), null);
  assert.equal(findPropertyRow(null, 2), null);
});
