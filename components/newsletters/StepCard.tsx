import type { ReactNode } from 'react';

/** One numbered card in the left column ("1 Name and subject" … "5 Schedule"). */
export default function StepCard({ number, title, id, aside, error, children }: {
  number: number;
  title: string;
  /** DOM id, `nl-step-<key>`; send checks scroll here. */
  id: string;
  aside?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section id={id} tabIndex={-1} aria-labelledby={headingId} className={`scroll-mt-6 rounded-xl border bg-white outline-none ${error ? 'border-red-300' : 'border-gray-200'}`}>
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#6C60FF] text-xs font-semibold text-white">{number}</span>
          <h3 id={headingId} className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        {aside ? <div className="min-w-0 truncate text-sm font-medium text-[#6C60FF]">{aside}</div> : null}
      </header>
      <div className="px-5 py-4">
        {error ? <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {children}
      </div>
    </section>
  );
}
