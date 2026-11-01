// Names and initials for leads, which may have no account (guest submissions, website-widget forms with the Name
// field hidden): GET /lead-groups sends such a member's name as null. Pure, so `node --test` loads it directly.

/** Up to two initials from the first two words with a letter; "?" when there is no name (or nothing to show). */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const initials = words.slice(0, 2).map((w) => (w.match(/\p{L}/u) ?? [''])[0]).join('').toUpperCase();
  return initials || '?';
}

/** A lead group member's shown name: their name, else how they can be reached (when sent), else "Guest". */
export function groupMemberName(member: { name?: string | null; email?: string | null; phone?: string | null }): string {
  return member.name?.trim() || member.email?.trim() || member.phone?.trim() || 'Guest';
}
