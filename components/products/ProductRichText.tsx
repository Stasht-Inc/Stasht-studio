// components/products/ProductRichText.tsx — the full description: bold, italic, bullet list. Uses the newsletter text
// block's allowed HTML (lib/textHtml.ts; the API cleans it again with NewsletterHtmlSanitizer). Stored HTML is drawn as
// React nodes, never injected as a string.
import { useMemo, useRef, type ClipboardEvent } from 'react';
import { Bold, Italic, List } from 'lucide-react';
import { TEXT_CLASS, renderTextNodes } from '../newsletters/blocks/TextBlockEditor';
import { parseTextHtml, pastedTextNodes, sanitizeTextHtml, type TextNode } from '../newsletters/lib/textHtml';

/** Allowed nodes → DOM nodes for a paste (element by element; no HTML string reaches the page). Sizes and fonts are
 *  newsletter-only, so a sized span keeps just its words. */
function domNodes(nodes: TextNode[]): Node[] {
  return nodes.flatMap((node): Node[] => {
    if (node.kind === 'text') return [document.createTextNode(node.text)];
    if (node.kind === 'br') return [document.createElement('br')];
    if (node.kind === 'size') return domNodes(node.children);
    const el = document.createElement(node.kind === 'a' ? 'a' : node.tag);
    if (node.kind === 'a') el.setAttribute('href', node.href);
    for (const child of domNodes(node.children)) el.appendChild(child);
    return [el];
  });
}

export default function ProductRichText({ label, value, resetKey, disabled, busy = false, onChange }: {
  label: string; value: string; resetKey: string | number; disabled: boolean;
  /** A save is on its way: not editable for the moment, but it looks the same (no toolbar jump). */
  busy?: boolean; onChange(html: string): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useMemo(() => renderTextNodes(parseTextHtml(value)), [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only on a real edit (typing or a toolbar button): re-serialising on blur would mark an untouched product as changed.
  const emit = () => { if (ref.current) onChange(sanitizeTextHtml(ref.current.innerHTML)); };
  const command = (name: 'bold' | 'italic' | 'insertUnorderedList') => { ref.current?.focus(); document.execCommand(name); emit(); };
  // Like the newsletter text block: never someone else's HTML as it is. Formatted text keeps bold, italic, links,
  // paragraphs and lists; anything else arrives as plain words.
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const nodes = html ? domNodes(pastedTextNodes(html)) : [];
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!nodes.length || !range || !ref.current?.contains(range.commonAncestorContainer)) {
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      emit();
      return;
    }
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    nodes.forEach((n) => fragment.appendChild(n));
    range.insertNode(fragment);
    const after = document.createRange();
    after.setStartAfter(nodes[nodes.length - 1]);
    after.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(after);
    emit();
  };
  const tool = (name: 'bold' | 'italic' | 'insertUnorderedList', text: string, Icon: typeof Bold) => (
    <button type="button" aria-label={text} onMouseDown={(e) => e.preventDefault()} onClick={() => command(name)} className="rounded p-1.5 text-gray-700 hover:bg-gray-100"><Icon className="h-4 w-4" /></button>
  );
  return (
    <div className={`rounded-lg border border-gray-200 ${disabled ? 'bg-gray-50' : 'bg-white focus-within:border-[#6C60FF] focus-within:ring-2 focus-within:ring-[#6C60FF]/20'}`}>
      {!disabled && <div role="toolbar" aria-label="Text style" className="flex gap-1 border-b border-gray-100 p-1">{tool('bold', 'Bold', Bold)}{tool('italic', 'Italic', Italic)}{tool('insertUnorderedList', 'Bulleted list', List)}</div>}
      <div key={resetKey} ref={ref} role="textbox" aria-multiline="true" aria-label={label} aria-readonly={disabled || busy || undefined} contentEditable={!disabled && !busy} suppressContentEditableWarning
        onInput={emit} onPaste={disabled || busy ? undefined : onPaste} className={`${TEXT_CLASS} min-h-[8rem] px-3 py-2 outline-none ${disabled ? 'text-gray-500' : ''}`}>{initial}</div>
    </div>
  );
}
