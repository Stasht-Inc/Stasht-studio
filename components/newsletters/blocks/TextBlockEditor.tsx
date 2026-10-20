import { useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bold, Italic, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { TextBlockData } from '../../../services/newslettersAPI';
import { editorHtml, parseTextHtml, safeLinkHref, type TextNode } from '../lib/textHtml';
import { toHttpsUrl } from '../lib/urls';
import { BUTTON_PRIMARY, LABEL, LAYER, inputClass } from '../lib/ui';
import type { BlockEditorProps } from './types';

/** The email's text styles (blocks/text.blade.php + NewsletterRenderer::styleText): 16/26 px, grey-700. */
export const TEXT_CLASS = 'text-base leading-[1.625rem] text-gray-700 [&_a]:text-[#6C60FF] [&_a]:underline [&_li]:mb-1.5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p:last-child]:mb-0 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_div]:mb-4';

/** Stored HTML → React elements (never an HTML string in the page). */
export function renderTextNodes(nodes: TextNode[], prefix = 'n'): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'br') return <br key={key} />;
    if (node.kind === 'a') return <a key={key} href={node.href}>{renderTextNodes(node.children, key)}</a>;
    const Tag = node.tag;
    return <Tag key={key}>{renderTextNodes(node.children, key)}</Tag>;
  });
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
    >
      {children}
    </button>
  );
}

/** The caret position under the pointer: caretRangeFromPoint (Chrome, Safari) or caretPositionFromPoint (Firefox). */
function rangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  if (typeof document.caretRangeFromPoint === 'function') return document.caretRangeFromPoint(x, y);
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (!pos) return null;
  const range = document.createRange();
  range.setStart(pos.offsetNode, pos.offset);
  range.collapse(true);
  return range;
}

export default function TextBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<TextBlockData>) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  // Rendered once per block. After that the browser owns the editable DOM and we only read it back,
  // so React never rewrites what the person is typing.
  const initial = useMemo(() => renderTextNodes(parseTextHtml(data.html)), [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The last html handed to onChange: execCommand fires `input` itself, so formatting must not emit twice.
  const lastEmitted = useRef(data.html);
  const [empty, setEmpty] = useState(() => data.html === '');
  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = editorHtml(el.innerHTML);
    setEmpty(html === '');
    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    onChange({ html });
  };

  // Where the caret or selection was when the editor lost focus (for example to Tab onto the toolbar), so
  // Bold / Italic / Link still act on it.
  const lastRange = useRef<Range | null>(null);
  const rangeInEditor = (): Range | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current?.contains(sel.anchorNode)) return null;
    return sel.getRangeAt(0);
  };
  const select = (range: Range | null) => {
    const sel = window.getSelection();
    if (!sel || !range) return;
    sel.removeAllRanges();
    sel.addRange(range);
  };
  // Focus the words with the selection they had: focusing alone can collapse it to the start.
  const focusWithSelection = () => {
    const range = rangeInEditor()?.cloneRange() ?? lastRange.current;
    ref.current?.focus();
    select(range);
  };
  const format = (command: 'bold' | 'italic') => {
    focusWithSelection();
    document.execCommand(command);
    emit();
  };
  const openLink = () => {
    if (!rangeInEditor()) select(lastRange.current);
    const range = rangeInEditor();
    if (!range || range.collapsed) {
      toast.info('Select the words to link first.');
      return;
    }
    savedRange.current = range.cloneRange();
    setLinkValue('https://');
    setLinkError(null);
    setLinkOpen(true);
  };
  const applyLink = () => {
    const raw = linkValue.trim();
    const href = /^mailto:/i.test(raw) ? safeLinkHref(raw) : safeLinkHref(toHttpsUrl(raw));
    if (!href) {
      setLinkError('Use a link that starts with https:// (or mailto: for an email address).');
      return;
    }
    setLinkOpen(false);
    ref.current?.focus();
    select(savedRange.current);
    document.execCommand('createLink', false, href);
    emit();
  };
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault(); // paste words only, never someone else's HTML
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };
  // Text dragged within this editor moves as usual (the browser keeps its formatting; the save sanitises it).
  // Anything dropped from outside (text, a link or a picture) arrives as words only, where it was dropped.
  const draggingInside = useRef(false);
  const onDragStart = () => { draggingInside.current = true; };
  const onDragEnd = () => { draggingInside.current = false; };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (draggingInside.current) { draggingInside.current = false; return; }
    e.preventDefault();
    if (readOnly) return;
    const text = e.dataTransfer.getData('text/plain');
    if (!text) return;
    const at = rangeFromPoint(e.clientX, e.clientY);
    ref.current?.focus();
    if (at && ref.current?.contains(at.startContainer)) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(at);
    }
    document.execCommand('insertText', false, text);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); format('bold'); }
    else if (key === 'i') { e.preventDefault(); format('italic'); }
    else if (key === 'k') { e.preventDefault(); openLink(); }
  };

  return (
    <div className="relative">
      {selected && !readOnly ? (
        <div role="toolbar" aria-label="Text formatting" className="mb-2 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <ToolbarButton label="Bold" onClick={() => format('bold')}><Bold className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => format('italic')}><Italic className="h-4 w-4" /></ToolbarButton>
          <Popover.Root open={linkOpen} onOpenChange={setLinkOpen}>
            <Popover.Anchor asChild>
              <span><ToolbarButton label="Link" onClick={openLink}><LinkIcon className="h-4 w-4" /></ToolbarButton></span>
            </Popover.Anchor>
            <Popover.Portal>
              <Popover.Content
                side="bottom"
                align="start"
                sideOffset={6}
                collisionPadding={12}
                style={{ zIndex: LAYER.popover }}
                onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById(`${blockId}-link`)?.focus(); }}
                // Back to the words, with the selection they had (Radix would focus the toolbar button).
                onCloseAutoFocus={(e) => {
                  e.preventDefault();
                  ref.current?.focus();
                  select(savedRange.current);
                }}
                className="w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-gray-200 bg-white p-4 shadow-lg outline-none"
              >
                <form onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
                  <label htmlFor={`${blockId}-link`} className={LABEL}>Link address</label>
                  <input id={`${blockId}-link`} type="text" inputMode="url" value={linkValue} aria-invalid={Boolean(linkError)}
                    onChange={(e) => setLinkValue(e.target.value)} className={inputClass(Boolean(linkError))} />
                  {linkError ? <p role="alert" className="mt-1.5 text-xs text-red-600">{linkError}</p> : null}
                  <div className="mt-3 flex justify-end"><button type="submit" className={BUTTON_PRIMARY}>Add link</button></div>
                </form>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      ) : null}
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label="Text"
        aria-readonly={readOnly || undefined}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={() => { lastRange.current = rangeInEditor()?.cloneRange() ?? lastRange.current; emit(); }}
        onPaste={onPaste}
        onDragOver={(e) => { if (!readOnly) e.preventDefault(); }}
        onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd}
        onKeyDown={onKeyDown}
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}
        className={`min-h-[1.625rem] break-words outline-none ${TEXT_CLASS}`}
      >
        {initial}
      </div>
      {/* A blank editor can still hold <p><br></p>, so the placeholder is drawn over it rather than with :empty. */}
      {empty && !readOnly ? <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 text-base leading-[1.625rem] text-gray-300">Write something…</span> : null}
    </div>
  );
}
