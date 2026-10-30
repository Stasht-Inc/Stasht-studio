// "Add this to the email too" (Chris, 30 Oct): the Text message box is the SMS only and never goes in the email.
// This copies its text into the email as a Text section at the end, the same shape "+ → Text" makes (createBlock).
// Pure. The text is never read as HTML: it is built as text nodes and serialised (escaped) by textHtml.
import type { NewsletterBlock } from '../../../services/newslettersAPI.ts';
import { insertBlock } from './blocks.ts';
import { serializeTextNodes, type TextNode } from './textHtml.ts';

/** The SMS text as the Text section's HTML: a blank line starts a new paragraph, a new line is a line break. '' when blank. */
export function smsTextHtml(text: string): string {
  const paragraphs = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
  const nodes: TextNode[] = paragraphs.map((lines) => {
    const children: TextNode[] = [];
    lines.forEach((line, i) => {
      if (i > 0) children.push({ kind: 'br' });
      children.push({ kind: 'text', text: line });
    });
    return { kind: 'el', tag: 'p', children };
  });
  return serializeTextNodes(nodes);
}

/** A Text section holding the SMS text, or null when the text is blank. */
export function smsTextBlock(text: string, id: string): NewsletterBlock | null {
  const html = smsTextHtml(text);
  return html ? { id, type: 'text', data: { html } } : null;
}

/** The sections with the SMS text added at the end; unchanged when the text is blank or the email is full. */
export function appendSmsToEmail(blocks: NewsletterBlock[], text: string, id: string): { blocks: NewsletterBlock[]; outcome: 'added' | 'empty' | 'full' } {
  const block = smsTextBlock(text, id);
  if (!block) return { blocks, outcome: 'empty' };
  const next = insertBlock(blocks, blocks.length, block);
  return next === blocks ? { blocks, outcome: 'full' } : { blocks: next, outcome: 'added' };
}

/** The button works only with some text, on a newsletter that can still be changed. */
export function canAddSmsToEmail(text: string, readOnly: boolean): boolean {
  return !readOnly && String(text ?? '').trim() !== '';
}
