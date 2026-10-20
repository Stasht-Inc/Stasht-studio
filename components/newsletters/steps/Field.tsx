import type { ReactNode } from 'react';
import { LABEL } from '../lib/ui';

/** The id of a Field's hint / error line, or undefined when it shows neither (aria-describedby must point at
 *  an element that exists). */
export function helpId(id: string, hint?: string | null, error?: string | null): string | undefined {
  return hint || error ? `${id}-help` : undefined;
}

/** Label + control + one hint or error line. Give the control aria-describedby={helpId(id, hint, error)}. */
export default function Field({ id, label, required, optional, hint, error, children }: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
        {required ? <span aria-hidden="true" className="text-[#6C60FF]"> *</span> : null}
        {optional ? <span className="font-normal text-gray-500"> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-help`} role="alert" className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
