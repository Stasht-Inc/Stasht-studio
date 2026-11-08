import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderOpen, Loader2, Search, X } from 'lucide-react';
import { apiRequest } from '../../utils/authUtils';
import { campaignsFromMemoriesResponse, campaignsLastPage, campaignsQuery, type CampaignPick } from './lib/momentCampaigns';

/**
 * The account's campaigns for "Campaigns (optional)": GET /memories searched on the server (as typed, debounced) and
 * loaded page by page as the list scrolls (review I2: ALL the account's campaigns, not the first 50), without the
 * campaign being built. Loaded only once the list is opened.
 */
function useCampaignSearch(enabled: boolean, search: string, exclude: string | number | null | undefined) {
  const [state, setState] = useState<{ loading: boolean; campaigns: CampaignPick[]; page: number; lastPage: number; failed: boolean }>({ loading: false, campaigns: [], page: 0, lastPage: 1, failed: false });
  const [query, setQuery] = useState(search);
  const seq = useRef(0);
  // Debounced: one request per pause in typing.
  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);
  const load = (page: number, q: string, append: boolean) => {
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true, failed: false }));
    apiRequest(campaignsQuery({ search: q, page }), { method: 'GET' })
      .then((res: unknown) => {
        if (mine !== seq.current) return;
        const list = campaignsFromMemoriesResponse(res, exclude ?? null);
        setState((s) => ({
          loading: false, failed: false, page, lastPage: campaignsLastPage(res),
          campaigns: append ? [...s.campaigns, ...list.filter((c) => !s.campaigns.some((x) => x.id === c.id))] : list,
        }));
      })
      .catch(() => { if (mine === seq.current) setState((s) => ({ ...s, loading: false, failed: true })); });
  };
  useEffect(() => {
    if (!enabled) return;
    load(1, query, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, query, exclude]);
  const more = state.page > 0 && state.page < state.lastPage;
  return { ...state, typing: search !== query, more, loadMore: () => { if (!state.loading && more) load(state.page + 1, query, true); } };
}

/**
 * Chris, 8 Nov 2026 (point 2): "Campaigns (optional)" under Add a Moment's upload — a searchable multi-select of the
 * account's campaigns. The ticked ones are linked into the campaign as campaign moments ("a Storeel can be a series of
 * Storeels"), exactly as Create Campaign's "Select from Existing Campaigns" links them. Already linked: ticked, fixed.
 */
export default function CampaignsMultiSelect({ picked, onToggle, alreadyLinked = [], exclude = null }: {
  /** The ticked campaigns (kept whatever the search shows). */
  picked: ReadonlyArray<CampaignPick>;
  onToggle(campaign: CampaignPick): void;
  alreadyLinked?: ReadonlyArray<string>;
  /** The campaign being built: never offered. */
  exclude?: string | number | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const found = useCampaignSearch(open, search, exclude);
  const done = new Set(alreadyLinked.map(String));
  const pickedIds = new Set(picked.map((c) => c.id));
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  // Infinite scroll: the next page when the list's end comes into view.
  useEffect(() => {
    const root = listRef.current;
    const end = sentinelRef.current;
    if (!root || !end || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) found.loadMore(); }, { root, rootMargin: '80px' });
    io.observe(end);
    return () => io.disconnect();
  });

  return (
    <div data-testid="moment-campaigns">
      <label htmlFor="moment-campaigns-toggle" className="flex items-center gap-2 text-[14px] md:text-sm font-medium text-gray-700 mb-2">
        <FolderOpen className="w-4 h-4" aria-hidden="true" />
        Campaigns <span className="text-gray-400 text-xs font-normal">(optional)</span>
      </label>
      <button
        id="moment-campaigns-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="moment-campaigns-list"
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 md:h-10 w-full items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-left text-[14px] md:text-sm hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B68EE]/40"
      >
        <span className={`min-w-0 flex-1 truncate ${picked.length ? 'text-gray-900' : 'text-gray-500'}`}>
          {picked.length ? `${picked.length} ${picked.length === 1 ? 'campaign' : 'campaigns'} selected` : 'Select campaigns'}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {picked.length ? (
        <ul aria-label="Selected campaigns" className="mt-2 flex flex-wrap gap-2">
          {picked.map((c) => (
            <li key={c.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#7B68EE]/10 py-1 pl-3 pr-1 text-xs font-medium text-[#5B4FE8]">
              <span className="truncate">{c.title}</span>
              <button type="button" onClick={() => onToggle(c)} aria-label={`Remove ${c.title}`}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full hover:bg-[#7B68EE]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B68EE]/40">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div id="moment-campaigns-list" className="mt-2 rounded-lg border border-gray-200 bg-white">
          <div className="relative border-b border-gray-100 p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search campaigns" aria-label="Search campaigns"
              className="h-11 w-full rounded-md border border-gray-300 pl-9 pr-3 text-base md:h-9 md:text-sm focus:border-[#7B68EE] focus:outline-none focus:ring-2 focus:ring-[#7B68EE]/20"
            />
          </div>
          {found.campaigns.length === 0 ? (
            found.loading || found.typing ? (
              <p className="flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading campaigns…</p>
            ) : (
              <p className="p-4 text-center text-sm text-gray-500">{found.failed ? "The campaigns couldn't be loaded. Try again." : search.trim() ? 'No campaigns match.' : 'No other campaigns yet.'}</p>
            )
          ) : (
            <ul ref={listRef} aria-label="Campaigns" aria-busy={found.loading} className="max-h-60 divide-y divide-gray-100 overflow-y-auto">
              {found.campaigns.map((c) => {
                const linked = done.has(c.id);
                const on = linked || pickedIds.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button" role="checkbox" aria-checked={on} disabled={linked} onClick={() => onToggle(c)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7B68EE]/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-[#7B68EE] bg-[#7B68EE] text-white' : 'border-gray-300 bg-white'}`} aria-hidden="true">
                        {on ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                        {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{c.title}</span>
                        <span className="block truncate text-xs text-gray-500">{linked ? 'Already in this campaign' : `${c.count} ${c.count === 1 ? 'photo' : 'photos'}`}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              <li ref={sentinelRef} aria-hidden={!found.loading}>
                {found.loading ? <p className="flex items-center gap-2 p-3 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Loading more…</p> : <span className="block h-px" />}
              </li>
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
