// Approve / Reject a pending moment right from the notification bell (Chris, 13 Nov 2026): "we need ability to accept
// it right away in notifications". The same endpoints as the campaign's Moderation tab (POST /memory-images/approve-image
// and /deny-image, owner only). Pure, so `node --test` loads it.

type Raw = Record<string, unknown> | null | undefined;

/**
 * Whether a bell item is a moment still waiting for this person's approval. The API says so (pending_approval, only
 * for the campaign's owner); an older API answer falls back to the guest submission's wording.
 */
export function isPendingMoment(n: Raw): boolean {
  if (!n || n.type !== 'moment' || n.image_id === undefined || n.image_id === null) return false;
  if (typeof n.pending_approval === 'boolean') return n.pending_approval;
  return (n.accept_reject === 1 || n.accept_reject === '1') && /pending your approval/i.test(String(n.description ?? ''));
}

/** approve-image / deny-image answer {status: 1, message}; a refusal is {status: 0} or a non-2xx. */
export function momentActionOk(httpOk: boolean, body: Raw): boolean {
  if (!httpOk || !body) return false;
  return body.success === true || body.status === 1 || body.status === '1';
}

/** The message under the buttons when it didn't work. */
export function momentActionError(body: Raw, action: 'approve' | 'reject'): string {
  const msg = body && typeof body.message === 'string' && body.message.trim() ? body.message.trim() : '';
  return msg || (action === 'approve' ? "Couldn't approve. Please try again." : "Couldn't reject. Please try again.");
}
