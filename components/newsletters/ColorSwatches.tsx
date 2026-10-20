import { useRef, type KeyboardEvent } from 'react';
import { COLOR_SWATCHES } from './lib/colors';
import { LABEL } from './lib/ui';

/** Six preset colours (radios, arrow keys move) plus "Custom" (the browser's colour picker). */
export default function ColorSwatches({ label, idPrefix, value, onChange }: {
  label: string;
  idPrefix: string;
  value: string;
  onChange(color: string): void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = COLOR_SWATCHES.findIndex((s) => s.value.toLowerCase() === value.toLowerCase());
  const custom = activeIndex === -1;
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + COLOR_SWATCHES.length) % COLOR_SWATCHES.length;
    onChange(COLOR_SWATCHES[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <p id={`${idPrefix}-label`} className={LABEL}>{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-labelledby={`${idPrefix}-label`} className="flex flex-wrap items-center gap-2">
          {COLOR_SWATCHES.map((swatch, index) => {
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
                tabIndex={active || (custom && index === 0) ? 0 : -1}
                onClick={() => onChange(swatch.value)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className={`h-7 w-7 rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 focus-visible:ring-offset-1 ${active ? 'border-gray-900' : 'border-white shadow-[0_0_0_1px_#e5e7eb]'}`}
                style={{ backgroundColor: swatch.value }}
              />
            );
          })}
        </div>
        <label className={`relative flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-xs text-gray-700 focus-within:ring-2 focus-within:ring-[#6C60FF]/40 ${custom ? 'border-gray-900' : 'border-gray-200'}`}>
          <span aria-hidden="true" className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: value }} />
          Custom
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#6c60ff'} aria-label={`${label}: custom colour`}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  );
}
