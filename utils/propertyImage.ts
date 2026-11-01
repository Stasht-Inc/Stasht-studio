// A property's own business image (properties.image, Chris 1 Nov 2026).
//
// Set from Users → Properties → ⋯ → Edit Property ("Property Image") and from the camera button on the property
// view's avatar (the top of the profile dropdown). Both send POST /properties/{id}/update with an `image` file.
// The API lets the main account, the property's admins and the property's own account change it (the same
// people the API's PropertyAccounts::canManage allows, plus the property's own account) and takes PNG, JPG, GIF
// and WebP up to 10MB.
//
// Every property avatar (header, dropdown card, property lists) shows the property's own image first. Only when
// it has none does it fall back to the inviter's logo (invited_by, when someone else invited the viewer), then to
// the building icon. Before, the inviter's logo always won, so a property's own image never showed in the
// property view of an invited account.

type Row = Record<string, any> | null | undefined;

export const PROPERTY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROPERTY_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const PROPERTY_IMAGE_ACCEPT = PROPERTY_IMAGE_TYPES.join(',');

const FALLBACK_ERROR = 'The image could not be uploaded. Please try again.';

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

/** The viewer's stash id (external_user_id), its id only when that is missing (as utils/salespersonLanding). */
function ownStashId(viewer: unknown): string | null {
  const v = viewer as { external_user_id?: unknown; id?: unknown } | null | undefined;
  if (!v) return null;
  if (present(v.external_user_id)) return String(v.external_user_id).trim();
  if (present(v.id)) return String(v.id).trim();
  return null;
}

function imageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  return url && url.toLowerCase() !== 'null' ? url : null;
}

/** Why this file can't be a property image, or null when it can. */
export function propertyImageFileError(file: { type?: string; size?: number } | null | undefined): string | null {
  if (!file) return 'Please choose an image.';
  if (!PROPERTY_IMAGE_TYPES.includes(lower(file.type))) return 'Please choose a PNG, JPG, GIF or WebP image.';
  if (Number(file.size) > PROPERTY_IMAGE_MAX_BYTES) return 'The image is larger than 10MB. Please choose a smaller one.';
  return null;
}

/**
 * What a property's avatar shows: its own image, else the inviter's logo when someone other than the viewer
 * invited them (invited_by: an object or a one-item list), else null (the building icon). invitedBy is returned
 * either way, for the "invited by" name line.
 */
export function propertyAvatarImage(property: Row, viewer: unknown): { image: string | null; invitedBy: any | null } {
  const invitedByRaw = property?.invited_by;
  const invitedBy = (Array.isArray(invitedByRaw) ? invitedByRaw[0] : invitedByRaw) || null;
  const own = imageUrl(property?.image);
  if (own) return { image: own, invitedBy };
  const me = String((viewer as any)?.external_user_id ?? '');
  const invitedBySomeoneElse = !!invitedBy && me !== String(invitedBy.external_user_id ?? '');
  return { image: invitedBySomeoneElse ? imageUrl(invitedBy.profile_image) : null, invitedBy };
}

/**
 * May the viewer change this property's image? The property's own account (its user_id is the viewer's stash id, or
 * the row is one the viewer created) always; otherwise the API's answer (can_manage) when it is yes, except on
 * someone else's external property not made for its account (a linked account: only that account may). A row stored
 * before can_manage existed: admins and owners too. The API checks again either way.
 */
export function canChangePropertyImage(row: Row, viewer: unknown): boolean {
  if (!row) return false;
  const me = ownStashId(viewer);
  if (!me) return false;
  const ownerId = row.user_id;
  if (ownerId !== null && ownerId !== undefined && String(ownerId).trim() === me) return true;
  // Someone else's external property whose account was not made for it (a linked account): only that account.
  if (lower(row.account_type) === 'external' && flag(row.account_created_for_property) !== true) return false;
  const canManage = flag(row.can_manage);
  if (canManage === true) return true;
  if (flag(row.is_creator) === true) return true;
  if (canManage === null) return ['admin', 'owner'].includes(lower(row.user_role));
  return false;
}

/** The text to show when an upload failed: the image field's message, any field's, the API's, or a plain one. */
export function propertyImageErrorMessage(response: any): string {
  const errors = response?.errors;
  if (errors && typeof errors === 'object') {
    const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
    const image = first(errors.image);
    if (typeof image === 'string' && image.trim()) return image;
    for (const value of Object.values(errors)) {
      const text = first(value);
      if (typeof text === 'string' && text.trim()) return text;
    }
  }
  for (const key of ['error', 'message']) {
    const text = response?.[key];
    if (typeof text === 'string' && text.trim()) return text;
  }
  return FALLBACK_ERROR;
}

/**
 * What a failed POST /properties/{id}/update reports (dashboardAPI.updateProperty): `error` is the API's own message
 * with the HTTP status, and `errors` its field errors (422). A proxy refusing a large upload (413) answers with an HTML
 * page, so its text is written here — without promising 10MB, since the proxy's limit can be lower than the API's.
 * No JSON at all: the status; no answer at all (offline, blocked): the browser's reason.
 */
export function propertyUpdateFailure(
  { status, data, networkError }: { status?: number; data?: any; networkError?: string },
): { error: string; errors: Record<string, unknown> | null } {
  if (networkError !== undefined) {
    return { error: `Could not reach the server to save the property (${networkError || 'no answer'}). Check your connection and try again.`, errors: null };
  }
  const errors = data && typeof data.errors === 'object' && data.errors !== null ? data.errors : null;
  if (status === 413) {
    return { error: 'The server refused the image because it is too large (HTTP 413). Please choose a smaller image.', errors };
  }
  for (const key of ['message', 'error']) {
    const text = data?.[key];
    if (typeof text === 'string' && text.trim()) return { error: `${text.trim()} (HTTP ${status ?? '?'})`, errors };
  }
  return { error: `The server could not save the property (HTTP ${status ?? '?'}). Please try again.`, errors };
}
