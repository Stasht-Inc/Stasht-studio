// "+ Campaign" into the message box (Chris 14 Nov 2026: "When you add a campaign, it should go in the message box first
// so you can continue writing your message"). Picking items puts their wording (POST /leads/campaign-draft) into the
// box at the cursor and shows a removable chip; nothing is created or sent until Send, where the server makes the
// campaign and swaps PLACEHOLDER for its link. These helpers keep the box text in step with the chip.

export const CAMPAIGN_PLACEHOLDER = '[campaign link]';

export interface PickedCampaign {
  kind: 'vehicle' | 'product' | 'shopify'; // shopify: Shopify products (ticket wdy2xh1320), worded as products
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
export function itemCount(count: number, kind: PickedCampaign['kind']): string {
  const noun = kind === 'vehicle' ? 'vehicle' : 'product';

  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Fallback wording when the API can't say (older server): the link placeholder only. */
export function fallbackDraft(count: number, kind: PickedCampaign['kind']): string {
  return `Here ${count === 1 ? 'is' : 'are'} ${itemCount(count, kind).replace(/^1 /, 'a ')} picked for you: ${CAMPAIGN_PLACEHOLDER}`;
}

// ---- "+ Campaign" = the account's EXISTING campaigns (Chris 23 Nov 2026, G) -------------------------------------------
// "+ Products" keeps making a new campaign of picked products on Send. "+ Campaign" lists the campaigns the account
// already has (the newsletter's "Choose campaigns" list) and puts each one's title and public link into the box at the
// cursor. The first one goes with Send as memory_id, so the server sends its link as the lead's tracked link (the
// "viewed" line in the thread), as a Storeel send does.

export interface ExistingCampaignPick { id: number; title: string; url: string }

/** "Title: link", one line per campaign (the products share's own "Name: link" lines). Ones without a link are left out. */
export function existingCampaignsText(picks: ReadonlyArray<ExistingCampaignPick>): string {
  return picks
    .filter((p) => /^https?:\/\/\S+$/i.test(p.url.trim()))
    .map((p) => {
      const title = p.title.replace(/\s+/g, ' ').trim();
      return title ? `${title}: ${p.url.trim()}` : p.url.trim();
    })
    .join('\n');
}

/** The campaign whose link the server tracks: the first picked one still in the box (null = none). */
export function trackedCampaignId(text: string, picks: ReadonlyArray<ExistingCampaignPick>): number | null {
  const found = picks.find((p) => p.url.trim() !== '' && text.includes(p.url.trim()));
  return found ? found.id : null;
}
