// Salesperson accounts land in their own account, never in the property view of their own property.
//
// A salesperson is an account made for a main account's external property: the main account (e.g. Serpa
// Chrysler) invited them with an account-invite link, which created a full account of their own plus a property
// row with account_type 'external', account_created_for_property true and user_id = the salesperson's own stash
// id (external_user_id). Their sign-in used to list that row in owned_properties, so the account-choice modal
// offered it and picking it put them in a "Property" view of their own account. They must get their full account
// (Campaigns, Leads, Newsletters, Media, Users ...) instead.
//
// The API may send that row with those flags, or leave it out of owned_properties altogether; everything here
// works with both. Internal properties, joined (not created-for) accounts, someone else's external property and
// the main account's view of its salespeople are untouched. Rows from an older API without account_type are
// never treated as the user's own account.
//
// Inventory: inside their own account a salesperson also sees the main account's cars and website-catalogue
// items, read-only. inventoryItemIsReadOnly hides edit/delete on rows that are not theirs.

type Row = Record<string, any> | null | undefined;

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

function present(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/** The signed-in account's stash id (external_user_id); its id only when external_user_id is missing. */
export function ownStashId(user: unknown): string | null {
  const u = user as { external_user_id?: unknown; id?: unknown } | null | undefined;
  if (!u) return null;
  if (present(u.external_user_id)) return String(u.external_user_id).trim();
  if (present(u.id)) return String(u.id).trim();
  return null;
}

/** `user`, or the signed-in user stored in localStorage when the caller has none yet (null if neither). */
export function signedInUserOr(user: unknown): unknown {
  if (user) return user;
  try {
    if (typeof localStorage === 'undefined') return null;
    return JSON.parse(localStorage.getItem('stasht_user') || 'null');
  } catch {
    return null;
  }
}

/** True when this property row is the signed-in user's own account: a row the API marks
 * is_own_external_account, an external property made for them (account_created_for_property true) whose user_id
 * is their stash id, or an external row marked is_own_account. */
export function isOwnExternalProperty(row: Row, user: unknown): boolean {
  if (!row) return false;
  // The API's own answer (1 Nov): every row says whether it is the signed-in account's own external account.
  if (flag(row.is_own_external_account) === true) return true;
  if (lower(row.account_type) !== 'external') return false;
  const me = ownStashId(user);
  if (!me) return false;
  if (flag(row.is_own_account) === true) return true;
  if (flag(row.account_created_for_property) !== true) return false;
  return present(row.user_id) && String(row.user_id).trim() === me;
}

/** A property list without the user's own external property (Users → Properties: opening it would be pointless). */
export function withoutOwnExternalProperties<T = any>(rows: T[] | null | undefined, user: unknown): T[] {
  return (Array.isArray(rows) ? rows : []).filter((p) => !isOwnExternalProperty(p as Row, user));
}

export type VisiblePropertyLists<T> = { owned: T[]; shared: T[]; removedOwned: number; removedShared: number };

/** owned / shared property lists without the user's own external property (see top). */
export function visiblePropertyLists<T = any>(
  lists: { owned?: T[] | null; shared?: T[] | null },
  user: unknown,
): VisiblePropertyLists<T> {
  const owned = Array.isArray(lists.owned) ? lists.owned : [];
  const shared = Array.isArray(lists.shared) ? lists.shared : [];
  const keptOwned = owned.filter((p) => !isOwnExternalProperty(p as Row, user));
  const keptShared = shared.filter((p) => !isOwnExternalProperty(p as Row, user));
  return {
    owned: keptOwned,
    shared: keptShared,
    removedOwned: owned.length - keptOwned.length,
    removedShared: shared.length - keptShared.length,
  };
}

/** The API's property counts less the rows visiblePropertyLists dropped (never below 0). */
export function visiblePropertyCounts(
  counts: { owned: number; shared: number; total: number },
  removedOwned: number,
  removedShared: number,
): { owned: number; shared: number; total: number } {
  const less = (n: number, by: number) => Math.max(0, (Number(n) || 0) - by);
  return {
    owned: less(counts.owned, removedOwned),
    shared: less(counts.shared, removedShared),
    total: less(counts.total, removedOwned + removedShared),
  };
}

export type PendingPropertySwitch = { action: 'switch'; property: any } | { action: 'clear' } | { action: 'none' };

/**
 * What to do with localStorage 'pending_property_switch' (a property id, or 'first') once the properties list
 * has loaded: switch into that property's view, or clear the flag and stay in the account. The user's own
 * external property is never a target. When nothing matches (the API leaves the salesperson's row out, or the
 * property is gone) the flag is cleared — App blocks rendering while it is pending, so keeping it would leave
 * "Loading Stasht Studio..." on screen for good.
 */
export function resolvePendingPropertySwitch(
  pendingId: unknown,
  properties: unknown,
  user: unknown,
): PendingPropertySwitch {
  if (!present(pendingId)) return { action: 'none' };
  const rows = (Array.isArray(properties) ? properties : []).filter((p) => p !== null && p !== undefined);
  const visible = rows.filter((p) => !isOwnExternalProperty(p, user));
  const target = String(pendingId).trim() === 'first'
    ? visible[0]
    : visible.find((p: any) => String(p?.id) === String(pendingId).trim());
  return target ? { action: 'switch', property: target } : { action: 'clear' };
}

/**
 * True when a stored property view (localStorage view_type 'property' + selected_property) is the user's own
 * account and must go back to the account view. Decided by the stored row's flags; a row stored before the
 * flags existed is decided by the fresh row from /properties (`freshRows`), and — when the API no longer
 * lists it at all — by it being theirs (user_id = their stash id; their own internal property would be listed).
 * Without fresh rows an unflagged row is kept as it is.
 */
export function cachedPropertyViewIsOwnAccount(selected: Row, user: unknown, freshRows?: unknown[] | null): boolean {
  if (!selected || !ownStashId(user)) return false;
  if (isOwnExternalProperty(selected, user)) return true;
  if (!Array.isArray(freshRows)) return false;
  const fresh = freshRows.find((p: any) => p && String(p.id) === String(selected.id));
  if (fresh) return isOwnExternalProperty(fresh as Row, user);
  return present(selected.user_id) && String(selected.user_id).trim() === ownStashId(user);
}

/** Every property row of a getProperties response (owned, shared and the older list shapes). */
export function allPropertyRows(response: any): any[] {
  const d = response?.data?.data || response?.data || {};
  return [
    ...(Array.isArray(d.owned_properties) ? d.owned_properties : []),
    ...(Array.isArray(d.shared_properties) ? d.shared_properties : []),
    ...(Array.isArray(d.all_properties) ? d.all_properties : Array.isArray(d.properties) ? d.properties : []),
  ];
}

/**
 * A car or website-catalogue row the signed-in account may only look at (and share): the main account's
 * inventory shown to its salesperson. read_only, when the API sends it, decides (true or false). Otherwise read from
 * another hint (is_read_only / is_parent_inventory true, or can_edit / can_manage / is_owner / is_own false), else
 * from user_id differing from the signed-in stash id. Rows without any hint keep today's behaviour.
 */
export function inventoryItemIsReadOnly(item: Row, user: unknown): boolean {
  if (!item) return false;
  // The API's answer is final either way (cars, catalogue items and linked car entries carry it since 1 Nov).
  const readOnly = flag(item.read_only);
  if (readOnly !== null) return readOnly;
  for (const key of ['is_read_only', 'is_parent_inventory']) {
    if (flag(item[key]) === true) return true;
  }
  for (const key of ['can_edit', 'can_manage', 'is_owner', 'is_own']) {
    if (flag(item[key]) === false) return true;
  }
  const me = ownStashId(user);
  if (!me || !present(item.user_id)) return false;
  return String(item.user_id).trim() !== me;
}

/** A car photo (a car_images row) as a car's own page shows it: post id `car_image_<id>`. A car campaign's other
 * posts are its own memory_images and are deleted as such (never with is_car=1). */
export function isCarPhotoId(id: unknown): boolean {
  return typeof id === 'string' && /^car_image_\d+$/.test(id);
}

/**
 * A campaign's photo the signed-in account may not select / edit / delete: one the API marks read_only, or a photo
 * of a linked car (car_id) whose linked entry (GET /memories/{id} linked_memories, is_car) is read-only — the main
 * account's car in its salesperson's own campaign. The campaign's own uploads stay editable.
 */
export function mediaItemIsReadOnly(item: Row, linkedMemories: unknown, user: unknown): boolean {
  if (!item) return false;
  if (flag(item.read_only) === true) return true;
  if (!present(item.car_id) || !Array.isArray(linkedMemories)) return false;
  const car = linkedMemories.find((m: any) => m && flag(m.is_car) === true && String(m.id) === String(item.car_id));
  return !!car && inventoryItemIsReadOnly(car as Row, user);
}
