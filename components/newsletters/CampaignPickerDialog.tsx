import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Search, X } from 'lucide-react';
import {
  newslettersAPI, type CampaignItem, type CampaignKind, type CampaignOption, type CampaignSelection,
} from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import SegmentedSwitch from './SegmentedSwitch';
import { GENERIC_ERROR } from './lib/apiResult';
import { httpsUrl } from './lib/urls';
import {
  CAMPAIGNS_MAX, campaignOptionDisabled, categoryLabel, itemFromOption, optionLine, pickerDefaultKind, pickerKinds, pickerSummary,
  pickerTitle, selectionKey, toggleSelection, type KindCounts,
} from './lib/campaignsBlock';
import { chosenEntries, chosenHeading, mergeOptionRows, nextPageToLoad } from './lib/pickerPaging';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SMALL, inputClass } from './lib/ui';

const SEARCH_DELAY_MS = 300;

/** Words for each kind: the tab, and the plural used in the picker's messages. */
const KIND_WORDS: Record<CampaignKind, { tab: string; plural: string; untitled: string }> = {
  campaign: { tab: 'Campaigns', plural: 'campaigns', untitled: 'Untitled campaign' },
  product: { tab: 'Products', plural: 'products', untitled: 'Untitled product' },
  vehicle: { tab: 'Vehicles', plural: 'vehicles', untitled: 'Untitled vehicle' },
};

type Row = CampaignOption & { kind: CampaignKind };

/** Start loading the next page this far before the end of the list is in view. */
const LOAD_AHEAD = '0px 0px 240px 0px';

/** The nearest ancestor that scrolls (the dialog's body), so infinite scroll watches that, not the window. */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

export interface CampaignPickerDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The section's picks when the picker opens. */
  initialSelections: CampaignSelection[];
  /** Cards already known for those picks (kept for ones not on the loaded pages). */
  knownItems: CampaignItem[];
  onDone(selections: CampaignSelection[], items: CampaignItem[]): void;
  /** Where focus goes once the picker has closed. */
  onCloseAutoFocus?(event: Event): void;
}

/**
 * [wdy2xh2t3w] Pick up to 6 of the owner's campaigns, Website Catalogue products and vehicles for a Campaigns
 * section (GET /newsletters/campaign-options, 20 a page, newest first; shared brief 2026-10-29). A tab shows for
 * Products and Vehicles only when the owner has some, and the picker opens on the first tab with something in it.
 * Picks are kept across tabs. What can't be added (no public page, no web page) is shown with the API's reason.
 * Chris, 29 Oct (round 2): what is chosen shows at the top ("Chosen (3 of 6)", ✕ removes one, whatever tab or page
 * it is on), and the next page loads as the end of the list scrolls into view (no "Show more").
 */
export default function CampaignPickerDialog({ open, onOpenChange, initialSelections, knownItems, onDone, onCloseAutoFocus }: CampaignPickerDialogProps) {
  const [picked, setPicked] = useState<CampaignSelection[]>(initialSelections);
  // How many of each kind the owner has (meta.counts), kept between openings so the tabs show straight away.
  const [counts, setCounts] = useState<KindCounts | undefined>(undefined);
  const [kind, setKind] = useState<CampaignKind>('campaign');
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A later page that didn't load: no more automatic tries until the person asks again.
  const [moreError, setMoreError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Every option seen while the picker is open, so a picked item's card can be drawn before the save answers.
  const seenRef = useRef(new Map<string, CampaignItem>());
  const requestRef = useRef(0);
  // The list request (requestRef) a later page is loading for: one page at a time per list.
  const moreRef = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const chosenRef = useRef<HTMLUListElement>(null);
  // After ✕ in the Chosen strip: the place in the strip focus goes to next.
  const focusAfterRemoveRef = useRef<number | null>(null);
  // Until the first answer after opening (and unless a tab is chosen first), move to the first tab with something.
  const autoKindRef = useRef(true);

  // A fresh start each time it opens.
  useEffect(() => {
    if (!open) return;
    setPicked(initialSelections);
    setSearch('');
    setQuery('');
    setCategory('');
    setCategories([]);
    setKind(pickerDefaultKind(counts));
    autoKindRef.current = true;
    seenRef.current = new Map();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search, open]);

  const remember = (list: Row[]) => {
    for (const o of list) seenRef.current.set(selectionKey(o), itemFromOption(o, o.kind));
  };
  const rowsFrom = (data: CampaignOption[], asked: CampaignKind): Row[] => data.map((o) => ({ ...o, kind: o.kind ?? asked }));

  // First page for the current tab, search and category; only the latest request may fill the list.
  useEffect(() => {
    if (!open) return;
    const request = ++requestRef.current;
    const asked = kind;
    setRows(null);
    setError(null);
    setMoreError(null);
    setLoadingMore(false);
    moreRef.current = null;
    setPage(1);
    void newslettersAPI.campaignOptions({ kind: asked, search: query, category: asked === 'campaign' ? undefined : category, page: 1 }).then((res) => {
      if (request !== requestRef.current) return;
      if (res.ok && res.data) {
        const meta = res.data.meta;
        setCounts(meta?.counts);
        if (autoKindRef.current) {
          autoKindRef.current = false;
          const first = pickerDefaultKind(meta?.counts);
          if (first !== asked) {
            setKind(first);
            return;
          }
        }
        const list = mergeOptionRows(null, rowsFrom(res.data.data, asked));
        remember(list);
        setRows(list);
        setTotalPages(meta?.total_pages ?? 1);
        const known = Array.isArray(meta?.categories) ? meta.categories.filter((c): c is string => typeof c === 'string' && c !== '') : [];
        setCategories(category && !known.includes(category) ? [...known, category] : known);
      } else {
        setRows([]);
        setError(res.error ?? GENERIC_ERROR);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, query, category, attempt]);

  // The next page of the same tab, search and category. Only an answer for the list still showing is used (a new
  // search or category starts the list again), and rows already listed aren't added twice.
  const loadPage = async (next: number) => {
    const request = requestRef.current;
    if (moreRef.current === request) return;
    moreRef.current = request;
    const asked = kind;
    setLoadingMore(true);
    setMoreError(null);
    const res = await newslettersAPI.campaignOptions({ kind: asked, search: query, category: asked === 'campaign' ? undefined : category, page: next });
    if (request !== requestRef.current) return;
    moreRef.current = null;
    setLoadingMore(false);
    if (res.ok && res.data) {
      const list = rowsFrom(res.data.data, asked);
      remember(list);
      setRows((prev) => mergeOptionRows(prev, list));
      setPage(next);
      // An empty page ends the list even if total_pages says there is more.
      setTotalPages(list.length ? res.data.meta?.total_pages ?? next : next);
    } else {
      setMoreError(res.error ?? GENERIC_ERROR);
    }
  };

  const nextPage = rows && rows.length ? nextPageToLoad({ page, totalPages, loading: loadingMore, failed: moreError !== null }) : null;

  // Infinite scroll: watch the end of the list inside the dialog's own scrolling body.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!open || nextPage === null || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadPage(nextPage);
    }, { root: scrollParent(el), rootMargin: LOAD_AHEAD });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nextPage, rows]);

  const removePick = (key: string, index: number) => {
    focusAfterRemoveRef.current = index;
    setPicked((list) => list.filter((s) => selectionKey(s) !== key));
  };

  // After ✕: focus the next chip's ✕ (or the one before it), or the search box once nothing is chosen.
  useEffect(() => {
    const index = focusAfterRemoveRef.current;
    if (index === null) return;
    focusAfterRemoveRef.current = null;
    const buttons = chosenRef.current?.querySelectorAll<HTMLButtonElement>('button[data-chosen-remove]');
    const target = buttons && buttons.length ? buttons[Math.min(index, buttons.length - 1)] : searchRef.current;
    target?.focus();
  }, [picked]);

  const chooseKind = (next: CampaignKind) => {
    autoKindRef.current = false;
    setKind(next);
    setSearch('');
    setQuery('');
    setCategory('');
    setCategories([]);
  };

  const done = () => {
    const known = new Map(knownItems.map((i) => [selectionKey(i), i]));
    const items = picked.flatMap((s) => {
      const key = selectionKey(s);
      const item = seenRef.current.get(key) ?? known.get(key);
      return item ? [item] : [];
    });
    onDone(picked, items);
    onOpenChange(false);
  };

  const kinds = pickerKinds(counts);
  const multi = kinds.length > 1;
  const words = KIND_WORDS[kind];
  const pickedKeys = new Set(picked.map(selectionKey));
  const full = picked.length >= CAMPAIGNS_MAX;
  const filtered = Boolean(query || (kind !== 'campaign' && category));
  let emptyText: string;
  if (query) emptyText = `No ${words.plural} match “${query}”.`;
  else if (filtered) emptyText = `No ${words.plural} in ${categoryLabel(kind, category)}.`;
  else if (kind === 'campaign') emptyText = 'You have no campaigns yet. Make a Storeel first, then add it here.';
  else emptyText = `You have no ${words.plural} to add right now.`;

  let body;
  if (rows === null) {
    body = <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting your {words.plural}…</p>;
  } else if (error && rows.length === 0) {
    body = (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm text-gray-700">{error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-3`}>Try again</button>
      </div>
    );
  } else if (rows.length === 0) {
    body = <p className="py-10 text-center text-sm text-gray-600">{emptyText}</p>;
  } else {
    body = (
      <>
        <ul aria-label={`Your ${words.plural}`} className="divide-y divide-gray-100">
          {rows.map((o) => {
            const checked = pickedKeys.has(selectionKey(o));
            const disabled = campaignOptionDisabled(o, checked, full);
            const cover = httpsUrl(o.cover_url);
            const { price, detail } = optionLine(o);
            const inputId = `nl-campaign-${o.kind}-${o.id}`;
            return (
              <li key={`${o.kind}-${o.id}`}>
                <label htmlFor={inputId} className={`flex items-center gap-3 py-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input id={inputId} type="checkbox" checked={checked} disabled={disabled}
                    aria-describedby={!o.shareable && o.reason ? `${inputId}-reason` : undefined}
                    onChange={() => setPicked((list) => toggleSelection(list, { kind: o.kind, id: o.id }))}
                    className="h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-[#6C60FF]" />
                  <span aria-hidden="true" className={`flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#6C60FF]/20 to-[#6C60FF]/5 ${o.shareable ? '' : 'opacity-50'}`}>
                    {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-[#6C60FF]/60" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${o.shareable ? 'text-gray-900' : 'text-gray-500'}`}>{o.title || words.untitled}</span>
                    {price || detail ? (
                      <span className="block truncate text-xs text-gray-500">
                        {price ? <span className="font-semibold text-gray-900">{price}</span> : null}
                        {price && detail ? ' · ' : null}
                        {detail}
                      </span>
                    ) : null}
                    {!o.shareable && o.reason ? <span id={`${inputId}-reason`} className="block text-xs text-amber-700">{o.reason}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {loadingMore ? (
          <p role="status" className="flex items-center justify-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading more…
          </p>
        ) : null}
        {moreError ? (
          <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-3 text-center">
            <p className="text-xs text-red-600">{moreError}</p>
            <button type="button" onClick={() => { void loadPage(page + 1); }} className={BUTTON_SMALL}>Try again</button>
          </div>
        ) : null}
        {nextPage !== null ? <div ref={sentinelRef} aria-hidden="true" className="h-px" /> : null}
      </>
    );
  }

  const showCategories = kind !== 'campaign' && categories.length > 0;
  const chosen = chosenEntries(picked, seenRef.current, knownItems);
  return (
    <ComposerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={pickerTitle(multi)}
      description={multi ? 'People see each one as a card with a button to its page.' : 'People see each one as a card with a View campaign button.'}
      onCloseAutoFocus={onCloseAutoFocus}
      footer={(
        <>
          <p aria-live="polite" className="mr-auto self-center text-sm text-gray-600">{pickerSummary(picked.length, multi)}</p>
          <button type="button" onClick={() => onOpenChange(false)} className={BUTTON_OUTLINE}>Cancel</button>
          <button type="button" onClick={done} className={BUTTON_PRIMARY}>Done</button>
        </>
      )}
    >
      {chosen.length ? (
        <section aria-labelledby="nl-chosen-heading" className="mb-3 rounded-lg bg-[#6C60FF]/5 px-3 py-2.5">
          <h3 id="nl-chosen-heading" className="text-xs font-semibold text-gray-700">{chosenHeading(chosen.length)}</h3>
          <ul ref={chosenRef} aria-labelledby="nl-chosen-heading" className="mt-2 flex flex-wrap gap-2">
            {chosen.map((c, index) => {
              const title = c.title ?? KIND_WORDS[c.kind].untitled;
              return (
                <li key={c.key} className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[#6C60FF]/25 bg-white py-0.5 pl-0.5 pr-0.5 text-xs text-gray-900">
                  <span aria-hidden="true" className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#6C60FF]/20 to-[#6C60FF]/5">
                    {c.cover ? <img src={c.cover} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-3.5 w-3.5 text-[#6C60FF]/60" />}
                  </span>
                  <span className="min-w-0 max-w-[11rem] truncate sm:max-w-[14rem]">{title}</span>
                  <button type="button" data-chosen-remove="" aria-label={`Remove ${title}`} onClick={() => removePick(c.key, index)}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {multi ? (
        <SegmentedSwitch<CampaignKind> label="Show" fill className="mb-3"
          options={kinds.map((k) => ({ value: k, label: KIND_WORDS[k].tab }))} value={kind} onChange={chooseKind} />
      ) : null}
      <div className="mb-2 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="nl-campaign-search" className="sr-only">Search your {words.plural}</label>
          <input ref={searchRef} id="nl-campaign-search" type="search" value={search} placeholder={`Search your ${words.plural}`} autoComplete="off"
            onChange={(e) => setSearch(e.target.value)} className={`${inputClass()} pl-9`} />
        </div>
        {showCategories ? (
          <div className="sm:w-48">
            <label htmlFor="nl-campaign-category" className="sr-only">Category</label>
            <select id="nl-campaign-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass()}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{categoryLabel(kind, c)}</option>)}
            </select>
          </div>
        ) : null}
      </div>
      {body}
    </ComposerDialog>
  );
}
