// components/products/ProductSelect.tsx — the Studio Select (components/ui/select, Radix) as Campaigns uses it for its
// "All Categories" / author / label filters (pages/MemoriesPage.tsx, components/CategoryNav.tsx "Category Filter"):
// gray-50 trigger, white list, gray hover / focus (never purple). Chris, 16 Nov: Products reuses that dropdown instead
// of native <select>s. aria-invalid / aria-describedby (from the editor's Field) go on the trigger.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

/** Campaigns' filter trigger (MemoriesPage / CategoryNav). */
export const FILTER_TRIGGER = 'bg-gray-50 border-gray-200 hover:border-gray-300 focus:bg-gray-50 focus:border-gray-300 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none transition-colors';
/** Campaigns' SelectItem classes. */
export const SELECT_ITEM = 'cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:text-gray-900 focus:outline-none';
/** The editor's fields: the same box as its inputs (newsletters/lib/ui inputClass: white, gray-200 border, h-9). */
export const fieldTrigger = (invalid = false): string =>
  `h-9 rounded-lg bg-white text-gray-900 ${invalid ? 'border-red-400' : 'border-gray-200'} focus:border-[#6C60FF] focus-visible:ring-2 focus-visible:ring-[#6C60FF]/20 disabled:bg-gray-50 disabled:text-gray-500`;

export interface SelectOption { value: string; label: string }

export default function ProductSelect({ id, value, onChange, options, placeholder, disabled, className, contentClassName, label, ...aria }: {
  id?: string;
  value: string;
  onChange(value: string): void;
  options: readonly SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Extra classes for the open list (e.g. a z-index above the newsletter composer). */
  contentClassName?: string;
  /** aria-label, when no <label htmlFor> names it. */
  label?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} aria-invalid={aria['aria-invalid']} aria-describedby={aria['aria-describedby']} className={className ?? fieldTrigger(Boolean(aria['aria-invalid']))}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={`bg-white border border-gray-200 shadow-lg ${contentClassName ?? ''}`}>
        {options.map((o) => <SelectItem key={o.value} value={o.value} className={SELECT_ITEM}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
