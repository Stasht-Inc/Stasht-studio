// components/products/ProductRichText.tsx — the full description: bold, italic, bullet list. Uses the newsletter text
// block's allowed HTML (lib/textHtml.ts; the API cleans it again with NewsletterHtmlSanitizer). Stored HTML is drawn as
// React nodes, never injected as a string.
import { useMemo, useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';
import { TEXT_CLASS, renderTextNodes } from '../newsletters/blocks/TextBlockEditor';
import { parseTextHtml, sanitizeTextHtml } from '../newsletters/lib/textHtml';

export default function ProductRichText({ label, value, resetKey, disabled, onChange }: {
  label: string; value: string; resetKey: string | number; disabled: boolean; onChange(html: string): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial = useMemo(() => renderTextNodes(parseTextHtml(value)), [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only on a real edit (typing or a toolbar button): re-serialising on blur would mark an untouched product as changed.
  const emit = () => { if (ref.current) onChange(sanitizeTextHtml(ref.current.innerHTML)); };
  const command = (name: 'bold' | 'italic' | 'insertUnorderedList') => { ref.current?.focus(); document.execCommand(name); emit(); };
  const tool = (name: 'bold' | 'italic' | 'insertUnorderedList', text: string, Icon: typeof Bold) => (
    <button type="button" aria-label={text} onMouseDown={(e) => e.preventDefault()} onClick={() => command(name)} className="rounded p-1.5 text-gray-700 hover:bg-gray-100"><Icon className="h-4 w-4" /></button>
  );
  return (
    <div className={`rounded-lg border border-gray-200 ${disabled ? 'bg-gray-50' : 'bg-white focus-within:border-[#6C60FF] focus-within:ring-2 focus-within:ring-[#6C60FF]/20'}`}>
      {!disabled && <div role="toolbar" aria-label="Text style" className="flex gap-1 border-b border-gray-100 p-1">{tool('bold', 'Bold', Bold)}{tool('italic', 'Italic', Italic)}{tool('insertUnorderedList', 'Bulleted list', List)}</div>}
      <div key={resetKey} ref={ref} role="textbox" aria-multiline="true" aria-label={label} aria-readonly={disabled || undefined} contentEditable={!disabled} suppressContentEditableWarning
        onInput={emit} className={`${TEXT_CLASS} min-h-[8rem] px-3 py-2 outline-none ${disabled ? 'text-gray-500' : ''}`}>{initial}</div>
    </div>
  );
}
