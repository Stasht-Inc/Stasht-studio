import { useRef, type KeyboardEvent } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

export type PreviewDevice = 'desktop' | 'phone';

const OPTIONS: Array<{ value: PreviewDevice; label: string; Icon: typeof Monitor }> = [
  { value: 'desktop', label: 'Desktop view', Icon: Monitor },
  { value: 'phone', label: 'Phone view', Icon: Smartphone },
];

/** Desktop / phone width for the preview (radios; arrow keys move). */
export default function DeviceToggle({ value, onChange }: { value: PreviewDevice; onChange(value: PreviewDevice): void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = (index + 1) % OPTIONS.length;
    onChange(OPTIONS[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Preview size" className="inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      {OPTIONS.map(({ value: v, label, Icon }, index) => {
        const active = v === value;
        return (
          <button key={v} ref={(el) => { refs.current[index] = el; }} type="button" role="radio" aria-checked={active} aria-label={label} title={label}
            tabIndex={active ? 0 : -1} onClick={() => onChange(v)} onKeyDown={(e) => onKeyDown(e, index)}
            className={`flex h-8 w-9 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 ${active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
