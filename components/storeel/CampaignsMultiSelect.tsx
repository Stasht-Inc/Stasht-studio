import { useEffect, useState } from 'react';
import { Check, ChevronDown, FolderOpen, Loader2, Search, X } from 'lucide-react';
import { dashboardAPI } from '../../utils/authUtils';
import { campaignsFromMemoriesResponse, type CampaignPick } from './lib/momentCampaigns';

/**
 * The account's campaigns for Add a Moment's "Campaigns (optional)" (GET /memories, as Create Campaign's "Select from
 * Existing Campaigns" loads them), without the campaign being built. Loaded when Add a Moment opens.
 */
export function useMomentCampaigns(enabled: boolean, exclude: string | number | null | undefined): { loading: boolean; campaigns: CampaignPick[] } {
  const [state, setState] = useState<{ loading: boolean; campaigns: CampaignPick[] }>({ loading: false, campaigns: [] });
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    dashboardAPI.getMemories()
      .then((res: unknown) => { if (!cancelled) setState({ loading: false, campaigns: campaignsFromMemoriesResponse(res, exclude ?? null) }); })
      .catch(() => { if (!cancelled) setState({ loading: false, campaigns: [] }); });
    return () => { cancelled = true; };
  }, [enabled, exclude]);
  return state;
}

/**
 * Chris, 8 Nov 2026 (point 2): "Campaigns (optional)" under Add a Moment's upload — a searchable multi-select of the
 * account's campaigns. The ticked ones are linked into the campaign as campaign moments ("a Storeel can be a series of
 * Storeels"), exactly as Create Campaign's "Select from Existing Campaigns" links them. Already linked: ticked, fixed.
 */
export default function CampaignsMultiSelect({ campaigns, loading, picked, onToggle, alreadyLinked = [] }: {
  campaigns: ReadonlyArray<CampaignPick>;
  loading: boolean;
  picked: ReadonlyArray<string>;
  onToggle(id: string): void;
  alreadyLinked?: ReadonlyArray<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const done = new Set(alreadyLinked.map(String));
  const q = search.trim().toLowerCase();
  const shown = campaigns.filter((c) => !q || c.title.toLowerCase().includes(q));
  const chosen = campaigns.filter((c) => picked.includes(c.id));

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
        <span className={`min-w-0 flex-1 truncate ${chosen.length ? 'text-gray-900' : 'text-gray-500'}`}>
          {chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'campaign' : 'campaigns'} selected` : 'Select campaigns'}
        </span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {chosen.length ? (
        <ul aria-label="Selected campaigns" className="mt-2 flex flex-wrap gap-2">
          {chosen.map((c) => (
            <li key={c.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#7B68EE]/10 py-1 pl-3 pr-1 text-xs font-medium text-[#5B4FE8]">
              <span className="truncate">{c.title}</span>
              <button type="button" onClick={() => onToggle(c.id)} aria-label={`Remove ${c.title}`}
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
          {loading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading campaigns…</p>
          ) : shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">{campaigns.length ? 'No campaigns match.' : 'No other campaigns yet.'}</p>
          ) : (
            <ul aria-label="Campaigns" className="max-h-60 divide-y divide-gray-100 overflow-y-auto">
              {shown.map((c) => {
                const linked = done.has(c.id);
                const on = linked || picked.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button" role="checkbox" aria-checked={on} disabled={linked} onClick={() => onToggle(c.id)}
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
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
