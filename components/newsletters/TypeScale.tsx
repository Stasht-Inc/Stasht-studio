import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { TypeScale } from '../../services/newslettersAPI';
import { TEXT_SIZES } from './lib/sectionStyle';
import { TYPE_SCALE_MAX, TYPE_SCALE_MIN, USUAL_SCALE, parsePxInput, sameScale, scaleOf, scaleVars, stepPx, storedScale } from './lib/typeScale';
import { LINK_BUTTON } from './lib/ui';

// Chris (7 Nov, point 4): "WE should be able to edit small, normal, large, x-large and make it whatever size we want, and
// it affects the entire H-class". The newsletter's text sizes (lib/typeScale.ts), given to the editor here: every Text
// span, the Text sections' usual words and every Title are drawn from them (CSS variables set around the email), and
// the Size menus offer "Edit sizes…" (EditSizesPanel). Saved with the newsletter (type_scale); "Use as my default"
// saves them for the account, and new newsletters start from those. Without a provider: the usual sizes, not editable.

interface TypeScaleValue {
  /** Every style's px now. */
  scale: TypeScale;
  editable: boolean;
  /** The account's default sizes (the usual ones when none were saved). */
  accountDefault: TypeScale;
  set(next: TypeScale): void;
  /** Keep these sizes for the account; true when saved. */
  saveDefault(scale: TypeScale): Promise<boolean>;
  /** Why the API refused the sizes, if it did. */
  error: string | null;
}

const TypeScaleContext = createContext<TypeScaleValue>({
  scale: USUAL_SCALE, editable: false, accountDefault: USUAL_SCALE, set: () => {}, saveDefault: async () => false, error: null,
});

export function TypeScaleProvider({ value, accountDefault, editable, onChange, onSaveDefault, error = null, children }: {
  value: TypeScale | null;
  error?: string | null;
  accountDefault: TypeScale | null | undefined;
  editable: boolean;
  onChange(next: TypeScale | null): void;
  onSaveDefault(scale: TypeScale | null): Promise<boolean>;
  children: ReactNode;
}) {
  const scale = useMemo(() => scaleOf(value), [value]);
  // The latest handlers, so the context value only changes with the sizes.
  const handlers = useRef({ onChange, onSaveDefault });
  handlers.current = { onChange, onSaveDefault };
  const ctx = useMemo<TypeScaleValue>(() => ({
    scale,
    editable,
    accountDefault: scaleOf(accountDefault),
    set: (next) => handlers.current.onChange(storedScale(next)),
    saveDefault: (next) => handlers.current.onSaveDefault(storedScale(next)),
    error,
  }), [scale, editable, accountDefault, error]);
  // display: contents — the variables reach everything inside without a box of its own.
  return (
    <TypeScaleContext.Provider value={ctx}>
      <div data-nl-type-scale="" className="contents" style={scaleVars(scale) as CSSProperties}>{children}</div>
    </TypeScaleContext.Provider>
  );
}

export function useTypeScale(): TypeScaleValue {
  return useContext(TypeScaleContext);
}

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
const STEP = `flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent ${FOCUS}`;

/** One style: its name, then − [px] + . A typed size applies once it is a whole number from 10 to 72. */
function SizeRow({ style, label, px, onPx, autoFocus }: { style: string; label: string; px: number; onPx(px: number): void; autoFocus?: boolean }) {
  const [text, setText] = useState(String(px));
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The size changed from outside (Reset, the buttons): show it.
  useEffect(() => { if (parsePxInput(text) !== px) { setText(String(px)); setError(false); } }, [px]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoFocus) inputRef.current?.select(); }, [autoFocus]);
  const id = `nl-size-${style}`;
  const set = (next: number) => { setText(String(next)); setError(false); onPx(next); };
  return (
    <div>
      <div className="flex items-center gap-1">
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-sm text-gray-800">{label}</label>
        <button type="button" aria-label={`${label} smaller`} disabled={px <= TYPE_SCALE_MIN} onClick={() => set(stepPx(px, -1))} className={STEP}>
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <input ref={inputRef} id={id} type="text" inputMode="numeric" value={text} aria-invalid={error} aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const v = parsePxInput(e.target.value);
            setError(false);
            if (v !== null) onPx(v);
          }}
          onBlur={() => { if (parsePxInput(text) === null) setError(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); set(stepPx(px, e.key === 'ArrowUp' ? 1 : -1)); }
          }}
          className={`h-7 w-10 rounded-md border bg-white px-1 text-center text-sm tabular-nums text-gray-900 outline-none focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 ${error ? 'border-red-400' : 'border-gray-200'}`} />
        <span aria-hidden="true" className="w-4 text-xs text-gray-500">px</span>
        <button type="button" aria-label={`${label} bigger`} disabled={px >= TYPE_SCALE_MAX} onClick={() => set(stepPx(px, 1))} className={STEP}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {error ? <p id={`${id}-error`} role="alert" className="mt-0.5 text-right text-xs text-red-600">Use {TYPE_SCALE_MIN} to {TYPE_SCALE_MAX} px.</p> : null}
    </div>
  );
}

/**
 * "Edit sizes…" (Chris, 7 Nov): the px of each style, changed live in the whole newsletter (every Title and Text section
 * that uses it). Reset goes back to the usual sizes; "Use as my default" keeps these for the account's new newsletters.
 */
export function EditSizesPanel() {
  const { scale, set, accountDefault, saveDefault, error } = useTypeScale();
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const isDefault = sameScale(scale, accountDefault);
  const usual = sameScale(scale, USUAL_SCALE);
  const change = (style: keyof TypeScale, px: number) => { setNote(null); set({ ...scale, [style]: px }); };
  const useAsDefault = async () => {
    setSaving(true);
    const ok = await saveDefault(scale);
    setSaving(false);
    setNote(ok ? { ok: true, text: 'Saved. New newsletters start with these sizes.' } : { ok: false, text: "Your default sizes couldn't be saved. Try again." });
  };
  return (
    <div role="group" aria-label="Edit sizes" data-nl-edit-sizes="" className="w-[min(15rem,calc(100vw-2rem))] p-2">
      <p className="mb-2 text-sm font-semibold text-gray-900">Edit sizes</p>
      <div className="space-y-1.5">
        {TEXT_SIZES.map((s, i) => (
          <SizeRow key={s.value} style={s.value} label={s.label} px={scale[s.value]} autoFocus={i === 0} onPx={(px) => change(s.value, px)} />
        ))}
      </div>
      <p className="mt-2 text-xs leading-4 text-gray-500">Changes every word in this size, here and in your titles (titles follow Large and X-Large).</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {/* Never disabled: a focused button that turns disabled drops focus, which closes the menu. */}
        <button type="button" aria-disabled={usual} onClick={() => { if (usual) return; setNote(null); set(USUAL_SCALE); }}
          className={`${LINK_BUTTON} ${usual ? 'cursor-default opacity-50 hover:no-underline' : ''}`}>Reset</button>
        {isDefault && !note ? <span className="text-xs text-gray-500">Your default sizes</span>
          : isDefault ? null
          : <button type="button" onClick={useAsDefault} disabled={saving} className={LINK_BUTTON}>{saving ? 'Saving…' : 'Use as my default'}</button>}
      </div>
      {/* Errors at the bottom (Chris's rule); the saved note too. */}
      {note ? <p role={note.ok ? 'status' : 'alert'} className={`mt-2 text-xs ${note.ok ? 'text-gray-600' : 'text-red-600'}`}>{note.text}</p> : null}
      {error ? <p role="alert" data-nl-sizes-error="" className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
