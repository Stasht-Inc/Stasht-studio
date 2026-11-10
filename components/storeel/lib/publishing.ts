// Chris 8 Nov 2026 (b), point 2: on the campaign page "Publish" is replaced by "Send", which opens the Storeel stepper
// (Edit Campaign) at its Send card; Edit still opens it at step 1. Every publish option moves into the stepper's
// "Publishing" section, at the top of the Send card (Deepak, 9 Nov 2026) — nothing is removed: Publish as View Only / Public / Private (the access-token
// link), Unpublish, and the published link's tools. Same calls as before (the campaign page's handlePublish).
// Pure, so `node --test` loads it.

/** POST /memories/{id}/publish roles, in the order the Publish menus have always listed them. */
export const PUBLISH_CHOICES = [
  { key: 'view-only', role: 2, title: 'Publish as View Only', description: 'Users can only view the campaign, no comments allowed' },
  { key: 'public', role: 1, title: 'Publish as Public', description: 'Anyone can view and leave comments' },
  { key: 'private', role: 3, title: 'Publish as Private', description: 'Only visible with a valid access token' },
] as const;

export type PublishRole = 1 | 2 | 3;

const LABELS: Record<PublishRole, 'Public' | 'View Only' | 'Private'> = { 1: 'Public', 2: 'View Only', 3: 'Private' };

/** memories.published as one number (review fix: every check uses this): 1 public, 2 view only, 3 private
 *  (access-token link); a numeric string counts; anything else = 0, not published. */
export function publishedRole(published: unknown): 0 | PublishRole {
  const n = typeof published === 'number' ? published : typeof published === 'string' && published.trim() !== '' ? Number(published) : NaN;
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

export function publishStatus(published: unknown): { live: boolean; role: PublishRole | null; label: 'Public' | 'View Only' | 'Private' | null } {
  const n = publishedRole(published);
  if (n) return { live: true, role: n, label: LABELS[n] };
  return { live: false, role: null, label: null };
}

/** The Publishing section at the top of the Send card (Deepak, 9 Nov 2026: "publish on Send", one card). */
export const PUBLISHING_SECTION_ID = 'st-publishing';

/** The section's line, as Save & Send behaves (Chris 9 Nov 2026, point 6: the options are one choice that Save & Send
 *  applies): unpublished → sending publishes it with the chosen option; private → it can't be sent as it is;
 *  public / view only → nothing to say. */
export function publishingLine(published: unknown): string | null {
  const role = publishedRole(published);
  if (role === 0) return 'Not published yet. Save & Send publishes it with the option chosen below, or use Publish now to publish it without sending.';
  if (role === 3) return "Private link only: it can't be sent. Choose Public or View Only to send it.";
  return null;
}

/** The option chosen when the card opens (Chris 9 Nov 2026: "Publish as Public should be selected already by
 *  default"): Public when not published, else the mode it is in. */
export function defaultPublishChoice(published: unknown): PublishRole {
  return publishedRole(published) || 1;
}

/** "Publish now" (publish without sending): when not published, or when another mode is chosen on a published one. */
export function canPublishNow(published: unknown, choice: PublishRole): boolean {
  const role = publishedRole(published);
  return role === 0 || role !== choice;
}

/** The line under the options: why Private can't be sent, or that another mode switches a published campaign. */
export function publishChoiceNote(published: unknown, choice: PublishRole): string | null {
  const role = publishedRole(published);
  if (choice === role) return null;
  if (choice === 3) return "A Private campaign can't be sent: only people with its private link can open it. Publish now makes that link.";
  return role === 0 ? null : `Save & Send or Publish now changes it to ${LABELS[choice]}.`;
}

/** What happens at once, without Save Changes (everything else on the page waits for it). */
export function rightAwayLine(published: unknown, choice: PublishRole): string {
  const live = publishedRole(published) !== 0;
  if (!live) return "Publish now applies right away. It doesn't need Save Changes.";
  return canPublishNow(published, choice)
    ? "Publish now and Unpublish apply right away. They don't need Save Changes."
    : "Unpublish applies right away. It doesn't need Save Changes.";
}

/** The mode Save & Send sends in: the chosen one, else as the API does without one (unpublished → Public). */
export function sendRoleFor(published: unknown, choice: PublishRole | null | undefined): PublishRole {
  return choice ?? defaultPublishChoice(published);
}

/** Why Save & Send is off for the chosen option: a Private (access-token) campaign can't be sent. */
export function choiceSendProblem(choice: PublishRole | null | undefined): string | null {
  return choice === 3 ? "Choose Public or View Only in Publishing. A Private campaign can't be sent." : null;
}

/** The send confirm's line about the campaign: published now (in the chosen mode), or switched to another mode. */
export function confirmPublishLine(published: unknown, choice: PublishRole | null | undefined): string | null {
  const role = publishedRole(published);
  const target = sendRoleFor(published, choice);
  if (target === 3) return null;
  if (role === 0) return `Sending publishes your campaign (${LABELS[target]}), so people can open it.`;
  return target !== role ? `Sending changes your campaign to ${LABELS[target]}.` : null;
}

export type StepperOpensAt = 'campaign' | 'send';

/** Where the stepper scrolls when it opens: Send → the Send card; Edit → the top (step 1). */
export function opensAtTarget(opensAt: StepperOpensAt | undefined | null): string | null {
  return opensAt === 'send' ? 'st-step-send' : null;
}

/** The stepper edits a saved campaign (numeric id). Anything else keeps the old Publish control on the page. */
export function campaignCanOpenStepper(memoryId: unknown): boolean {
  return /^\d+$/.test(String(memoryId ?? ''));
}

/** The send confirm on a private (access-token) campaign: publish it another way first — now in the Publishing card. */
export const PRIVATE_LINK_SEND_LINE = 'This campaign is shared by private link only. Publish it as Public or View Only at the top of the Send card, then send it.';

/** Review I1: "Publish now" switched a published campaign (switch_role) but the answer says it ended in another mode —
 *  an API without switch_role toggled it off. Studio then publishes it again in the chosen mode, once. Only when the
 *  answer says its mode: a second call on the new API would toggle it off. */
export function switchNeedsRepublish({ switchRole, wasPublished, role, reply }: {
  switchRole: boolean; wasPublished: boolean; role: number; reply: unknown;
}): boolean {
  if (!switchRole || !wasPublished || !reply || typeof reply !== 'object' || !('published' in reply)) return false;
  return Number((reply as { published: unknown }).published) !== role;
}
