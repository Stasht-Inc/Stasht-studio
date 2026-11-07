import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Bold, Italic, Link as LinkIcon } from 'lucide-react';
import { composerToast } from '../ComposerToaster';
import type { FontKey, TextBlockData } from '../../../services/newslettersAPI';
import { editorHtml, fontAt, fontTextNodes, formatAt, parseTextHtml, pastedTextNodes, resizeTextNodes, safeLinkHref, serializeTextNodes, sizeAtOffset, type TextNode } from '../lib/textHtml';
import { fontStack } from '../lib/fonts';
import { createHistory, recordHistory, redoHistory, undoHistory } from '../lib/textHistory';
import { TEXT_INK, TEXT_SIZES, sectionLook, sectionStyleOf, stylePatch, textLinkColor, textSizeOf, type TextSize } from '../lib/sectionStyle';
import { AlignMenu, BackgroundMenu, FontMenu, SizeMenu, TextColorMenu, ToolbarDivider, ToolbarToggle, useRovingToolbar } from './StyleToolbar';
import { toHttpsUrl } from '../lib/urls';
import { BUTTON_PRIMARY, LABEL, LAYER, inputClass } from '../lib/ui';
import type { BlockEditorProps } from './types';
import { SpacingMenu } from './SpacingMenu';
import { FLUSH_END_CLASS, SPACED_TEXT_CLASS, spacingOf, spacingPatch, spanLineHeight, textSpacingStyle, toolbarGap } from '../lib/sectionSpacing';

/** The email's text styles (blocks/text.blade.php + NewsletterRenderer::styleText): 16/26 px, grey-700. Links take
 *  --nl-link (purple unless the section is a dark band, lib/sectionStyle.ts textLinkColor). */
export const TEXT_CLASS = 'text-base leading-[1.625rem] text-gray-700 [&_a]:text-[color:var(--nl-link,#6C60FF)] [&_a]:underline [&_li]:mb-1.5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p:last-child]:mb-0 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_div]:mb-4';

/** Stored HTML → React elements (never an HTML string in the page). */
export function renderTextNodes(nodes: TextNode[], prefix = 'n'): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.kind === 'text') return node.text;
    if (node.kind === 'br') return <br key={key} />;
    if (node.kind === 'a') return <a key={key} href={node.href}>{renderTextNodes(node.children, key)}</a>;
    if (node.kind === 'size') return <span key={key} style={sizeStyle(node.px, node.font)}>{renderTextNodes(node.children, key)}</span>;
    const Tag = node.tag;
    return <Tag key={key}>{renderTextNodes(node.children, key)}</Tag>;
  });
}

/** A font size and/or family as the email draws it: the size and its line height, the font's stack (NewsletterRenderer::styleText). */
function sizeStyle(px: number | null, font?: FontKey): CSSProperties {
  const size = px === null ? null : textSizeOf(px);
  return {
    // The line height follows the section's line spacing (Chris, 7 Nov; lib/sectionSpacing.ts): normal unless it is set.
    ...(px !== null ? { fontSize: `${px}px`, lineHeight: spanLineHeight(px, size?.lineHeight ?? 26) } : {}),
    ...(font ? { fontFamily: fontStack(font) } : {}),
  };
}

/** Allowed nodes → DOM nodes for a paste (built element by element; no HTML string reaches the page). */
function domNodes(nodes: TextNode[]): Node[] {
  return nodes.map((node) => {
    if (node.kind === 'text') return document.createTextNode(node.text);
    if (node.kind === 'br') return document.createElement('br');
    const el = document.createElement(node.kind === 'a' ? 'a' : node.kind === 'size' ? 'span' : node.tag);
    if (node.kind === 'a') el.setAttribute('href', node.href);
    if (node.kind === 'size') Object.assign(el.style, sizeStyle(node.px, node.font));
    for (const child of domNodes(node.children)) el.appendChild(child);
    return el;
  });
}

/** Characters of text before a point in the editor (text nodes only, as resizeTextNodes counts them). */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** The point `chars` characters into the editor's text (its end when there are fewer). start: at a boundary between two
 *  text nodes, the start of the next one (so a selection begins inside the words it covers). */
function pointAt(root: HTMLElement, chars: number, start = false): [Node, number] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = chars;
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (start ? left < n.data.length : left <= n.data.length) return [n, left];
    left -= n.data.length;
    last = n;
  }
  return last ? [last, last.data.length] : [root, root.childNodes.length];
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
  // Undo / redo are this editor's own (review, 5 Nov): clean html snapshots, never the browser's history, which can't
  // replay changes made outside it and could bring back markup the email doesn't allow.
  const history = useRef(createHistory(data.html));
  // Set around a formatting command, whose own `input` event must count as a formatting step, not typing.
  const formatting = useRef(false);
  const emit = (kind: 'typing' | 'format' = 'typing') => {
    const el = ref.current;
    if (!el) return;
    const html = editorHtml(el.innerHTML);
    setEmpty(html === '');
    if (html === lastEmitted.current) return;
    lastEmitted.current = html;
    history.current = recordHistory(history.current, html, formatting.current ? 'format' : kind, Date.now());
    onChange({ html });
  };
  /** The editor's words from clean html (built node by node), the selection put back by character offsets. */
  const show = (html: string, sel: { start: number; end: number } | null) => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren(...domNodes(parseTextHtml(html)));
    const range = document.createRange();
    if (sel) {
      const [sn, so] = pointAt(el, sel.start, true);
      const [en, eo] = pointAt(el, sel.end);
      range.setStart(sn, so);
      range.setEnd(en, eo);
    } else {
      range.selectNodeContents(el);
      range.collapse(false);
    }
    el.focus();
    select(range);
    lastRange.current = range.cloneRange();
  };
  const travel = (direction: 'undo' | 'redo') => {
    const step = direction === 'undo' ? undoHistory(history.current) : redoHistory(history.current);
    if (step.html === null) return;
    history.current = step.history;
    show(step.html, null);
    lastEmitted.current = step.html;
    setEmpty(step.html === '');
    onChange({ html: step.html });
  };
  const travelRef = useRef(travel);
  travelRef.current = travel;
  // The Edit menu, a mouse's back gesture, or a key this editor didn't catch: the browser asks first (beforeinput).
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType !== 'historyUndo' && e.inputType !== 'historyRedo') return;
      e.preventDefault();
      travelRef.current(e.inputType === 'historyUndo' ? 'undo' : 'redo');
    };
    el.addEventListener('beforeinput', onBeforeInput);
    return () => el.removeEventListener('beforeinput', onBeforeInput);
  }, []);

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
    formatting.current = true;
    try { document.execCommand(command); emit('format'); } finally { formatting.current = false; }
    readCaret();
  };
  const openLink = () => {
    if (!rangeInEditor()) select(lastRange.current);
    const range = rangeInEditor();
    if (!range || range.collapsed) {
      composerToast.info('Select the words to link first.');
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
    formatting.current = true;
    try { document.execCommand('createLink', false, href); emit('format'); } finally { formatting.current = false; }
    readCaret();
  };
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault(); // never someone else's HTML as it is
    // Formatted text keeps what the email allows (bold, italic, links, paragraphs, lists); everything else goes.
    const html = e.clipboardData.getData('text/html');
    const nodes = html ? pastedTextNodes(html) : [];
    const range = rangeInEditor();
    if (!nodes.length || !range) {
      formatting.current = true;
      try { document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); emit('format'); } finally { formatting.current = false; }
      return;
    }
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    const made = domNodes(nodes);
    made.forEach((n) => fragment.appendChild(n));
    range.insertNode(fragment);
    const after = document.createRange();
    after.setStartAfter(made[made.length - 1]);
    after.collapse(true);
    select(after);
    emit('format');
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
    formatting.current = true;
    try { document.execCommand('insertText', false, text); emit('format'); } finally { formatting.current = false; }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    // Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redo: this editor's own history.
    if (key === 'z' || key === 'y') {
      e.preventDefault();
      travel(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (e.shiftKey) return;
    if (key === 'b') { e.preventDefault(); format('bold'); }
    else if (key === 'i') { e.preventDefault(); format('italic'); }
    else if (key === 'k') { e.preventDefault(); openLink(); }
  };

  const roving = useRovingToolbar();
  // Section style (Chris, 5 Nov): alignment, the words' colour and a background over the whole section (drawn by
  // BlockFrame). The links' colour follows the band (textLinkColor).
  const look = sectionLook(data as unknown as Record<string, unknown>, false, TEXT_INK);
  const style = sectionStyleOf(data as unknown as Record<string, unknown>, false);
  // Line spacing and padding (Chris, 7 Nov).
  const spacing = spacingOf(data as unknown as Record<string, unknown>, true);

  // Font size: on the selected words; with nothing selected, on the whole section. The size where the caret is shows
  // on the button.
  const [caretSize, setCaretSize] = useState<TextSize>('normal');
  // Chris (6 Nov): what the B / I / link buttons show as pressed, and the font the Font button names, at the caret.
  const [caret, setCaret] = useState<{ bold: boolean; italic: boolean; link: boolean; font: FontKey | null }>({ bold: false, italic: false, link: false, font: null });
  const readCaret = () => {
    const el = ref.current;
    const range = rangeInEditor();
    if (!el || !range) return;
    const nodes = parseTextHtml(el.innerHTML);
    const start = offsetOf(el, range.startContainer, range.startOffset);
    const end = range.collapsed ? start : offsetOf(el, range.endContainer, range.endOffset);
    const model = formatAt(nodes, start, end);
    // The browser knows a bold / italic just switched on at the caret (the next words typed get it); the text doesn't yet.
    const state = (command: 'bold' | 'italic', fallback: boolean) => {
      try { return document.queryCommandState(command); } catch { return fallback; }
    };
    const at = range.collapsed ? start : start + 1;
    const next = { bold: state('bold', model.bold), italic: state('italic', model.italic), link: model.link, font: fontAt(nodes, at) };
    // The size from the text too (Chris, 6 Nov): after a whole-section change the caret sits after the last word,
    // between nodes, where the elements around it said Normal.
    setCaretSize(textSizeOf(sizeAtOffset(nodes, at) ?? 16)?.value ?? 'normal');
    setCaret((prev) => (prev.bold === next.bold && prev.italic === next.italic && prev.link === next.link && prev.font === next.font ? prev : next));
  };
  const readCaretRef = useRef(readCaret);
  readCaretRef.current = readCaret;
  useEffect(() => {
    if (!selected || readOnly) return undefined;
    const onSelection = () => readCaretRef.current();
    // keyup / mouseup too: Ctrl+B with a caret changes no selection, nor does a click on the words already selected.
    const el = ref.current;
    onSelection();
    document.addEventListener('selectionchange', onSelection);
    el?.addEventListener('keyup', onSelection);
    el?.addEventListener('mouseup', onSelection);
    return () => {
      document.removeEventListener('selectionchange', onSelection);
      el?.removeEventListener('keyup', onSelection);
      el?.removeEventListener('mouseup', onSelection);
    };
  }, [selected, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  const applySize = (value: TextSize) => {
    const el = ref.current;
    const size = TEXT_SIZES.find((s) => s.value === value);
    if (!el || !size) return;
    focusWithSelection();
    // Worked out on the text itself (review, 5 Nov), not with the browser's font command: the selected words (as
    // character offsets), or everything when nothing is selected, then the words are drawn again from clean html.
    const picked = rangeInEditor();
    const sel = picked && !picked.collapsed ? { start: offsetOf(el, picked.startContainer, picked.startOffset), end: offsetOf(el, picked.endContainer, picked.endOffset) } : null;
    const html = editorHtml(serializeTextNodes(resizeTextNodes(parseTextHtml(el.innerHTML), size.px, sel)));
    show(html, sel);
    setCaretSize(value);
    emit('format');
    readCaret();
  };
  // Font family (Chris, 6 Nov): exactly as the font size, on the selected words or else the whole section.
  const applyFont = (font: FontKey | null) => {
    const el = ref.current;
    if (!el) return;
    focusWithSelection();
    const picked = rangeInEditor();
    const sel = picked && !picked.collapsed ? { start: offsetOf(el, picked.startContainer, picked.startOffset), end: offsetOf(el, picked.endContainer, picked.endOffset) } : null;
    const html = editorHtml(serializeTextNodes(fontTextNodes(parseTextHtml(el.innerHTML), font, sel)));
    show(html, sel);
    emit('format');
    readCaret();
  };

  return (
    <div className="relative">
      {selected && !readOnly ? (
        <div ref={roving.ref} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown} role="toolbar" aria-label="Text formatting" style={{ marginTop: toolbarGap(look.padY) }} className="-mx-3 mb-2 mt-2 inline-flex max-w-[calc(100%+1.5rem)] flex-wrap sm:mx-0 sm:max-w-full items-center gap-0 sm:gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <ToolbarToggle label="Bold" pressed={caret.bold} onClick={() => format('bold')}><Bold className="h-4 w-4" /></ToolbarToggle>
          <ToolbarToggle label="Italic" pressed={caret.italic} onClick={() => format('italic')}><Italic className="h-4 w-4" /></ToolbarToggle>
          <Popover.Root open={linkOpen} onOpenChange={setLinkOpen}>
            <Popover.Anchor asChild>
              <span><ToolbarToggle label="Link" pressed={caret.link} onClick={openLink}><LinkIcon className="h-4 w-4" /></ToolbarToggle></span>
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
          <ToolbarDivider />
          <FontMenu value={caret.font} hint="Select words to change just them; otherwise the whole section." onPick={applyFont}
            onCloseAutoFocus={(e) => { e.preventDefault(); ref.current?.focus(); select(lastRange.current); }} />
          <SizeMenu label="Font size" hint="Select words to size just them; otherwise the whole section." options={TEXT_SIZES} value={caretSize} preview={(v) => TEXT_SIZES.find((s) => s.value === v)?.px ?? 16} onPick={applySize}
            // Back to the words, still selected, so the change can be seen (Radix would focus the button).
            onCloseAutoFocus={(e) => { e.preventDefault(); ref.current?.focus(); select(lastRange.current); }} />
          <AlignMenu value={look.align} onPick={(align) => onChange(stylePatch({ align }))} />
          <TextColorMenu idPrefix={blockId} value={style.color ?? null} shown={look.ink} bg={look.bg} onPick={(color) => onChange(stylePatch({ color }))} />
          <BackgroundMenu idPrefix={blockId} allowImage={false} color={style.background_color ?? null} image={null} textColor={style.color ?? null}
            onColor={(c) => onChange(stylePatch({ background_color: c }))} onImage={() => {}} />
          <SpacingMenu lineSpacing={spacing.line_spacing ?? 'normal'} padding={spacing.padding ?? 'normal'}
            onLineSpacing={(line_spacing) => onChange(spacingPatch({ line_spacing }))} onPadding={(padding) => onChange(spacingPatch({ padding }))} />
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
        onInput={() => emit()}
        onBlur={() => { lastRange.current = rangeInEditor()?.cloneRange() ?? lastRange.current; emit(); }}
        onPaste={onPaste}
        onDragOver={(e) => { if (!readOnly) e.preventDefault(); }}
        onDrop={onDrop} onDragStart={onDragStart} onDragEnd={onDragEnd}
        onKeyDown={onKeyDown}
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}
        style={{ color: look.ink, textAlign: look.align, '--nl-link': textLinkColor(look), ...textSpacingStyle(spacing.line_spacing) } as CSSProperties}
        className={`min-h-[1.625rem] break-words outline-none ${TEXT_CLASS} ${spacing.line_spacing ? SPACED_TEXT_CLASS : ''} ${look.styled ? FLUSH_END_CLASS : ''}`}
      >
        {initial}
      </div>
      {/* A blank editor can still hold <p><br></p>, so the placeholder is drawn over it rather than with :empty. */}
      {empty && !readOnly ? <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 text-base leading-[1.625rem] ${look.ink === '#FFFFFF' ? 'text-white/60' : 'text-gray-300'}`} style={{ textAlign: look.align }}>Write something…</span> : null}
    </div>
  );
}
