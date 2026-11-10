// A lead link (/leads?lead=N, the "X messaged you via your website" email's "Open conversation") that opens a lead
// the current account's Leads list doesn't have (10 Nov 2026). GET /leads/{id}/locate says where the lead lives; this
// decides what to do with that answer.
//
// Team leads in your own account (Chris 10 Nov 2026: "she should have seen the lead in her account and respond from
// there"): an Admin / Partial Admin signed in as themselves now finds the account's leads in their OWN Leads list, so a
// lead link never switches into the business any more (the Profile menu's "Switch to …" stays for campaigns etc.).
// Switched into some account, they are taken back to their own account when the lead is listed there.

export type LeadLocation = {
  lead_id?: number;
  access?: 'owner' | 'admin' | 'partial_admin' | 'none' | string;
  visible_here?: boolean;
  is_here?: boolean;
  owner?: { external_user_id?: number | string; name?: string | null; email?: string | null } | null;
  // The token was minted by a switch into some account (Profile → Switch to …).
  switched_in?: boolean;
  // The lead is in the person's own Leads list (team leads in your own account).
  visible_in_own_account?: boolean;
};

export type LeadLinkAction =
  | { kind: 'personal' }
  | { kind: 'message'; text: string };

export const NOT_AVAILABLE = 'This lead is no longer available — a teammate may have accepted it.';
export const NO_ACCESS = "This lead belongs to an account you don't have access to. Ask its owner to add you as an admin.";

export function leadLinkAction(loc: LeadLocation | null | undefined, hint?: string | null): LeadLinkAction {
  if (!loc || !loc.access) return { kind: 'message', text: hint ? `This lead was ${hint}.` : 'This lead could not be found.' };
  // Already in the lead's account (or it is visible here): the list hides it, so it was taken or closed.
  if (loc.is_here) return { kind: 'message', text: hint ? `This lead was ${hint}.` : NOT_AVAILABLE };
  if (loc.access === 'owner') return { kind: 'personal' };
  if (loc.access === 'admin' || loc.access === 'partial_admin') {
    // Switched into another account: their own account lists it. Otherwise it is hidden from them (taken / closed).
    if (loc.switched_in && loc.visible_in_own_account) return { kind: 'personal' };
    return { kind: 'message', text: hint ? `This lead was ${hint}.` : NOT_AVAILABLE };
  }
  return { kind: 'message', text: NO_ACCESS };
}

/** The lead link to come back to after a switch (the page reloads into the new account). */
export const leadLinkUrl = (leadId: number) => `/leads?lead=${encodeURIComponent(String(leadId))}`;
