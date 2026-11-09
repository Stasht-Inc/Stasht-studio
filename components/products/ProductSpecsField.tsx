// components/products/ProductSpecsField.tsx — specifications as label/value rows (spec "Details"), and the chips input
// used for tags, collections and option values.
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { BUTTON_SMALL, LINK_BUTTON, inputClass } from '../newsletters/lib/ui';

export function ChipsInput({ label, values, onChange, placeholder, disabled, invalid }: {
  label: string; values: string[]; onChange(values: string[]): void; placeholder?: string; disabled?: boolean; invalid?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className={`flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1 ${invalid ? 'border-red-400' : 'border-gray-200'} ${disabled ? 'bg-gray-50' : 'bg-white focus-within:border-[#6C60FF] focus-within:ring-2 focus-within:ring-[#6C60FF]/20'}`}>
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
          {v}
          {!disabled && <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>}
        </span>
      ))}
      {disabled && values.length === 0 && <span className="py-1 text-sm text-gray-400">None</span>}
      {!disabled && (
        <input aria-label={label} value={draft} maxLength={50} placeholder={values.length ? '' : placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            else if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
          }}
          className="min-w-[8rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-gray-400" />
      )}
    </div>
  );
}

export default function ProductSpecsField({ rows, onChange, disabled }: {
  rows: Array<{ label: string; value: string }>; onChange(rows: Array<{ label: string; value: string }>): void; disabled: boolean;
}) {
  const set = (i: number, patch: Partial<{ label: string; value: string }>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  if (disabled && rows.length === 0) return <p className="text-sm text-gray-500">None</p>;
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input aria-label={`Specification ${i + 1} label`} placeholder="Material" maxLength={100} value={r.label} disabled={disabled} onChange={(e) => set(i, { label: e.target.value })} className={inputClass()} />
          <input aria-label={`Specification ${i + 1} value`} placeholder="Solid oak" maxLength={500} value={r.value} disabled={disabled} onChange={(e) => set(i, { value: e.target.value })} className={inputClass()} />
          {!disabled && <button type="button" aria-label={`Remove specification ${i + 1}`} className={BUTTON_SMALL} onClick={() => onChange(rows.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>}
        </div>
      ))}
      {!disabled && rows.length < 50 && <button type="button" className={LINK_BUTTON} onClick={() => onChange([...rows, { label: '', value: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />Add a specification</button>}
    </div>
  );
}
