import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Search } from 'lucide-react';
import { newslettersAPI, type CampaignItem, type CampaignOption } from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import { GENERIC_ERROR } from './lib/apiResult';
import { httpsUrl } from './lib/urls';
import { CAMPAIGNS_MAX, campaignOptionDisabled, campaignsPickerSummary, formatCampaignDate, itemFromOption, toggleCampaign } from './lib/campaignsBlock';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SMALL, inputClass } from './lib/ui';

const SEARCH_DELAY_MS = 300;

export interface CampaignPickerDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The section's campaigns when the picker opens. */
  initialIds: number[];
  /** Cards already known for those campaigns (kept for ones not on the loaded pages). */
  knownItems: CampaignItem[];
  onDone(ids: number[], items: CampaignItem[]): void;
  /** Where focus goes once the picker has closed. */
  onCloseAutoFocus?(event: Event): void;
}

/**
 * [wdy2xh2t3w] Pick up to 6 of the owner's campaigns for a Campaigns section (GET /newsletters/campaign-options,
 * 20 a page, newest first). Campaigns with no public page can't be picked; the API says why.
 */
export default function CampaignPickerDialog({ open, onOpenChange, initialIds, knownItems, onDone, onCloseAutoFocus }: CampaignPickerDialogProps) {
  const [picked, setPicked] = useState<number[]>(initialIds);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<CampaignOption[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Every option seen while the picker is open, so a picked campaign's card can be drawn before the save answers.
  const seenRef = useRef(new Map<number, CampaignOption>());
  const requestRef = useRef(0);

  // A fresh start each time it opens.
  useEffect(() => {
    if (!open) return;
    setPicked(initialIds);
    setSearch('');
    setQuery('');
    seenRef.current = new Map();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search, open]);

  // First page for the current search; only the latest request may fill the list.
  useEffect(() => {
    if (!open) return;
    const request = ++requestRef.current;
    setRows(null);
    setError(null);
    setPage(1);
    void newslettersAPI.campaignOptions({ search: query, page: 1 }).then((res) => {
      if (request !== requestRef.current) return;
      if (res.ok && res.data) {
        for (const o of res.data.data) seenRef.current.set(o.id, o);
        setRows(res.data.data);
        setTotalPages(res.data.meta?.total_pages ?? 1);
      } else {
        setRows([]);
        setError(res.error ?? GENERIC_ERROR);
      }
    });
  }, [open, query, attempt]);

  const loadMore = async () => {
    const request = requestRef.current;
    const next = page + 1;
    setLoadingMore(true);
    const res = await newslettersAPI.campaignOptions({ search: query, page: next });
    setLoadingMore(false);
    if (request !== requestRef.current) return;
    if (res.ok && res.data) {
      for (const o of res.data.data) seenRef.current.set(o.id, o);
      setRows((prev) => [...(prev ?? []), ...res.data!.data.filter((o) => !(prev ?? []).some((p) => p.id === o.id))]);
      setPage(next);
      setTotalPages(res.data.meta?.total_pages ?? next);
    } else {
      setError(res.error ?? GENERIC_ERROR);
    }
  };

  const done = () => {
    const known = new Map(knownItems.map((i) => [i.id, i]));
    const items = picked.flatMap((id) => {
      const option = seenRef.current.get(id);
      if (option) return [itemFromOption(option)];
      const kept = known.get(id);
      return kept ? [kept] : [];
    });
    onDone(picked, items);
    onOpenChange(false);
  };

  const full = picked.length >= CAMPAIGNS_MAX;
  let body;
  if (rows === null) {
    body = <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting your campaigns…</p>;
  } else if (error && rows.length === 0) {
    body = (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm text-gray-700">{error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-3`}>Try again</button>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p className="py-10 text-center text-sm text-gray-600">
        {query ? `No campaigns match “${query}”.` : 'You have no campaigns yet. Make a Storeel first, then add it here.'}
      </p>
    );
  } else {
    body = (
      <>
        <ul aria-label="Your campaigns" className="divide-y divide-gray-100">
          {rows.map((o) => {
            const checked = picked.includes(o.id);
            const disabled = campaignOptionDisabled(o, checked, full);
            const cover = httpsUrl(o.cover_url);
            const date = formatCampaignDate(o.date);
            const inputId = `nl-campaign-${o.id}`;
            return (
              <li key={o.id}>
                <label htmlFor={inputId} className={`flex items-center gap-3 py-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input id={inputId} type="checkbox" checked={checked} disabled={disabled}
                    aria-describedby={!o.shareable && o.reason ? `${inputId}-reason` : undefined}
                    onChange={() => setPicked((ids) => toggleCampaign(ids, o.id))}
                    className="h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-[#6C60FF]" />
                  <span aria-hidden="true" className={`flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#6C60FF]/20 to-[#6C60FF]/5 ${o.shareable ? '' : 'opacity-50'}`}>
                    {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-[#6C60FF]/60" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${o.shareable ? 'text-gray-900' : 'text-gray-500'}`}>{o.title || 'Untitled campaign'}</span>
                    {date ? <span className="block text-xs text-gray-500">{date}</span> : null}
                    {!o.shareable && o.reason ? <span id={`${inputId}-reason`} className="block text-xs text-amber-700">{o.reason}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {error ? <p role="alert" className="mt-2 text-xs text-red-600">{error}</p> : null}
        {page < totalPages ? (
          <div className="flex justify-center pt-2">
            <button type="button" onClick={() => { void loadMore(); }} disabled={loadingMore} className={BUTTON_SMALL}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Show more
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <ComposerDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Choose campaigns"
      description="People see each one as a card with a View campaign button."
      onCloseAutoFocus={onCloseAutoFocus}
      footer={(
        <>
          <p aria-live="polite" className="mr-auto self-center text-sm text-gray-600">{campaignsPickerSummary(picked.length)}</p>
          <button type="button" onClick={() => onOpenChange(false)} className={BUTTON_OUTLINE}>Cancel</button>
          <button type="button" onClick={done} className={BUTTON_PRIMARY}>Done</button>
        </>
      )}
    >
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <label htmlFor="nl-campaign-search" className="sr-only">Search your campaigns</label>
        <input id="nl-campaign-search" type="search" value={search} placeholder="Search your campaigns" autoComplete="off"
          onChange={(e) => setSearch(e.target.value)} className={`${inputClass()} pl-9`} />
      </div>
      {body}
    </ComposerDialog>
  );
}
