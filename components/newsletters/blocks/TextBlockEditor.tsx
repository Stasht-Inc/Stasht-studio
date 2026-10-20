import { useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bold, Italic, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { TextBlockData } from '../../../services/newslettersAPI';
import { parseTextHtml, safeLinkHref, serializeTextNodes, type TextNode } from '../lib/textHtml';
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

export default function TextBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<TextBlockData>) {
  const ref = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  // Rendered once per block. After that the browser owns the editable DOM and we only read it back,
  // so React never rewrites what the person is typing.
  const initial = useMemo(() => renderTextNodes(parseTextHtml(data.html)), [blockId]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = serializeTextNodes(parseTextHtml(el.innerHTML));
    if (html !== data.html) onChange({ html });
  };
  const format = (command: 'bold' | 'italic') => {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  };
  const openLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) {
      toast.info('Select the words to link first.');
      return;
    }
    savedRange.current = sel.getRangeAt(0).cloneRange();
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
    const sel = window.getSelection();
    if (sel && savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('createLink', false, href);
    emit();
  };
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault(); // paste words only, never someone else's HTML
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); format('bold'); }
    else if (key === 'i') { e.preventDefault(); format('italic'); }
    else if (key === 'k') { e.preventDefault(); openLink(); }
  };

  return (
    <div>
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
        data-placeholder="Write something…"
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}
        className={`min-h-[1.625rem] break-words outline-none empty:before:text-gray-300 empty:before:content-[attr(data-placeholder)] ${TEXT_CLASS}`}
      >
        {initial}
      </div>
    </div>
  );
}
