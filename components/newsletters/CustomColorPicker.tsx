import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Pipette } from 'lucide-react';
import { hexToHsv, hsvToHex, parseHexInput, type Hsv } from './lib/colorPicker';
import { LAYER } from './lib/ui';

// Chris (6 Nov, point 4a): "Custom" opened the browser's colour picker, which shows RGB first and can't be told to show
// HEX. This is Studio's own: a colour area (saturation and brightness), a hue strip and a HEX field, shown first and
// focused, plus the eyedropper where the browser has one (window.EyeDropper). A change applies straight away, as the
// browser's picker did; onClose says which colour the person ended on (to keep it as a recent colour).

type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperCtor | null => (typeof window !== 'undefined' && 'EyeDropper' in window ? (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper : null);

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
const DEFAULT = '#6C60FF';

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

export default function CustomColorPicker({ label, value, active, onChange, onClose }: {
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
  const current = parseHexInput(value) ?? DEFAULT;
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [draft, setDraft] = useState(current);
  const atOpen = useRef(current);
  const changed = useRef(false);
  // The colour changed from outside (a swatch, the HEX field, undo): follow it, keeping the hue when it has none (grey).
  useEffect(() => {
    setHsv((prev) => (hsvToHex(prev) === current ? prev : { ...hexToHsv(current), h: hexToHsv(current).s === 0 ? prev.h : hexToHsv(current).h }));
    setDraft((d) => (parseHexInput(d) === current ? d : current));
  }, [current]);

  // A drag keeps calling the handlers of the moment it began: they read the latest colour from here.
  const latest = useRef({ hsv, current, onChange });
  latest.current = { hsv, current, onChange };
  const pick = (next: Hsv) => {
    latest.current.hsv = next;
    setHsv(next);
    const hex = hsvToHex(next);
    setDraft(hex);
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
  const typed = (text: string) => {
    setDraft(text);
    const hex = parseHexInput(text);
    if (hex && hex !== latest.current.current) {
      changed.current = true;
      latest.current.current = hex;
      setHsv((prev) => ({ ...hexToHsv(hex), h: hexToHsv(hex).s === 0 ? prev.h : hexToHsv(hex).h }));
      onChange(hex);
    }
  };
  const Dropper = eyeDropper();
  const sample = async () => {
    if (!Dropper) return;
    try {
      const hex = parseHexInput((await new Dropper().open()).sRGBHex);
      if (hex) typed(hex);
    } catch { /* closed with Escape */ }
  };
  const openChange = (next: boolean) => {
    if (next) {
      atOpen.current = current;
      changed.current = false;
      setHsv(hexToHsv(current));
      setDraft(current);
    } else {
      const end = latest.current.current;
      onClose(changed.current && end !== atOpen.current ? end : null);
    }
    setOpen(next);
  };
  const invalid = parseHexInput(draft) === null;
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <Popover.Root open={open} onOpenChange={openChange}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`${label}: custom colour`} aria-haspopup="dialog"
          className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs text-gray-700 ${FOCUS} ${active ? 'border-gray-900' : 'border-gray-200'}`}>
          <span aria-hidden="true" className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: active ? current : value || undefined }} />
          Custom
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={6} collisionPadding={12} style={{ zIndex: LAYER.popover + 1 }}
          role="dialog" aria-label={`${label}: custom colour`} data-nl-color-picker=""
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector<HTMLInputElement>('input')?.select(); }}
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
              <input type="text" value={draft} maxLength={7} spellCheck={false} autoComplete="off" aria-label="HEX colour" aria-invalid={invalid}
                onChange={(e) => typed(e.target.value)}
                onBlur={() => { if (invalid) setDraft(current); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!invalid) openChange(false); } }}
                className={`h-8 w-full min-w-0 rounded-lg border bg-white px-2 font-mono text-sm uppercase text-gray-900 outline-none focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 ${invalid ? 'border-red-400' : 'border-gray-200'}`} />
            </label>
            {Dropper ? (
              <button type="button" aria-label="Pick a colour from the screen" title="Pick a colour from the screen" onClick={sample}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 ${FOCUS}`}>
                <Pipette className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {invalid ? <p role="alert" className="mt-1.5 text-xs text-red-600">Use 6 characters, like #6C60FF.</p> : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
