import { useRef, type KeyboardEvent } from 'react';
import { COLOR_SWATCHES } from './lib/colors';
import { LABEL } from './lib/ui';
import CustomColorPicker from './CustomColorPicker';
import { useRecentColors } from './RecentColors';

type Swatch = { value: string; name: string };

/** One row of colour radios: arrow keys move and pick, one Tab stop (the picked one, else the first). */
function SwatchGroup({ list, value, onChange, labelledBy, label, recent = false }: {
  list: ReadonlyArray<Swatch>;
  value: string;
  onChange(color: string): void;
  labelledBy?: string;
  label?: string;
  recent?: boolean;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = list.findIndex((s) => s.value.toLowerCase() === value.toLowerCase());
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + list.length) % list.length;
    onChange(list[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={label} data-nl-recent-colors={recent ? '' : undefined} className="flex flex-wrap items-center gap-2">
      {list.map((swatch, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={swatch.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={swatch.name}
            title={swatch.name}
            tabIndex={active || (activeIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onChange(swatch.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`h-7 w-7 rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 focus-visible:ring-offset-1 ${active ? 'border-white ring-2 ring-gray-900 ring-offset-1' : 'border-white shadow-[0_0_0_1px_#e5e7eb]'}`}
            style={{ backgroundColor: swatch.value }}
          />
        );
      })}
    </div>
  );
}

/** Preset colours (radios, arrow keys move), "Custom" (Studio's own picker with a HEX field, Chris 6 Nov) and, next to
 *  it, the account's recent custom colours (the same in every colour panel). swatches: another set (a section's
 *  background, Chris 5 Nov). value '': none picked yet (no swatch and not Custom is marked). */
export default function ColorSwatches({ label, idPrefix, value, onChange, swatches: presets = COLOR_SWATCHES }: {
  label: string;
  idPrefix: string;
  value: string;
  onChange(color: string): void;
  swatches?: ReadonlyArray<Swatch>;
}) {
  const recent = useRecentColors();
  const root = useRef<HTMLDivElement>(null);
  const isPreset = (c: string) => presets.some((s) => s.value.toLowerCase() === c.toLowerCase());
  // Recent colours that aren't one of this panel's presets already.
  const recents = recent.colors.filter((c) => !isPreset(c)).map((c) => ({ value: c, name: `Recent colour ${c}` }));
  const custom = value !== '' && !isPreset(value) && !recents.some((s) => s.value.toLowerCase() === value.toLowerCase());
  return (
    <div ref={root}>
      <p id={`${idPrefix}-label`} className={LABEL}>{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SwatchGroup list={presets} value={value} onChange={onChange} labelledBy={`${idPrefix}-label`} />
        <CustomColorPicker label={label} value={value} active={custom} onChange={onChange} container={root}
          onClose={(color) => { if (color && !isPreset(color)) recent.add(color); }} />
        {recents.length ? <SwatchGroup list={recents} value={value} onChange={onChange} label={`${label}: recent colours`} recent /> : null}
      </div>
    </div>
  );
}
