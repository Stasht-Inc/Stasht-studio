import { forwardRef, useEffect, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { newslettersAPI, type LeadOption } from '../../services/newslettersAPI';
import { GENERIC_ERROR } from './lib/apiResult';
import { personDetail, personName } from './lib/audience';
import { moveFocusWithArrows } from './arrowKeys';
import { BUTTON_SMALL, LAYER, inputClass } from './lib/ui';

const SEARCH_DELAY_MS = 300;

export interface LeadPickerProps {
  /** The picked lead (audience [{type: 'lead', id}]), or null. */
  leadId: number | null;
  readOnly: boolean;
  /** Only call the API on a paid plan with the Newsletter tab showing (contract note 1). */
  enabled: boolean;
  invalid?: boolean;
  onPick(lead: LeadOption): void;
  /** The picked lead's name once known (for the step's summary), null when there is none. */
  onNameChange?(name: string | null): void;
  /** For aria-labelledby: the field's label. */
  labelId: string;
}

/**
 * "Single person" (Chris, 3 Nov 2026): pick one of your leads for this newsletter. A field like "Send to" that opens
 * a search of your leads by name, email or phone (GET /newsletters/lead-options, newest first). A saved pick is read
 * back by its id when the draft opens.
 */
const LeadPicker = forwardRef<HTMLButtonElement, LeadPickerProps>(function LeadPicker({ leadId, readOnly, enabled, invalid = false, onPick, onNameChange, labelId }, ref) {
  const [open, setOpen] = useState(false);
  // The picked lead's details: from the pick itself, or read back by id (undefined: loading; null: not found).
  const [chosen, setChosen] = useState<LeadOption | null | undefined>(leadId ? undefined : null);
  useEffect(() => {
    if (!leadId) { setChosen(null); return undefined; }
    if (chosen && chosen.id === leadId) return undefined;
    if (!enabled) return undefined;
    let cancelled = false;
    setChosen(undefined);
    void newslettersAPI.leadOptions({ lead_id: leadId }).then((res) => {
      if (cancelled) return;
      setChosen(res.ok && res.data ? (res.data.data.find((l) => l.id === leadId) ?? null) : null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, enabled]);
  const onNameRef = useRef(onNameChange);
  onNameRef.current = onNameChange;
  useEffect(() => { onNameRef.current?.(chosen ? personName(chosen) : null); }, [chosen]);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<LeadOption[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setQuery('');
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search, open]);
  useEffect(() => {
    if (!open || !enabled) return;
    const request = ++requestRef.current;
    setRows(null);
    setError(null);
    void newslettersAPI.leadOptions({ search: query }).then((res) => {
      if (request !== requestRef.current) return;
      if (res.ok && res.data) {
        setRows(res.data.data);
        setTotal(res.data.meta?.total ?? res.data.data.length);
      } else {
        setRows([]);
        setError(res.error ?? GENERIC_ERROR);
      }
    });
  }, [open, query, attempt, enabled]);

  const pick = (lead: LeadOption) => {
    setChosen(lead);
    setOpen(false);
    onPick(lead);
  };

  let value;
  if (chosen === undefined) value = <span className="truncate text-gray-500">Loading…</span>;
  else if (chosen === null) {
    value = <span className="truncate text-gray-500">{leadId ? 'A lead that was deleted' : 'Choose a person from your Leads'}</span>;
  } else {
    const detail = chosen.unsubscribed ? 'Unsubscribed' : personDetail(chosen);
    value = (
      <span className="min-w-0 truncate">
        <span className="text-gray-900">{personName(chosen)}</span>
        {detail ? <span className="text-gray-500"> · {detail}</span> : null}
      </span>
    );
  }

  let body;
  if (rows === null) {
    body = <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Searching your leads…</p>;
  } else if (error) {
    body = (
      <div role="alert" className="px-3 py-5 text-center">
        <p className="text-sm text-gray-700">{error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-3`}>Try again</button>
      </div>
    );
  } else if (rows.length === 0) {
    body = <p className="px-3 py-6 text-center text-sm text-gray-600">{query ? `No leads match “${query}”.` : 'You have no leads yet.'}</p>;
  } else {
    body = (
      <ul aria-label="Your leads">
        {rows.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => pick(l)} aria-current={l.id === leadId ? 'true' : undefined}
              className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${l.id === leadId ? 'bg-[#6C60FF]/5' : ''}`}>
              <span className="block w-full truncate text-sm text-gray-900">{personName(l)}</span>
              {personDetail(l) ? <span className="block w-full truncate text-xs text-gray-500">{personDetail(l)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button ref={ref} type="button" disabled={readOnly} aria-labelledby={`${labelId} nl-person-value`}
          className={`${inputClass(invalid)} flex items-center justify-between gap-2 text-left`}>
          <span id="nl-person-value" className="flex min-w-0">{value}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={10}
          style={{ zIndex: LAYER.popover, width: 'var(--radix-popover-trigger-width)' }}
          onKeyDown={(e) => moveFocusWithArrows(e)}
          aria-label="Choose a person"
          className="flex max-h-[min(400px,var(--radix-popover-content-available-height))] min-w-[260px] max-w-[calc(100vw-20px)] flex-col rounded-xl border border-gray-200 bg-white p-2 shadow-lg outline-none">
          <div className="relative flex-shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search your leads by name, email or phone"
              placeholder="Name, email or phone" className={`${inputClass(false)} pl-9`} />
          </div>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto">{body}</div>
          {rows && rows.length && total > rows.length ? (
            <p className="flex-shrink-0 border-t border-gray-100 px-3 pt-2 text-xs text-gray-500">Showing {rows.length} of {total}. Search to find someone else.</p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

export default LeadPicker;
