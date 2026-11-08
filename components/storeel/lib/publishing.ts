// Chris 8 Nov 2026 (b), point 2: on the campaign page "Publish" is replaced by "Send", which opens the Storeel stepper
// (Edit Campaign) at its Send card; Edit still opens it at step 1. Every publish option moves into the stepper's
// "Publishing" card (4, after Send) — nothing is removed: Publish as View Only / Public / Private (the access-token
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

export const PUBLISHING_STEP_ID = 'st-step-publishing';

/** The card after 1 Campaign · 2 Moments · 3 Send (only on a saved campaign opened from its page). */
export function publishingStepNumber(): number {
  return 4;
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
export const PRIVATE_LINK_SEND_LINE = 'This campaign is shared by private link only. Publish it as Public or View Only in Publishing (below), then send it.';
