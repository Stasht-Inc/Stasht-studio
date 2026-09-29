// components/widgets/builderFields.tsx
// Form bits shared by the Contact Us widget builder's sections, so every input looks the same.
import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';

export const inputClass =
  'w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6C60FF]/40 focus:border-[#6C60FF]';
export const errorInputClass = ' !border-red-400 !bg-red-50';

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs text-red-600 mt-1">{message}</p>;
}

// Native <select> arrows ignore padding and sit on the edge; draw our own chevron instead.
export function SelectField({
  wrapperClassName = '',
  selectClassName = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string; selectClassName?: string }) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select {...props} className={`${inputClass} appearance-none pr-10 cursor-pointer ${selectClassName}`}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
    </div>
  );
}
