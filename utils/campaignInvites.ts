// Pending campaign invites (the web API's "Invites" category: invited, not yet accepted) — Chris 18 Nov 2026:
// "I am not able to open this, and accept it? … It should take you here. Also Accept / Deny should always be first."

const MARKER = 'invite:';

/** What the Campaigns sidebar sends for a pending invite: show its card (Accept / Deny) on All Campaigns, not open it. */
export const inviteRevealMarker = (memoryId: string | number): string => `${MARKER}${memoryId}`;

/** The campaign id in an invite marker, or null for any other id. */
export function parseInviteRevealMarker(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(MARKER)) return null;
  const id = value.slice(MARKER.length).trim();
  return id ? id : null;
}

type CardLike = { category?: { name?: string | null } | string | null } | null | undefined;

/** A card waiting for Accept / Deny. */
export function isPendingInvite(memory: CardLike): boolean {
  if (!memory) return false;
  const name = typeof memory.category === 'string' ? memory.category : memory.category?.name;
  return name === 'Invites';
}

/** Pending invites before everything else; the given order (or `compare`) inside each group. Stable. */
export function invitesFirst<T extends CardLike>(list: readonly T[], compare?: (a: T, b: T) => number): T[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ai = isPendingInvite(a.item) ? 0 : 1;
      const bi = isPendingInvite(b.item) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      const c = compare ? compare(a.item, b.item) : 0;
      return c !== 0 ? c : a.index - b.index;
    })
    .map(({ item }) => item);
}
