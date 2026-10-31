// The Message box's text as a Text section, the same shape "+ → Text" makes (createBlock). messageBlock.ts keeps
// that section at the top of the email (Chris, 31 Oct).
// Pure. The text is never read as HTML: it is built as text nodes and serialised (escaped) by textHtml.
import type { NewsletterBlock } from '../../../services/newslettersAPI.ts';
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
