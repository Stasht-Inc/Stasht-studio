// Chris, 7 Nov 2026 (point 12): Moderation per campaign. memories.moderation_enabled NULL = follow the account's
// setting (notification_preferences.moderation_enabled); 1 / 0 = the campaign's own choice. Pure, so `node --test` loads it.

/** GET /user/notification-preferences: the account's moderation setting — on unless it says off (as the campaign page assumes). */
export function accountModerationFrom(res: unknown): boolean {
  const r = res as { success?: boolean; status?: number; data?: { data?: { moderation_enabled?: unknown } } } | null;
  if (!r || !(r.success || r.status === 1)) return true;
  const v = r.data?.data?.moderation_enabled;
  return v === false || v === 0 || v === '0' ? false : true;
}

/** What the Storeel page's switch shows: the person's choice, else the campaign's value, else the account's, else on. */
export function shownModeration({ choice, campaign, account }: { choice: boolean | null; campaign: boolean | null; account: boolean | null }): boolean {
  return choice ?? campaign ?? account ?? true;
}

/** A campaign's moderation from GET /memories/{id}: moderation_effective, else its own value, else unknown (null). */
export function campaignModerationOf(memory: Record<string, any> | null | undefined): boolean | null {
  if (!memory) return null;
  if (typeof memory.moderation_effective === 'boolean') return memory.moderation_effective;
  const own = memory.moderation_enabled;
  if (own === null || own === undefined || own === '') return null;
  return own === true || Number(own) === 1;
}

/**
 * The campaign page's Moderation tab. Role 3 / 4: never. Role 2: the owner, once the account's setting has loaded, when
 * the campaign's effective value is on (its own value, else the account's). Other roles: the owner (as before).
 */
export function moderationTabVisible({ role, isOwner, loaded, campaign, account }: {
  role: unknown; isOwner: boolean; loaded: boolean; campaign: boolean | null; account: boolean;
}): boolean {
  const r = String(role ?? '');
  if (r === '3' || r === '4') return false;
  if (r === '2') return loaded && isOwner && (campaign ?? account);
  return isOwner;
}
