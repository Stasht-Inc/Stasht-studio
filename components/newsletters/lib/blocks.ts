// The newsletter's sections (spec §8 blocks): create, insert, move, remove, update, and what still needs
// doing before sending. Pure; the preview editor (NewsletterEditor) calls these.
import type { BlockType, CampaignSelection, NewsletterBlock, TitleSize } from '../../../services/newslettersAPI.ts';
import { LIMITS } from './rules.ts';
import { DEFAULT_BUTTON_COLOR, safeHexColor } from './colors.ts';
import { httpsUrl, youtubeVideoId } from './urls.ts';
import { textHtmlIsEmpty } from './textHtml.ts';
import { NEW_SECTION_COLUMNS, campaignColumns, campaignIdsOf, normaliseCampaignItems, normaliseColumns, normaliseSelections } from './campaignsBlock.ts';

export const BLOCK_TYPES: readonly BlockType[] = ['image', 'title', 'text', 'youtube', 'button', 'divider', 'campaigns'];
const TITLE_SIZES: readonly TitleSize[] = ['small', 'medium', 'large'];

/** A short id not used by any block yet ('b' + random base-36). The API accepts [A-Za-z0-9_-]{1,40}. */
export function newBlockId(existing: readonly NewsletterBlock[], random: () => number = Math.random): string {
  const taken = new Set(existing.map((b) => b.id));
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = `b${random().toString(36).slice(2, 10)}`;
    if (id.length > 4 && !taken.has(id)) return id;
  }
  let n = existing.length + 1;
  while (taken.has(`b${n}`)) n++;
  return `b${n}`;
}

export function createBlock(type: BlockType, id: string): NewsletterBlock {
  switch (type) {
    case 'image': return { id, type: 'image', data: { url: '', alt: '', link: null } };
    case 'title': return { id, type: 'title', data: { text: '', size: 'large' } };
    case 'text': return { id, type: 'text', data: { html: '' } };
    case 'youtube': return { id, type: 'youtube', data: { url: '' } };
    case 'button': return { id, type: 'button', data: { label: 'Learn more', url: '', color: DEFAULT_BUTTON_COLOR } };
    case 'campaigns': return { id, type: 'campaigns', data: { selections: [], campaign_ids: [], columns: NEW_SECTION_COLUMNS } };
    default: return { id, type: 'divider', data: { style: 'line' } };
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * What the API returns, in the editor's shape: it stores an empty URL or link as null and a missing title
 * size as medium (NewsletterContent::blockData). Unknown types are left out.
 */
export function normaliseBlocks(raw: unknown): NewsletterBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: NewsletterBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, type, data } = item as { id?: unknown; type?: unknown; data?: unknown };
    if (typeof id !== 'string' || !BLOCK_TYPES.includes(type as BlockType)) continue;
    const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    switch (type as BlockType) {
      case 'image': out.push({ id, type: 'image', data: { url: str(d.url), alt: str(d.alt), link: str(d.link) || null } }); break;
      case 'title': out.push({ id, type: 'title', data: { text: str(d.text), size: TITLE_SIZES.includes(d.size as TitleSize) ? (d.size as TitleSize) : 'medium' } }); break;
      case 'text': out.push({ id, type: 'text', data: { html: str(d.html) } }); break;
      case 'youtube': out.push({ id, type: 'youtube', data: { url: str(d.url) } }); break;
      case 'button': out.push({ id, type: 'button', data: { label: str(d.label), url: str(d.url), color: safeHexColor(d.color, DEFAULT_BUTTON_COLOR) } }); break;
      // The API's snapshot (items) comes back on every save; Studio never sends it (blocksToInput). A block saved
      // before products and vehicles has campaign_ids only: those are campaign selections. columns is left out
      // when the API has none (an older section: 1 column, and it stays so until the person changes it).
      case 'campaigns': {
        const selections = normaliseSelections(d.selections, d.campaign_ids);
        const columns = normaliseColumns(d.columns);
        out.push({ id, type: 'campaigns', data: { selections, campaign_ids: campaignIdsOf(selections), items: normaliseCampaignItems(d.items), ...(columns ? { columns } : {}) } });
        break;
      }
      default: out.push({ id, type: 'divider', data: { style: d.style === 'space' ? 'space' : 'line' } });
    }
  }
  return out;
}

/** Insert at `index` (clamped). Returns the same array when the email already has LIMITS.blocks sections. */
export function insertBlock(blocks: NewsletterBlock[], index: number, block: NewsletterBlock): NewsletterBlock[] {
  if (blocks.length >= LIMITS.blocks) return blocks;
  const at = Math.max(0, Math.min(index, blocks.length));
  return [...blocks.slice(0, at), block, ...blocks.slice(at)];
}

export function moveBlock(blocks: NewsletterBlock[], index: number, delta: -1 | 1): NewsletterBlock[] {
  const to = index + delta;
  if (index < 0 || index >= blocks.length || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function removeBlock(blocks: NewsletterBlock[], id: string): NewsletterBlock[] {
  return blocks.filter((b) => b.id !== id);
}

/** Undo a delete: the section goes back at its old place (unchanged if it is already there, or the list is full). */
export function restoreBlock(blocks: NewsletterBlock[], block: NewsletterBlock, index: number): NewsletterBlock[] {
  if (blocks.some((b) => b.id === block.id)) return blocks;
  return insertBlock(blocks, index, block);
}

/** Toasts with an action (Undo, View) stay this long, so there is time to use it. */
export const ACTION_TOAST_MS = 10000;

/** Undo a delete, saying what happened: put back, already back (Undo tapped twice), or the email is full. */
export function undoDelete(blocks: NewsletterBlock[], block: NewsletterBlock, index: number): { blocks: NewsletterBlock[]; outcome: 'restored' | 'already' | 'full' } {
  if (blocks.some((b) => b.id === block.id)) return { blocks, outcome: 'already' };
  const next = insertBlock(blocks, index, block);
  return next === blocks ? { blocks, outcome: 'full' } : { blocks: next, outcome: 'restored' };
}

export function updateBlockData(blocks: NewsletterBlock[], id: string, data: Record<string, unknown>): NewsletterBlock[] {
  return blocks.map((b) => (b.id === id ? ({ ...b, data: { ...b.data, ...data } } as NewsletterBlock) : b));
}

/** What still needs doing before this section can be sent, or null. */
export function blockProblem(block: NewsletterBlock): string | null {
  switch (block.type) {
    case 'image':
      if (!block.data.url) return 'Add an image, or remove this section.';
      if (!httpsUrl(block.data.url)) return 'Use an image link that starts with https://.';
      if (block.data.link && !httpsUrl(block.data.link)) return 'The image link must start with https://.';
      return null;
    case 'title':
      if (!str(block.data.text).trim()) return 'Type a title, or remove this section.';
      return block.data.text.length > LIMITS.title ? `Keep titles to ${LIMITS.title} characters.` : null;
    case 'text':
      if (textHtmlIsEmpty(block.data.html)) return 'Write some text, or remove this section.';
      return block.data.html.length > LIMITS.text_html ? TEXT_TOO_LONG : null;
    case 'youtube':
      return youtubeVideoId(str(block.data.url)) ? null : 'Paste a YouTube link, like https://www.youtube.com/watch?v=…';
    case 'button':
      if (!str(block.data.label).trim()) return 'Add the button text.';
      if (block.data.label.length > LIMITS.button_label) return `Keep button text to ${LIMITS.button_label} characters.`;
      if (!httpsUrl(block.data.url)) return 'Add the link the button opens (https://…).';
      return safeHexColor(block.data.color, '') ? null : 'Pick a button colour.';
    case 'campaigns':
      return campaignSelections(block.data).length ? null : 'Pick at least one campaign, product or vehicle, or remove this section.';
    default:
      return null;
  }
}

/** A Campaigns section's picks, also for data that only has campaign_ids (a block from before products). */
export function campaignSelections(data: { selections?: unknown; campaign_ids?: unknown }): CampaignSelection[] {
  return normaliseSelections(data.selections, data.campaign_ids);
}

/** The blocks as a PUT sends them: a Campaigns section sends its selections, their campaign_ids and its columns
 *  (1 for an older section that has none), never items (the API builds the cards). */
export function blocksToInput(blocks: readonly NewsletterBlock[]): NewsletterBlock[] {
  return blocks.map((b) => {
    if (b.type !== 'campaigns') return b;
    const selections = campaignSelections(b.data);
    return { id: b.id, type: 'campaigns', data: { selections, campaign_ids: campaignIdsOf(selections), columns: campaignColumns(b.data) } };
  });
}

const TEXT_TOO_LONG = 'This text is too long. Split it into two sections.';

/** Text sections over the API's html limit: the PUT would refuse the whole draft, so autosave holds them back. */
export function overLimitTextIds(blocks: readonly NewsletterBlock[]): Set<string> {
  return new Set(blocks.filter((b) => b.type === 'text' && b.data.html.length > LIMITS.text_html).map((b) => b.id));
}

/** Problems shown while typing, before any send attempt: only the ones that stop the draft saving. */
export function liveBlockProblems(blocks: readonly NewsletterBlock[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of overLimitTextIds(blocks)) out[id] = TEXT_TOO_LONG;
  return out;
}

export function blocksProblems(blocks: NewsletterBlock[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of blocks) {
    const problem = blockProblem(block);
    if (problem) out[block.id] = problem;
  }
  return out;
}
