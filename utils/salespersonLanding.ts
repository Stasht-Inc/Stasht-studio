// Salesperson accounts: their External account and their personal account.
//
// A salesperson is an account made for a main account's external property: the main account (e.g. Serpa
// Chrysler) invited them with an account-invite link, which created a full account of their own plus a property
// row with account_type 'external', account_created_for_property true and user_id = the salesperson's own stash
// id (external_user_id). The API marks that row is_own_external_account for them.
//
// They choose each time they sign in (Deepak, 1 Nov 2026, after Chris: "They should still have an External
// account, and a personal account"): the account chooser lists that row as their External account, shown as
// representing the main account (its name, the main account's name and logo from invited_by, the Property
// badge), next to their personal account, under External (groupPropertyAccounts). It is opened and restored like
// any other property — the morning's version that hid it (and its helpers) is gone. In that External view they also
// get Leads (propertyViewHasLeads), and the main account's cars and website-catalogue items, read-only.
//
// Inventory: a salesperson sees the main account's cars and website-catalogue items, read-only.
// inventoryItemIsReadOnly hides edit/delete on rows that are not theirs.

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

/** The property view of this row offers Leads: only the signed-in salesperson's own External account (their own
 * leads, under their own sign-in). Every other property view keeps Campaigns / Media / Connectors only. */
export function propertyViewHasLeads(row: Row, user: unknown): boolean {
  const me = ownStashId(user);
  if (!row || !me) return false;
  if (present(row.user_id) && String(row.user_id).trim() !== me) return false;
  return isOwnExternalProperty(row, user);
}

/**
 * The account chooser's and the Profile menu's Internal / External groups (owned / shared lists): the signed-in
 * salesperson's own External account goes under External, first — Chris calls it their External account — though the
 * API lists it as owned. Everything else stays where the API put it. `moved`: how many rows went across.
 */
export function groupPropertyAccounts<T = any>(
  lists: { owned?: T[] | null; shared?: T[] | null },
  user: unknown,
): { owned: T[]; shared: T[]; moved: number } {
  const owned = Array.isArray(lists.owned) ? lists.owned : [];
  const shared = Array.isArray(lists.shared) ? lists.shared : [];
  const own = owned.filter((p) => isOwnExternalProperty(p as Row, user));
  return { owned: owned.filter((p) => !own.includes(p)), shared: [...own, ...shared], moved: own.length };
}

/** The API's owned / shared / total counts after groupPropertyAccounts moved `moved` rows to External. */
export function groupedPropertyCounts(
  counts: { owned: number; shared: number; total: number },
  moved: number,
): { owned: number; shared: number; total: number } {
  const owned = Number(counts.owned) || 0;
  const by = Math.max(0, Number(moved) || 0);
  return { owned: Math.max(0, owned - by), shared: (Number(counts.shared) || 0) + by, total: Number(counts.total) || 0 };
}

export type PropertyAccountGroup<T = any> = { key: 'properties' | 'external'; label: 'Properties' | 'External'; rows: T[] };

/**
 * The account chooser's and the Profile menu's groups after groupPropertyAccounts: "Properties" (owned) then
 * "External" (shared, a salesperson's own External account first), each only when it has rows (Chris, 1 Nov 2026:
 * "INTERNAL" reads "PROPERTIES", and the Profile menu shows two dropdowns, "Properties (N)" and "External (N)").
 */
export function propertyAccountGroups<T = any>(lists: { owned?: T[] | null; shared?: T[] | null }): PropertyAccountGroup<T>[] {
  const groups: PropertyAccountGroup<T>[] = [
    { key: 'properties', label: 'Properties', rows: Array.isArray(lists.owned) ? lists.owned : [] },
    { key: 'external', label: 'External', rows: Array.isArray(lists.shared) ? lists.shared : [] },
  ];
  return groups.filter((g) => g.rows.length > 0);
}

export type PendingPropertySwitch = { action: 'switch'; property: any } | { action: 'clear' } | { action: 'none' };

/**
 * What to do with localStorage 'pending_property_switch' (a property id, or 'first') once the properties list
 * has loaded: switch into that property's view (a salesperson's External account too, as before 1 Nov), or —
 * when nothing matches (the property is gone) — clear the flag and stay in the account. App blocks rendering
 * while it is pending, so keeping it would leave "Loading Stasht Studio..." on screen for good.
 */
export function resolvePendingPropertySwitch(pendingId: unknown, properties: unknown): PendingPropertySwitch {
  if (!present(pendingId)) return { action: 'none' };
  const rows = (Array.isArray(properties) ? properties : []).filter((p) => p !== null && p !== undefined);
  const target = String(pendingId).trim() === 'first'
    ? rows[0]
    : rows.find((p: any) => String(p?.id) === String(pendingId).trim());
  return target ? { action: 'switch', property: target } : { action: 'clear' };
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

export type CarOwnerAuthor = { name: string; avatar: string; profile_color: string };

/**
 * The author line for a read-only car's or website-catalogue product's card: its owner (the API's `owner` block on
 * GET /cars and GET /website-catalogue/items rows: the main account whose inventory the salesperson sees), never the
 * signed-in account the card would otherwise fall back to. Own rows, and read-only rows from an API without the block,
 * give null (today's author). A missing name gives an empty author, so the card shows no name rather than the
 * salesperson's.
 */
export function inventoryOwnerAuthor(item: Row): CarOwnerAuthor | null {
  if (!item || flag(item.read_only) !== true) return null;
  const owner = item.owner;
  if (!owner || typeof owner !== 'object') return null;
  const text = (value: unknown) => (typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== 'null' ? value.trim() : '');
  return { name: text(owner.name), avatar: text(owner.profile_image), profile_color: text(owner.profile_color) };
}

/** Cars' name for inventoryOwnerAuthor (the rule is the same for cars and catalogue products). */
export const carOwnerAuthor = inventoryOwnerAuthor;
