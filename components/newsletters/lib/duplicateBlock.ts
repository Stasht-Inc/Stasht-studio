// Duplicate a section (Chris, 6 Nov: "Need duplicate row"). The copy has every word, setting and style of the section
// (a Campaigns section's picks, cards, columns and card edits included), a new id, and goes directly below it. Never
// the Message section (it is kept in step with the Message box), and never past the section limit. Pure.
import type { NewsletterBlock } from '../../../services/newslettersAPI.ts';
import { insertBlock, newBlockId } from './blocks.ts';
import { isMessageBlock } from './messageBlock.ts';

export type DuplicateOutcome = 'duplicated' | 'full' | 'not-allowed' | 'missing';

export function canDuplicateBlock(block: Pick<NewsletterBlock, 'id' | 'type'>): boolean {
  return !isMessageBlock(block);
}

/**
 * The sections with a copy of section `id` right after it, and the copy's id (to select it). The same array comes back
 * when nothing changes: the email is full, the section is the Message section, or it has gone.
 */
export function duplicateBlock(blocks: NewsletterBlock[], id: string, random?: () => number): { blocks: NewsletterBlock[]; outcome: DuplicateOutcome; id: string | null } {
  const index = blocks.findIndex((b) => b.id === id);
  if (index < 0) return { blocks, outcome: 'missing', id: null };
  const block = blocks[index];
  if (!canDuplicateBlock(block)) return { blocks, outcome: 'not-allowed', id: null };
  const copy = { ...block, id: newBlockId(blocks, random), data: structuredClone(block.data) } as NewsletterBlock;
  const next = insertBlock(blocks, index + 1, copy);
  return next === blocks ? { blocks, outcome: 'full', id: null } : { blocks: next, outcome: 'duplicated', id: copy.id };
}
