import { useRef, type KeyboardEvent } from 'react';

import { switchCountLabel } from './lib/campaignsView';

/** count: an optional number shown beside the label (none while it is null/undefined). */
export interface SegmentedOption<T extends string> { value: T; label: string; count?: number | null }

/** The grey pill switch from the prototype (Newsletter | Storeel, Storeels | Newsletters). Arrow keys move. */
export default function SegmentedSwitch<T extends string>({ label, options, value, onChange, className = '' }: {
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange(value: T): void;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 ${className}`}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[index] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`inline-flex h-8 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {option.label}
            {switchCountLabel(option.count) !== null ? (
              <span className={`min-w-[1.5rem] rounded-full px-1.5 text-center text-xs font-medium leading-5 ${active ? 'bg-[#6C60FF]/10 text-[#6C60FF]' : 'bg-gray-200 text-gray-600'}`}>
                {switchCountLabel(option.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
