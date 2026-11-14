// "+ Campaign" into the message box (Chris 14 Nov 2026: "When you add a campaign, it should go in the message box first
// so you can continue writing your message"). Picking items puts their wording (POST /leads/campaign-draft) into the
// box at the cursor and shows a removable chip; nothing is created or sent until Send, where the server makes the
// campaign and swaps PLACEHOLDER for its link. These helpers keep the box text in step with the chip.

export const CAMPAIGN_PLACEHOLDER = '[campaign link]';

export interface PickedCampaign {
  kind: 'vehicle' | 'product';
  ids: number[];
  // As typed in the picker; '' for products left unnamed (the server names them).
  name: string;
  // What an unnamed product campaign will be called (for the chip).
  defaultName?: string;
  // The wording that was put in the box, to replace or take out again.
  draft: string;
}

/** Puts `insert` into `text` at [start, end) on its own lines. Returns the new text and where the cursor goes. */
export function insertDraft(text: string, start: number, end: number, insert: string): { text: string; cursor: number } {
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.max(s, Math.min(end, text.length));
  const before = text.slice(0, s);
  const after = text.slice(e);
  const lead = before === '' || /\n\n$/.test(before) ? '' : /\n$/.test(before) ? '\n' : '\n\n';
  const trail = after === '' ? '' : /^\n\n/.test(after) ? '' : /^\n/.test(after) ? '\n' : '\n\n';
  const next = before + lead + insert + trail + after;

  return { text: next, cursor: (before + lead + insert).length };
}

/** A new pick replaces the wording of the previous one when it is still in the box; otherwise it goes in at the cursor. */
export function replaceDraft(text: string, oldDraft: string | null | undefined, newDraft: string, start: number, end: number): { text: string; cursor: number } {
  if (oldDraft && text.includes(oldDraft)) {
    const at = text.indexOf(oldDraft);
    const next = text.slice(0, at) + newDraft + text.slice(at + oldDraft.length);

    return { text: next, cursor: at + newDraft.length };
  }

  return insertDraft(text, start, end, newDraft);
}

/** Removing the chip = a plain message: its wording comes out (when untouched) and no "[campaign link]" is left behind. */
export function removeDraft(text: string, draft: string | null | undefined): string {
  let next = draft && text.includes(draft) ? text.replace(draft, '') : text;
  next = next.split(CAMPAIGN_PLACEHOLDER).join('');

  return next.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

/** "2 products", "1 vehicle" — the chip's count. */
export function itemCount(count: number, kind: 'vehicle' | 'product'): string {
  const noun = kind === 'product' ? 'product' : 'vehicle';

  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Fallback wording when the API can't say (older server): the link placeholder only. */
export function fallbackDraft(count: number, kind: 'vehicle' | 'product'): string {
  return `Here ${count === 1 ? 'is' : 'are'} ${itemCount(count, kind).replace(/^1 /, 'a ')} picked for you: ${CAMPAIGN_PLACEHOLDER}`;
}
