// A lead link (/leads?lead=N, the "X messaged you via your website" email's "Open conversation") that opens a lead
// the current account's Leads list doesn't have (10 Nov 2026). Widget lead recipients are usually Admins / Partial
// Admins of the lead's account signed in as themselves: Studio used to say "a teammate may have accepted it" although
// nobody had. GET /leads/{id}/locate says where the lead lives; this decides what to do with that answer.

export type LeadLocation = {
  lead_id?: number;
  access?: 'owner' | 'admin' | 'partial_admin' | 'none' | string;
  visible_here?: boolean;
  is_here?: boolean;
  owner?: { external_user_id?: number | string; name?: string | null; email?: string | null } | null;
};

export type LeadLinkAction =
  | { kind: 'switch'; ownerId: string; partial: boolean; ownerEmail: string; ownerName: string }
  | { kind: 'personal' }
  | { kind: 'message'; text: string };

export const NOT_AVAILABLE = 'This lead is no longer available — a teammate may have accepted it.';
export const NO_ACCESS = "This lead belongs to an account you don't have access to. Ask its owner to add you as an admin.";

export function leadLinkAction(loc: LeadLocation | null | undefined, hint?: string | null): LeadLinkAction {
  if (!loc || !loc.access) return { kind: 'message', text: hint ? `This lead was ${hint}.` : 'This lead could not be found.' };
  // Already in the lead's account (or it is visible here): the list hides it, so it was taken or closed.
  if (loc.is_here) return { kind: 'message', text: hint ? `This lead was ${hint}.` : NOT_AVAILABLE };
  if (loc.access === 'owner') return { kind: 'personal' };
  const ownerId = String(loc.owner?.external_user_id ?? '').trim();
  if ((loc.access === 'admin' || loc.access === 'partial_admin') && ownerId) {
    return {
      kind: 'switch',
      ownerId,
      partial: loc.access === 'partial_admin',
      ownerEmail: String(loc.owner?.email ?? ''),
      ownerName: String(loc.owner?.name || 'that account'),
    };
  }
  return { kind: 'message', text: NO_ACCESS };
}

/** The lead link to come back to after a switch (the page reloads into the new account). */
export const leadLinkUrl = (leadId: number) => `/leads?lead=${encodeURIComponent(String(leadId))}`;
