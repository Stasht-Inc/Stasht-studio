import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { AlignCenter, AlignLeft, AlignRight, Check, ChevronDown, PaintBucket, Type } from 'lucide-react';
import type { FontKey, SectionAlign } from '../../../services/newslettersAPI';
import { DEFAULT_FONT_LABEL, DEFAULT_FONT_STACK, FONTS, fontLabel, fontStack } from '../lib/fonts';
import ColorSwatches from '../ColorSwatches';
import SegmentedSwitch from '../SegmentedSwitch';
import { useImageUpload } from '../hooks/useImageUpload';
import { FALLBACK_HINT } from '../lib/headerDesign';
import { ALIGN_OPTIONS, BACKGROUND_SWATCHES, IMAGE_FALLBACK, TITLE_BACKGROUND_MODES, TITLE_INK, poorContrast, readableInk, type TitleBackgroundMode } from '../lib/sectionStyle';
import { BUTTON_SMALL, LAYER, LINK_BUTTON } from '../lib/ui';

// Chris (5 Nov, points 2 and 3): one compact style toolbar for the Title and Text sections, laid out like the block
// toolbars in Mailchimp / Beehiiv: Size, Align, Text colour and Background, each a small button that opens its choices.
// Every control keeps the text selection (pointer down is not a focus change), so the Text section's font size acts
// on the words that were selected.

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
export const TOOL_BUTTON = `flex h-8 min-w-[1.75rem] items-center justify-center gap-0.5 rounded-md px-1 text-gray-700 sm:min-w-[2rem] hover:bg-gray-100 data-[state=open]:bg-gray-100 ${FOCUS}`;
const ALIGN_ICON: Record<SectionAlign, ReactNode> = {
  left: <AlignLeft className="h-4 w-4" aria-hidden="true" />,
  center: <AlignCenter className="h-4 w-4" aria-hidden="true" />,
  right: <AlignRight className="h-4 w-4" aria-hidden="true" />,
};

// Under 640 px the menus drop their ▾ so the Text toolbar (with Font, Chris 6 Nov) stays one row on a phone.
const CHEVRON = 'hidden h-3 w-3 text-gray-500 sm:block';

export function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-px h-5 w-px bg-gray-200" />;
}

/** Under this width a panel opens below the whole section, so it never covers the words being styled. */
const NARROW = '(max-width: 639px)';

/**
 * A toolbar button that opens a small panel. onCloseAutoFocus: where focus goes when it closes (default: the button).
 * list: a menu of choices (arrow keys move, the current choice has focus first). A wide panel on a phone is placed
 * below the section (above it when there is no room), never over it.
 */
function ToolMenu({ label, tooltip, trigger, children, open, onOpenChange, onCloseAutoFocus, wide = false, list = false }: {
  label: string;
  /** The button's tooltip (default: its label). */
  tooltip?: string;
  trigger: ReactNode;
  children: ReactNode;
  open: boolean;
  onOpenChange(open: boolean): void;
  onCloseAutoFocus?(e: Event): void;
  wide?: boolean;
  list?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchor = useRef({
    getBoundingClientRect: (): DOMRect => {
      const button = triggerRef.current;
      const section = button?.closest<HTMLElement>('[data-block-id]');
      const narrow = typeof window !== 'undefined' && window.matchMedia(NARROW).matches;
      return (wide && narrow && section ? section : button)?.getBoundingClientRect() ?? new DOMRect();
    },
  });
  const onListKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (at + 1) % items.length : e.key === 'ArrowUp' ? (at - 1 + items.length) % items.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor virtualRef={anchor} />
      <Popover.Trigger asChild>
        <button ref={triggerRef} type="button" aria-label={label} title={tooltip ?? label} onMouseDown={(e) => e.preventDefault()} className={TOOL_BUTTON}>
          {trigger}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={6} collisionPadding={12} style={{ zIndex: LAYER.popover }} onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={list ? (e) => {
            e.preventDefault();
            const el = e.currentTarget as HTMLElement;
            (el.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]') ?? el.querySelector<HTMLButtonElement>('[role="menuitemradio"]'))?.focus();
          } : undefined}
          onKeyDown={list ? onListKeys : undefined}
          // A click inside the panel never reaches the email preview behind it (which would close the section).
          onClick={(e) => e.stopPropagation()}
          className={`${wide ? 'w-[min(22.5rem,calc(100vw-1.5rem))] p-4' : 'min-w-[9rem] p-1'} rounded-xl border border-gray-200 bg-white shadow-lg outline-none`}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A small note in a panel when the words would be hard to read (under 4.5:1). */
function ContrastNote() {
  return <p role="status" data-nl-contrast-note="" className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Hard to read on this background. Try a darker or lighter colour.</p>;
}

/** One choice in a list panel (Size, Align): a tick on the current one. */
function MenuChoice({ label, checked, onPick, icon, style }: { label: string; checked: boolean; onPick(): void; icon?: ReactNode; style?: CSSProperties }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={checked} onMouseDown={(e) => e.preventDefault()} onClick={onPick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-800 hover:bg-gray-100 ${FOCUS}`}>
      {icon}
      <span className="flex-1" style={style}>{label}</span>
      {checked ? <Check className="h-4 w-4 text-[#6C60FF]" aria-hidden="true" /> : <span className="w-4" aria-hidden="true" />}
    </button>
  );
}

/** "Size: Large ▾" — the title's size (Small / Medium / Large) or the text's font size (Small … X-Large). */
export function SizeMenu<T extends string>({ label, options, value, onPick, onCloseAutoFocus, preview, hint, editSizes }: {
  label: string;
  /** Chris, 7 Nov: "Edit sizes…" at the bottom opens this (the newsletter's text sizes) in place of the choices. */
  editSizes?: ReactNode;
  /** A line under the choices (the Text section: what the size applies to). */
  hint?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onPick(value: T): void;
  onCloseAutoFocus?(e: Event): void;
  /** Each choice drawn at its size (px). */
  preview?: (value: T) => number;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';
  return (
    <ToolMenu label={`${label}: ${current}`} open={open} onOpenChange={(next) => { setOpen(next); if (!next) setEditing(false); }} onCloseAutoFocus={onCloseAutoFocus} list={!editing}
      trigger={<><span className="text-sm font-medium">{current}</span><ChevronDown className={CHEVRON} aria-hidden="true" /></>}>
      {editing && editSizes ? editSizes : <>
      <div role="menu" aria-label={label}>
        {options.map((o) => (
          <MenuChoice key={o.value} label={o.label} checked={o.value === value} style={preview ? { fontSize: `${preview(o.value)}px`, lineHeight: 1.3 } : undefined}
            onPick={() => { setOpen(false); onPick(o.value); }} />
        ))}
      </div>
      {hint ? <p className="max-w-[12rem] px-2.5 pb-1.5 pt-1 text-xs leading-4 text-gray-500">{hint}</p> : null}
      {editSizes ? (
        <div className="mt-1 border-t border-gray-100 pt-1">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setEditing(true)}
            className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 ${FOCUS}`}>Edit sizes…</button>
        </div>
      ) : null}
      </>}
    </ToolMenu>
  );
}

/**
 * "Font: Georgia ▾" (Chris, 6 Nov): Default and the email-safe fonts, each choice drawn in its own font. The button
 * shows the font where the caret is, in that font; on a phone just "Aa" in it, so the toolbar stays one row.
 */
export function FontMenu({ value, onPick, onCloseAutoFocus, hint }: {
  value: FontKey | null;
  onPick(value: FontKey | null): void;
  onCloseAutoFocus?(e: Event): void;
  /** A line under the choices (the Text section: what the font applies to). */
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = fontLabel(value);
  const stack = fontStack(value);
  return (
    // Chris (7 Nov, point 3): it reads as a font control: a font icon and the font's name (never "Default" alone), tooltip "Font".
    <ToolMenu label={`Font: ${current}`} tooltip="Font" open={open} onOpenChange={setOpen} onCloseAutoFocus={onCloseAutoFocus} list
      trigger={<>
        <Type className="hidden h-3.5 w-3.5 shrink-0 text-gray-500 sm:block" aria-hidden="true" />
        <span className="hidden max-w-[6.5rem] truncate text-sm font-medium sm:inline" style={{ fontFamily: stack }}>{current}</span>
        <span className="text-sm font-medium sm:hidden" style={{ fontFamily: stack }}>Aa</span>
        <ChevronDown className={CHEVRON} aria-hidden="true" />
      </>}>
      <div role="menu" aria-label="Font">
        {[{ value: null, label: `${DEFAULT_FONT_LABEL} (default)`, stack: DEFAULT_FONT_STACK }, ...FONTS].map((f) => (
          <MenuChoice key={f.value ?? 'default'} label={f.label} checked={f.value === value} style={{ fontFamily: f.stack }}
            onPick={() => { setOpen(false); onPick(f.value); }} />
        ))}
      </div>
      {hint ? <p className="max-w-[12rem] px-2.5 pb-1.5 pt-1 text-xs leading-4 text-gray-500">{hint}</p> : null}
    </ToolMenu>
  );
}

/** Bold / Italic / Link (Chris, 6 Nov): pressed (aria-pressed, tinted) when the words at the caret have it. */
export function ToolbarToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onMouseDown={(e) => e.preventDefault()} // keep the text selection
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${pressed ? 'bg-[#EEEDFF] text-[#6C60FF]' : 'text-gray-700 hover:bg-gray-100'} ${FOCUS}`}
    >
      {children}
    </button>
  );
}

export function AlignMenu({ value, onPick }: { value: SectionAlign; onPick(value: SectionAlign): void }) {
  const [open, setOpen] = useState(false);
  const current = ALIGN_OPTIONS.find((o) => o.value === value) ?? ALIGN_OPTIONS[0];
  return (
    <ToolMenu label={`Align: ${current.label}`} open={open} onOpenChange={setOpen} list trigger={<>{ALIGN_ICON[current.value]}<ChevronDown className={CHEVRON} aria-hidden="true" /></>}>
      <div role="menu" aria-label="Align">
        {ALIGN_OPTIONS.map((o) => (
          <MenuChoice key={o.value} label={o.label} icon={ALIGN_ICON[o.value]} checked={o.value === value} onPick={() => { setOpen(false); onPick(o.value); }} />
        ))}
      </div>
    </ToolMenu>
  );
}

/** "A" with a bar in the words' colour: the swatches and Custom; Automatic goes back to the usual colour. */
export function TextColorMenu({ idPrefix, value, shown, onPick, bg = null }: {
  idPrefix: string;
  /** The band's colour, to warn when the picked colour is hard to read on it. */
  bg?: string | null;
  /** The picked colour, or null (automatic). */
  value: string | null;
  /** The colour the words have now (automatic included), for the bar under the A. */
  shown: string;
  onPick(color: string | null): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ToolMenu label="Text colour" open={open} onOpenChange={setOpen} wide
      trigger={<span aria-hidden="true" className="flex flex-col items-center leading-none"><span className="text-sm font-semibold">A</span><span className="mt-0.5 h-1 w-4 rounded-sm border border-gray-300" style={{ backgroundColor: shown }} /></span>}>
      <ColorSwatches label="Text colour" idPrefix={`${idPrefix}-ink`} value={value ?? ''} onChange={(c) => onPick(c)} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{value ? 'Your colour' : 'Automatic: reads on the background'}</span>
        {value ? <button type="button" onClick={() => onPick(null)} className={LINK_BUTTON}>Automatic</button> : null}
      </div>
      {poorContrast(value, bg) ? <ContrastNote /> : null}
    </ToolMenu>
  );
}

/**
 * The section's background. Colour: the swatches (soft tints first) and Custom; No background takes it away. A title
 * also has Image (the header's pattern): a picture behind the words, the colour kept as the fallback for email apps
 * that hide pictures.
 */
export function BackgroundMenu({ idPrefix, color, image, allowImage, onColor, onImage, onMode, textColor = null, sampleText = '' }: {
  idPrefix: string;
  /** A text colour that was picked, to warn when it is hard to read on the band. */
  textColor?: string | null;
  /** The words, for the fallback sample (how the section reads where pictures are hidden). */
  sampleText?: string;
  color: string | null;
  image: string | null;
  allowImage: boolean;
  onColor(color: string | null): void;
  onImage(url: string | null): void;
  onMode?(mode: TitleBackgroundMode): void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TitleBackgroundMode>(image ? 'image' : 'color');
  useEffect(() => { if (image) setMode('image'); }, [image]);
  const upload = useImageUpload((url) => onImage(url), `${idPrefix}-bg-input`);
  const chip = image ? null : color;
  const choose = (next: TitleBackgroundMode) => {
    setMode(next);
    onMode?.(next);
  };
  return (
    <>
      {upload.input}
      <ToolMenu label="Section background" open={open} onOpenChange={setOpen} wide
        trigger={<span aria-hidden="true" className="relative flex items-center">
          <PaintBucket className="h-4 w-4" />
          <span className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-white ${chip ? '' : image ? 'bg-gray-400' : 'bg-transparent'}`} style={chip ? { backgroundColor: chip } : undefined} />
        </span>}>
        <div className="space-y-3">
          {allowImage ? <SegmentedSwitch label="Section background" options={TITLE_BACKGROUND_MODES} value={mode} onChange={choose} /> : null}
          {allowImage && mode === 'image' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={upload.choose} disabled={upload.uploading} className={BUTTON_SMALL}>
                {upload.uploading ? 'Uploading…' : image ? 'Replace image' : 'Upload image'}
              </button>
              {image ? <button type="button" onClick={() => onImage(null)} className={LINK_BUTTON}>Remove image</button> : null}
            </div>
          ) : null}
          <div>
            <ColorSwatches label={allowImage && mode === 'image' ? 'Fallback colour' : 'Background colour'} idPrefix={`${idPrefix}-bg`} swatches={BACKGROUND_SWATCHES}
              value={color ?? (allowImage && mode === 'image' ? IMAGE_FALLBACK : '')} onChange={(c) => onColor(c)} />
            {allowImage && mode === 'image' ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {/* As the header's: the fallback colour with words that read on it (the email's Outlook rule). */}
                <span data-nl-fallback-sample="" className="inline-flex h-6 max-w-[12rem] items-center truncate rounded px-2 font-semibold"
                  style={{ backgroundColor: color ?? IMAGE_FALLBACK, color: textColor ?? readableInk(color ?? IMAGE_FALLBACK, TITLE_INK) }}>{sampleText.trim() || 'Your title'}</span>
                {FALLBACK_HINT}
              </p>
            ) : null}
            {!(allowImage && mode === 'image') && poorContrast(textColor, color) ? <ContrastNote /> : null}
          </div>
          {color && !(allowImage && mode === 'image') ? (
            <button type="button" onClick={() => onColor(null)} className={LINK_BUTTON}>No background</button>
          ) : null}
        </div>
      </ToolMenu>
    </>
  );
}

/**
 * The toolbar's keyboard pattern (WAI-ARIA toolbar): one Tab stop (the control used last, the first one to begin
 * with), arrow keys / Home / End move between the controls. So Shift+Tab from the words lands on Bold straight away,
 * however many controls the toolbar has.
 */
export function useRovingToolbar() {
  const ref = useRef<HTMLDivElement>(null);
  const active = useRef(0);
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(':scope button') ?? []);
  const apply = () => items().forEach((b, i) => { b.tabIndex = i === Math.min(active.current, items().length - 1) ? 0 : -1; });
  useEffect(apply);
  return {
    ref,
    onFocus: (e: FocusEvent<HTMLDivElement>) => {
      const i = items().indexOf(e.target as unknown as HTMLButtonElement);
      if (i >= 0 && i !== active.current) { active.current = i; apply(); }
    },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      if (at < 0) return;
      const next = e.key === 'ArrowRight' ? (at + 1) % list.length : e.key === 'ArrowLeft' ? (at - 1 + list.length) % list.length
        : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
      if (next < 0) return;
      e.preventDefault();
      active.current = next;
      apply();
      list[next].focus();
    },
  };
}
