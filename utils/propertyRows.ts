// Users → Properties: what a property row means and which actions it offers.
//
// The properties API (getUserProperties) sends, per row:
//   account_type  'internal' | 'external'  — external = a separate full account (signed up via a property invite)
//   is_active     boolean                  — the real on/off switch (deactivate / reactivate)
//   can_manage    boolean                  — may this user deactivate / reactivate / delete it
//   account_created_for_property boolean   — external only: the account was made for this property (delete closes
//                                            it); false = an existing account that joined (delete only unlinks)
//   delete_closes_account boolean          — external only: whether DELETE would close the account; when present
//                                            it decides the delete text (else account_created_for_property does)
//   user_id       the property account's id (for external rows: the account we switch into)
//   status        legacy: a computed invite status ('active'/'inactive'/'pending_payment') on own rows,
//                 the raw column (1/0) on shared rows
//
// Older API responses have none of the new fields. Then rows behave as they do today:
//   - never opened as an account (no account_type / account_created_for_property → property view, no
//     login-as-admin guess);
//   - active state read from `status` (1/true/'1'/'active' = active, 0/false/'0'/'inactive' = inactive);
//   - can_manage assumed true (the API itself refuses, and the toast shows its message);
//   - the Type badge shows the old property_type.

export type PropertyRow = {
  name?: unknown;
  user_id?: unknown;
  is_creator?: unknown;
  property_type?: unknown;
  status?: unknown;
  account_type?: unknown;
  is_active?: unknown;
  can_manage?: unknown;
  account_created_for_property?: unknown;
  delete_closes_account?: unknown;
} | null | undefined;

export type BadgeTone = 'green' | 'red' | 'orange' | 'gray';

export type PropertyRowActions = {
  canManage: boolean;
  toggle: { label: 'Deactivate' | 'Reactivate'; nextActive: boolean } | null;
  canDelete: boolean;
  view: { mode: 'account' | 'property'; disabled: boolean; note: 'Deactivated' | null };
};

function lower(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

/** A yes/no the API may send as a boolean, 0/1 or '0'/'1'. null when it is not one. */
function flag(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const text = lower(value);
  if (text === '1' || text === 'true') return true;
  if (text === '0' || text === 'false') return false;
  return null;
}

export function propertyAccountType(row: PropertyRow): 'internal' | 'external' | null {
  const type = lower(row?.account_type);
  return type === 'internal' || type === 'external' ? type : null;
}

/** True only when the API says so (account_type 'external'). Missing account_type → false (see top). */
export function isExternalProperty(row: PropertyRow): boolean {
  return propertyAccountType(row) === 'external';
}

/** Opening it switches into that account (login-as-admin) rather than the property view. Only what the API's
 * login-as-admin allows: someone else's external property whose account was made for this property
 * (account_created_for_property true), that this user may manage (the main account and the property's admins;
 * reps / viewers keep the property view; missing can_manage = as before), with an account id to switch to.
 * A joined / linked account, or a row without the flag, keeps today's property view. */
export function opensAsFullAccount(row: PropertyRow): boolean {
  if (!isExternalProperty(row) || flag(row?.is_creator) === true || flag(row?.can_manage) === false) return false;
  if (flag(row?.account_created_for_property) !== true) return false;
  const ownerId = row?.user_id;
  return ownerId !== null && ownerId !== undefined && String(ownerId).trim() !== '';
}

export function propertyIsActive(row: PropertyRow): boolean {
  const active = flag(row?.is_active);
  if (active !== null) return active;
  const status = lower(row?.status);
  if (status === 'inactive') return false;
  if (status === 'active') return true;
  return flag(row?.status) ?? true;
}

export function propertyTypeLabel(row: PropertyRow): 'Internal' | 'External' | null {
  const type = propertyAccountType(row) ?? lower(row?.property_type);
  if (type === 'internal') return 'Internal';
  if (type === 'external') return 'External';
  return null;
}

export function propertyStatusBadge(row: PropertyRow): { label: string; tone: BadgeTone } {
  if (flag(row?.is_active) === false) return { label: 'Inactive', tone: 'red' }; // deactivated wins over payment state
  if (lower(row?.status) === 'pending_payment') return { label: 'Pending Payment', tone: 'orange' };
  return propertyIsActive(row) ? { label: 'Active', tone: 'green' } : { label: 'Inactive', tone: 'red' };
}

export function propertyRowActions(row: PropertyRow): PropertyRowActions {
  const canManage = flag(row?.can_manage) ?? true;
  const active = propertyIsActive(row);
  const asAccount = opensAsFullAccount(row);
  const blocked = asAccount && !active;
  return {
    canManage,
    toggle: canManage ? (active ? { label: 'Deactivate', nextActive: false } : { label: 'Reactivate', nextActive: true }) : null,
    canDelete: canManage,
    view: { mode: asAccount ? 'account' : 'property', disabled: blocked, note: blocked ? 'Deactivated' : null },
  };
}

export function deletePropertyMessage(row: PropertyRow): string {
  if (isExternalProperty(row)) {
    const name = row?.name === null || row?.name === undefined ? '' : String(row.name).trim();
    const label = name || 'this property';
    // The API says whether this delete closes the account (delete_closes_account). Without that field: only an
    // account made for this property is closed; missing both (older API) → the unlink wording, so the dialog
    // never promises a close that won't happen.
    const closes = flag(row?.delete_closes_account) ?? flag(row?.account_created_for_property);
    if (closes === true) {
      return `Removes ${label} from your properties and closes their account: they can't sign in, its own campaigns, leads and newsletters are removed and any subscription is cancelled. Campaigns you transferred to it come back to you.`;
    }
    return `Removes ${label} from your properties. Their own account stays open — you just lose access to it. Campaigns you transferred to it come back to you.`;
  }
  return 'Removes the property. Campaigns in it come back to your account — nothing is deleted.';
}

/** The success toast after DELETE /properties/{id}: `account_closed` and `campaigns_returned` from the API
 * (at the body's top level or under data). An older API sends neither: "… was removed from your properties." */
export function deletePropertyToast(name: string, response: any): string {
  const body = response?.data;
  const pick = (key: string) => body?.data?.[key] ?? body?.[key];
  const label = String(name ?? '').trim();
  const head = flag(pick('account_closed')) === true
    ? `${label ? `${label}'s` : "The property's"} account was closed.`
    : `${label || 'The property'} was removed from your properties.`;
  const returned = Number(pick('campaigns_returned'));
  if (!Number.isFinite(returned) || returned <= 0) return head;
  return `${head} ${returned} campaign${returned === 1 ? '' : 's'} came back to you.`;
}

/** Sign-in rows used to lack account_type / user_id / account_created_for_property; only then is the full row
 * read from /properties. */
export function needsFullPropertyRow(row: PropertyRow): boolean {
  const type = propertyAccountType(row);
  if (!type) return true;
  if (type === 'external' && (row?.account_created_for_property === undefined || row?.account_created_for_property === null)) return true;
  const ownerId = row?.user_id;
  return ownerId === null || ownerId === undefined || String(ownerId).trim() === '';
}

/** The row for property `id` in a getProperties response (any of its list shapes), or null. */
export function findPropertyRow(response: any, id: unknown): any | null {
  const want = String(id ?? '');
  if (!want) return null;
  const containers = [response?.data, response?.data?.data, response];
  for (const box of containers) {
    if (!box || typeof box !== 'object') continue;
    for (const key of ['shared_properties', 'owned_properties', 'properties', 'all_properties']) {
      const list = box[key];
      if (!Array.isArray(list)) continue;
      const hit = list.find((p: any) => p && String(p.id) === want);
      if (hit) return hit;
    }
  }
  return null;
}
