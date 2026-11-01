// "Set as my default message" under the composer's Message box (Chris, 1 Nov 2026; "we already have this in
// Storeels", where CreateMemory saves the invite's message with is_master). The account's saved text lives on its
// newsletter brand (GET/PUT /newsletter-brand default_message) and pre-fills every new newsletter's Message box. The
// box is ticked whenever its text is the saved text, so editing a pre-filled message for one newsletter just
// unticks it and the saved default stays. Pure.
import type { NewsletterDraft } from './draft.ts';
import { LIMITS, smsPlain } from './rules.ts';
import { syncMessageBlock } from './messageBlock.ts';

/** True while the box shows the account's saved default message (never for an empty box). */
export function isDefaultMessage(saved: string | null | undefined, smsText: string): boolean {
  const text = smsText.trim();
  return Boolean(text) && typeof saved === 'string' && saved.trim() === text;
}

/** Only a message that would save as a newsletter's text can become the default. */
export function canSetDefaultMessage(smsText: string): boolean {
  const text = smsText.trim();
  return Boolean(text) && smsPlain(text).length <= LIMITS.sms_text;
}

/**
 * A new draft with an empty Message box takes the saved default: the box, and the Message section at the top of the
 * email (kept in step as the box itself does). Any other draft comes back unchanged (the same object).
 */
export function withDefaultMessage(draft: NewsletterDraft, saved: string | null | undefined): NewsletterDraft {
  const message = typeof saved === 'string' ? saved.trim() : '';
  if (!message || draft.sms_text.trim()) return draft;
  return { ...draft, sms_text: message, blocks: syncMessageBlock(draft.blocks, message) };
}
