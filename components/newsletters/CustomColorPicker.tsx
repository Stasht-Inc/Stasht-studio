import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Pipette } from 'lucide-react';
import { hexFieldText, hexToHsv, hsvToHex, parseHexInput, type Hsv } from './lib/colorPicker';
import { LAYER } from './lib/ui';

// Chris (6 Nov, point 4a): "Custom" opened the browser's colour picker, which shows RGB first and can't be told to show
// HEX. This is Studio's own: a colour area (saturation and brightness), a hue strip and a HEX field, shown first and
// focused, plus the eyedropper where the browser has one (window.EyeDropper). A change applies straight away, as the
// browser's picker did; onClose says which colour the person ended on (to keep it as a recent colour).

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperCtor | null => (typeof window !== 'undefined' && 'EyeDropper' in window ? (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper : null);

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
const DEFAULT = '#6C60FF';
const SIX = /^#?[0-9a-f]{6}$/i;

/** Where the picker opens (review, 6 Nov): beside the colour panel it came from on a wide screen (left, flipping right),
 *  above or below it on a phone, under the colours when they are part of a form; never over the panel's colours. */
type Placement = { side: 'left' | 'top' | 'bottom'; anchor: HTMLElement | null };

/** Where a pointer is inside an element, 0–1 on each axis. */
function fraction(e: ReactPointerEvent<HTMLElement> | PointerEvent, el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1))),
  };
}

/** Drag on an element: pointer down and every move while held (the pointer is captured, so it may leave the element). */
function useDrag(onMove: (x: number, y: number) => void) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.focus();
      el.setPointerCapture?.(e.pointerId);
      const at = fraction(e, el);
      onMove(at.x, at.y);
      const move = (ev: PointerEvent) => { const p = fraction(ev, el); onMove(p.x, p.y); };
      const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    },
  };
}

export default function CustomColorPicker({ label, value, active, onChange, onClose, container }: {
  /** The colours this picker belongs with (the picker opens clear of them). */
  container?: RefObject<HTMLElement>;
  /** The panel's label ("Background colour"), for the button and the picker's name. */
  label: string;
  /** The colour now (#RRGGBB), or '' when none is picked. */
  value: string;
  /** The colour now is a custom one (the chip is marked). */
  active: boolean;
  onChange(color: string): void;
  /** The picker closed; color: the colour it ended on, when it was changed while open. */
  onClose(color: string | null): void;
}) {
  const [open, setOpen] = useState(false);
  // Open now (kept in step by openChange; read when the picker is unmounted, Chris 7 Nov).
  const openRef = useRef(false);
  // The colour set now, '' when none is (review, 6 Nov: then typing the default colour still applies it); the picker
  // starts from Studio purple then.
  const actual = parseHexInput(value) ?? '';
  const current = actual || DEFAULT;
  const [showError, setShowError] = useState(false);
  const errorId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [placement, setPlacement] = useState<Placement>({ side: 'bottom', anchor: null });
  const virtualAnchor = useRef({ getBoundingClientRect: (): DOMRect => (placement.anchor ?? triggerRef.current)?.getBoundingClientRect() ?? new DOMRect() });
  virtualAnchor.current.getBoundingClientRect = () => (placement.anchor ?? triggerRef.current)?.getBoundingClientRect() ?? new DOMRect();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [draft, setDraft] = useState(current);
  const atOpen = useRef(actual);
  const changed = useRef(false);
  // Something was typed in the HEX field and not yet settled (Enter, leaving the field, or closing).
  const edited = useRef(false);
  // The colour changed from outside (a swatch, the HEX field, undo): follow it, keeping the hue when it has none (grey).
  useEffect(() => {
    setHsv((prev) => (hsvToHex(prev) === current ? prev : { ...hexToHsv(current), h: hexToHsv(current).s === 0 ? prev.h : hexToHsv(current).h }));
    setDraft((d) => (parseHexInput(d) === current ? d : current));
  }, [current]);

  // A drag keeps calling the handlers of the moment it began: they read the latest colour from here.
  const latest = useRef({ hsv, current: actual, onChange });
  latest.current = { hsv, current: actual, onChange };
  const pick = (next: Hsv) => {
    latest.current.hsv = next;
    setHsv(next);
    const hex = hsvToHex(next);
    setDraft(hex);
    // The field now shows a good colour: no error, nothing typed left to settle (re-review, 6 Nov).
    setShowError(false);
    edited.current = false;
    if (hex !== latest.current.current) {
      changed.current = true;
      latest.current.current = hex;
      latest.current.onChange(hex);
    }
  };
  const area = useDrag((x, y) => pick({ h: latest.current.hsv.h, s: x, v: 1 - y }));
  const hue = useDrag((x) => pick({ ...latest.current.hsv, h: Math.round(x * 360) }));
  const onAreaKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (!d) return;
    e.preventDefault();
    pick({ h: hsv.h, s: Math.min(1, Math.max(0, hsv.s + d[0])), v: Math.min(1, Math.max(0, hsv.v + d[1])) });
  };
  const onHueKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const next = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? hsv.h - step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? hsv.h + step
      : e.key === 'Home' ? 0 : e.key === 'End' ? 360 : null;
    if (next === null) return;
    e.preventDefault();
    pick({ ...hsv, h: Math.min(360, Math.max(0, next)) });
  };
  const apply = (hex: string) => {
    setShowError(false);
    if (hex === latest.current.current) return;
    changed.current = true;
    latest.current.current = hex;
    setHsv((prev) => ({ ...hexToHsv(hex), h: hexToHsv(hex).s === 0 ? prev.h : hexToHsv(hex).h }));
    latest.current.onChange(hex);
  };
  // Typing: spaces dropped (a pasted " #1F6F8B "); a full #RRGGBB applies straight away; nothing is called wrong yet
  // (review, 6 Nov). Shorthand and mistakes are settled on Enter or leaving the field.
  const typed = (text: string) => {
    edited.current = true;
    const clean = hexFieldText(text);
    setDraft(clean);
    setShowError(false);
    if (SIX.test(clean)) apply(parseHexInput(clean) as string);
  };
  /** Enter or leaving the field: #FFF becomes #FFFFFF and applies; anything else says what to type. */
  const settle = (): boolean => {
    // Only what was typed: opening and leaving the field changes nothing (the shown colour may be the default).
    if (!edited.current) return true;
    const hex = parseHexInput(draft);
    if (!hex) {
      setShowError(true);
      return false;
    }
    setDraft(hex);
    apply(hex);
    edited.current = false;
    return true;
  };
  const Dropper = eyeDropper();
  const sample = async () => {
    if (!Dropper) return;
    try {
      const hex = parseHexInput((await new Dropper().open()).sRGBHex);
      if (hex) { setDraft(hex); setShowError(false); apply(hex); }
    } catch { /* closed with Escape */ }
  };
  const openChange = (next: boolean) => {
    if (next) {
      atOpen.current = actual;
      changed.current = false;
      setHsv(hexToHsv(current));
      setDraft(current);
      setShowError(false);
      edited.current = false;
      const panel = triggerRef.current?.closest<HTMLElement>('[data-radix-popper-content-wrapper]') ?? null;
      const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
      setPlacement(panel ? { side: wide ? 'left' : 'top', anchor: panel } : { side: 'bottom', anchor: container?.current ?? null });
    } else {
      // Closed any way (a click outside, Escape) with a good colour typed but not settled, #FFF included: it counts,
      // as with Enter or leaving the field, and becomes a recent colour (re-review, 6 Nov).
      const typedHex = edited.current ? parseHexInput(draft) : null;
      if (typedHex) apply(typedHex);
      edited.current = false;
      const end = latest.current.current;
      onClose(changed.current && end !== atOpen.current ? end : null);
    }
    openRef.current = next;
    setOpen(next);
  };
  // Chris (7 Nov, point 1): a click outside closes the colour panel this picker sits in (and the section's toolbar, as
  // Done does) in the same moment, so the picker is unmounted without its own close ever running and the colour was
  // never kept as a recent one. Unmounted while open counts as closed: the same as a click outside.
  const closeOnUnmount = useRef<() => void>(() => {});
  closeOnUnmount.current = () => {
    if (!openRef.current) return;
    openRef.current = false;
    const typedHex = edited.current ? parseHexInput(draft) : null;
    if (typedHex && typedHex !== latest.current.current) {
      changed.current = true;
      latest.current.current = typedHex;
      latest.current.onChange(typedHex);
    }
    const end = latest.current.current;
    onClose(changed.current && end !== atOpen.current ? end : null);
  };
  useEffect(() => () => closeOnUnmount.current(), []);
  const invalid = showError;
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Anchor virtualRef={virtualAnchor} />
      <Popover.Trigger asChild>
        <button ref={triggerRef} type="button" aria-label={`${label}: custom colour`} aria-haspopup="dialog"
          className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs text-gray-700 ${FOCUS} ${active ? 'border-gray-900' : 'border-gray-200'}`}>
          <span aria-hidden="true" className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: active ? current : value || undefined }} />
          Custom
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side={placement.side} align="start" sideOffset={8} collisionPadding={12} style={{ zIndex: LAYER.popover + 1 }}
          role="dialog" aria-label={`${label}: custom colour`} data-nl-color-picker=""
          // HEX is focused on a mouse/keyboard screen; on a touch screen the colour area is (no keyboard popping up
          // over the picker, review 6 Nov).
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const el = e.currentTarget as HTMLElement;
            if (window.matchMedia('(pointer: coarse)').matches) el.querySelector<HTMLElement>('[data-nl-color-area]')?.focus();
            else el.querySelector<HTMLInputElement>('input')?.select();
          }}
          // A click inside never reaches the email preview or the panel behind it.
          onClick={(e) => e.stopPropagation()}
          className="w-[min(15rem,calc(100vw-1.5rem))] rounded-xl border border-gray-200 bg-white p-3 shadow-lg outline-none">
          <div {...area} role="slider" tabIndex={0} aria-label="Colour" aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            aria-valuenow={Math.round(hsv.s * 100)} aria-valuemin={0} aria-valuemax={100} onKeyDown={onAreaKeys} data-nl-color-area=""
            className={`relative h-32 w-full cursor-crosshair touch-none rounded-lg ${FOCUS}`}
            style={{ backgroundColor: hueColor, backgroundImage: 'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))' }}>
            <span aria-hidden="true" className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hsvToHex(hsv) }} />
          </div>
          <div {...hue} role="slider" tabIndex={0} aria-label="Hue" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} onKeyDown={onHueKeys} data-nl-color-hue=""
            className={`relative mt-3 h-3 w-full cursor-pointer touch-none rounded-full ${FOCUS}`}
            style={{ backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
              style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span aria-hidden="true" className="h-8 w-8 shrink-0 rounded-full border border-gray-200" style={{ backgroundColor: current }} />
            <label className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="text-xs font-medium text-gray-500">HEX</span>
              <input type="text" value={draft} spellCheck={false} autoComplete="off" autoCapitalize="characters" aria-label="HEX colour" aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
                onChange={(e) => typed(e.target.value)}
                onBlur={settle}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (settle()) openChange(false); } }}
                className={`h-8 w-full min-w-0 rounded-lg border bg-white px-2 font-mono text-sm uppercase text-gray-900 outline-none focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 ${invalid ? 'border-red-400' : 'border-gray-200'}`} />
            </label>
            {Dropper ? (
              <button type="button" aria-label="Pick a colour from the screen" title="Pick a colour from the screen" onClick={sample}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 ${FOCUS}`}>
                <Pipette className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {invalid ? <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600">Use a colour like #6C60FF or #FFF.</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
