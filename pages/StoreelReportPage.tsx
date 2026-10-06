import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { dashboardAPI } from '../utils/authUtils';

// Hover/tap target explaining a stat — Chris couldn't tell what "Median Depth" or
// "Median Response" meant at a glance (2026-09-22).
function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex align-middle text-gray-300 hover:text-gray-500 ml-1" aria-label="What does this mean?">
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      {/* side="bottom": these sit right under the stat-card grid / column headers, so
          Radix's default side="top" popped the box up and over the row above it.
          bg-gray-900/text-white: the shared TooltipContent's own bg-primary/text-primary-foreground
          render as NO background at all here — tailwind.config's `primary` color wraps
          --primary (a raw hex/oklch value) in hsl(...), producing invalid CSS the browser
          silently drops, so the "box" was fully transparent and table text showed through it. */}
      <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-xs leading-snug bg-gray-900 text-white">{children}</TooltipContent>
    </Tooltip>
  );
}

export interface StoreelReportProperty {
  id: number | string;
  name: string;
}

interface StoreelReportRow {
  key: number;
  label: string;
  sends: number;
  delivered: number;
  failed: number;
  unconfirmed: number;
  clicked: number;
  click_rate: number | null;
  viewed: number;
  view_rate: number | null;
  reached_100: number;
  median_depth_pct: number | null;
  replied: number;
  reply_rate: number | null;
  median_response_seconds: number | null;
  answered_24h: number;
  unanswered_24h: number;
  said_yes: number;
  yes_rate: number | null;
  visited: number;
  sold: number;
}

interface StoreelReportPageProps {
  // Optional. The report is about the caller's whole account by default
  // ("All leads"); the selector lists the caller's properties
  // (getStoreelMyProperties) to narrow it to one. When supplied (the
  // property-row "⋯" menu entry point), that property is preselected and the
  // selector can still switch back to All leads.
  property?: StoreelReportProperty | null;
  onBack: () => void;
}

const todayIso = (): string => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const formatPct = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`;

const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
};

const COLUMNS: { key: keyof StoreelReportRow; label: string; hint: string; format?: (row: StoreelReportRow) => string }[] = [
  { key: 'sends', label: 'Sends', hint: 'Messages sent that carried a link to the shared campaign.' },
  { key: 'delivered', label: 'Delivered', hint: 'Sends the carrier/email provider confirmed reached the lead’s phone or inbox.' },
  { key: 'clicked', label: 'Clicked', hint: 'Delivered sends where the lead tapped the campaign link at least once.', format: (r) => `${r.clicked} (${formatPct(r.click_rate)})` },
  { key: 'viewed', label: 'Viewed', hint: 'Delivered sends where the lead actually opened the shared campaign page.', format: (r) => `${r.viewed} (${formatPct(r.view_rate)})` },
  { key: 'median_depth_pct', label: 'Median Depth', hint: 'Among opened sends, the middle value of how far down the campaign page the lead scrolled (100% = viewed every photo).', format: (r) => (r.median_depth_pct === null ? '—' : `${r.median_depth_pct}%`) },
  { key: 'replied', label: 'Replied', hint: 'Sends where the lead texted or emailed back afterwards.', format: (r) => `${r.replied} (${formatPct(r.reply_rate)})` },
  { key: 'median_response_seconds', label: 'Median Response', hint: 'Among replies, the middle value of how long it took the lead to reply after the send.', format: (r) => formatDuration(r.median_response_seconds) },
  { key: 'said_yes', label: 'Said Yes', hint: 'Sends where the lead replied YES to the "want to see more vehicles?" follow-up text.', format: (r) => `${r.said_yes} (${formatPct(r.yes_rate)})` },
  { key: 'visited', label: 'Visited', hint: 'Sends to a lead whose current status is "Visited" — they came into the dealership.' },
  { key: 'sold', label: 'Sold', hint: 'Sends to a lead whose current status is "Sold".' },
];

// Per-rep / per-lead / per-campaign Storeel report (Plan #4). Reads GET /storeels/report,
// built and reviewed on the backend as part of Plan #1 — this page is its
// first consumer.
export default function StoreelReportPage({ property: suppliedProperty, onBack }: StoreelReportPageProps) {
  const [groupBy, setGroupBy] = useState<'rep' | 'lead' | 'memory'>('rep');
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<StoreelReportRow[]>([]);
  const [totals, setTotals] = useState<StoreelReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scope selector: "All leads" (the whole account — the report is not
  // property-driven) plus each of the caller's properties. null = All leads.
  // Chris (2026-10-07) hit a "No properties found" dead end on an account
  // with no properties, so the report always opens now.
  const [myProperties, setMyProperties] = useState<StoreelReportProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | number | null>(suppliedProperty?.id ?? null);

  useEffect(() => {
    setSelectedPropertyId(suppliedProperty?.id ?? null);
  }, [suppliedProperty?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await dashboardAPI.getStoreelMyProperties();
        if (cancelled || res?.success === false) return;
        setMyProperties(res?.properties || res?.data?.properties || []);
      } catch {
        // The selector is optional — the account report still works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The supplied property always appears in the selector, even before (or
  // without) the my-properties fetch.
  const propertyOptions: StoreelReportProperty[] =
    suppliedProperty && !myProperties.some((p) => String(p.id) === String(suppliedProperty.id))
      ? [suppliedProperty, ...myProperties]
      : myProperties;

  const property: StoreelReportProperty | null =
    selectedPropertyId === null
      ? null
      : propertyOptions.find((p) => String(p.id) === String(selectedPropertyId)) ?? null;

  // Switching scope/filters quickly can leave an older request in flight;
  // only the latest one may write state.
  const latestRequest = useRef(0);
  const fetchReport = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const res: any = await dashboardAPI.getStoreelReport({ propertyId: selectedPropertyId, from, to, groupBy });
      if (requestId !== latestRequest.current) return;
      if (res?.success === false) {
        setError(res?.message || res?.error || 'Could not load the report.');
        setRows([]);
        setTotals(null);
      } else {
        setRows(res?.rows || res?.data?.rows || []);
        setTotals(res?.totals || res?.data?.totals || null);
      }
    } catch {
      if (requestId === latestRequest.current) setError('Could not load the report.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [selectedPropertyId, from, to, groupBy]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const hintByColumn = Object.fromEntries(COLUMNS.map((c) => [c.key, c.hint])) as Record<string, string>;
  const summaryStats = totals
    ? [
        { label: 'Sends', value: totals.sends, hint: hintByColumn.sends },
        { label: 'Delivered', value: totals.delivered, hint: hintByColumn.delivered },
        { label: 'Clicked', value: `${totals.clicked} (${formatPct(totals.click_rate)})`, hint: hintByColumn.clicked },
        { label: 'Viewed', value: `${totals.viewed} (${formatPct(totals.view_rate)})`, hint: hintByColumn.viewed },
        { label: 'Replied', value: `${totals.replied} (${formatPct(totals.reply_rate)})`, hint: hintByColumn.replied },
        { label: 'Said Yes', value: `${totals.said_yes} (${formatPct(totals.yes_rate)})`, hint: hintByColumn.said_yes },
        { label: 'Visited', value: totals.visited, hint: hintByColumn.visited },
        { label: 'Sold', value: totals.sold, hint: hintByColumn.sold },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads Report</h1>
          <p className="text-sm text-gray-500">{property ? property.name : 'All leads'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        {propertyOptions.length > 0 && (
          <div className="min-w-0 max-w-full">
            <label htmlFor="storeel-report-scope" className="block text-xs font-medium text-gray-500 mb-1">Show</label>
            <select
              id="storeel-report-scope"
              value={selectedPropertyId === null ? 'all' : String(selectedPropertyId)}
              onChange={(e) => setSelectedPropertyId(e.target.value === 'all' ? null : e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white max-w-full sm:max-w-xs focus:border-[#0D9488] focus:outline-none"
            >
              <option value="all">All leads</option>
              {propertyOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={todayIso()}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setGroupBy('rep')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              groupBy === 'rep' ? 'bg-[#0D9488] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            By Rep
          </button>
          <button
            onClick={() => setGroupBy('lead')}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
              groupBy === 'lead' ? 'bg-[#0D9488] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            By Lead
          </button>
          <button
            onClick={() => setGroupBy('memory')}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
              groupBy === 'memory' ? 'bg-[#0D9488] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            By Campaign
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading} className="ml-auto">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      {summaryStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          {summaryStats.map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs text-gray-500 flex items-center">
                {stat.label}
                {stat.hint && <InfoHint>{stat.hint}</InfoHint>}
              </p>
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-3 font-medium whitespace-nowrap">{groupBy === 'rep' ? 'Rep' : groupBy === 'lead' ? 'Lead' : 'Campaign'}</th>
              {COLUMNS.map((c) => (
                <th key={String(c.key)} className="px-4 py-3 font-medium whitespace-nowrap">
                  <span className="inline-flex items-center">
                    {c.label}
                    <InfoHint>{c.hint}</InfoHint>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-400">
                  No sends in this date range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{row.label}</td>
                  {COLUMNS.map((c) => (
                    <td key={String(c.key)} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {c.format ? c.format(row) : (row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
