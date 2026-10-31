// The Message box (Chris, 31 Oct): a short note that goes at the top of the email, above the sections (and is also
// the text when Text message is ticked). In the email it is an ordinary Text section with a fixed id, which Studio
// keeps in step with the box. The API keeps a section's id as sent (NewsletterContent::normaliseBlocks allows
// [A-Za-z0-9_-]{1,40}; NewsletterPresenter::blocks returns it), so the section is found again after every save.
// Pure. The text is never read as HTML (smsTextHtml escapes it).
import type { NewsletterBlock } from '../../../services/newslettersAPI.ts';
import { insertBlock } from './blocks.ts';
import { smsTextHtml } from './smsToEmail.ts';

/** The Message section's id. Never made by newBlockId ('b' + …). */
export const MESSAGE_BLOCK_ID = 'nl-message';

export function isMessageBlock(block: Pick<NewsletterBlock, 'id' | 'type'>): boolean {
  return block.id === MESSAGE_BLOCK_ID && block.type === 'text';
}

/**
 * The sections with the Message section matching `message`: added at the top when there is none (unless the email
 * already has the most sections allowed), updated where it is (it may have been moved), removed when the message is
 * blank. Only one ever stays. The same array comes back when nothing changes.
 */
export function syncMessageBlock(blocks: NewsletterBlock[], message: string): NewsletterBlock[] {
  const html = smsTextHtml(message);
  const first = blocks.findIndex((b) => b.id === MESSAGE_BLOCK_ID);
  const strays = blocks.some((b, i) => b.id === MESSAGE_BLOCK_ID && i !== first);
  if (!html) return first < 0 ? blocks : blocks.filter((b) => b.id !== MESSAGE_BLOCK_ID);
  const block: NewsletterBlock = { id: MESSAGE_BLOCK_ID, type: 'text', data: { html } };
  if (first < 0) return insertBlock(blocks, 0, block);
  const current = blocks[first];
  const same = current.type === 'text' && (current.data as { html?: unknown }).html === html;
  if (same && !strays) return blocks;
  return blocks.flatMap((b, i) => (b.id !== MESSAGE_BLOCK_ID ? [b] : i === first ? [same ? b : block] : []));
}

/** Opening an older draft that has a message but no Message section: add it at the top. Otherwise unchanged. */
export function addMissingMessageBlock(blocks: NewsletterBlock[], message: string): NewsletterBlock[] {
  return blocks.some((b) => b.id === MESSAGE_BLOCK_ID) ? blocks : syncMessageBlock(blocks, message);
}
