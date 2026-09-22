import { useCallback, useEffect, useState } from 'react';
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
          Radix's default side="top" popped the box up and over the row above it. */}
      <TooltipContent side="bottom" sideOffset={6} className="max-w-[240px] text-xs leading-snug">{children}</TooltipContent>
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
  // Optional: when omitted (e.g. opened from the Leads tab, which has no
  // property context), the page resolves it itself via
  // getStoreelMyProperties — auto-selecting when there's only one,
  // otherwise showing a picker. When supplied (the property-row "⋯" menu
  // entry point), that property is used directly and no fetch happens.
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

  // Self-resolution: when opened without a property (e.g. from the Leads
  // tab's button), fetch the caller's properties, auto-selecting when
  // there's only one — mirrors storeel_report_screen.dart's Flutter logic.
  const [myProperties, setMyProperties] = useState<StoreelReportProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(!suppliedProperty);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | number | null>(suppliedProperty?.id ?? null);

  useEffect(() => {
    if (suppliedProperty) return;
    let cancelled = false;
    (async () => {
      setLoadingProperties(true);
      setPropertiesError(null);
      try {
        const res: any = await dashboardAPI.getStoreelMyProperties();
        if (cancelled) return;
        if (res?.success === false) {
          setPropertiesError(res?.message || res?.error || 'Could not load your properties.');
        } else {
          const list: StoreelReportProperty[] = res?.properties || res?.data?.properties || [];
          setMyProperties(list);
          if (list.length === 1) {
            setSelectedPropertyId(list[0].id);
          }
        }
      } catch {
        if (!cancelled) setPropertiesError('Could not load your properties.');
      } finally {
        if (!cancelled) setLoadingProperties(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [suppliedProperty]);

  const property: StoreelReportProperty | null =
    suppliedProperty ?? myProperties.find((p) => p.id === selectedPropertyId) ?? null;

  const fetchReport = useCallback(async () => {
    if (!property?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res: any = await dashboardAPI.getStoreelReport({ propertyId: property.id, from, to, groupBy });
      if (res?.success === false) {
        setError(res?.message || res?.error || 'Could not load the report.');
        setRows([]);
        setTotals(null);
      } else {
        setRows(res?.rows || res?.data?.rows || []);
        setTotals(res?.totals || res?.data?.totals || null);
      }
    } catch {
      setError('Could not load the report.');
    } finally {
      setLoading(false);
    }
  }, [property?.id, from, to, groupBy]);

  useEffect(() => {
    if (property?.id) fetchReport();
  }, [fetchReport, property?.id]);

  if (!suppliedProperty && loadingProperties) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Loading your properties…</p>
      </div>
    );
  }

  if (!suppliedProperty && propertiesError) {
    return (
      <div className="p-6">
        <p className="text-red-600">{propertiesError}</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  if (!property) {
    if (!suppliedProperty && myProperties.length > 1) {
      return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Leads Report</h1>
          </div>
          <p className="text-sm text-gray-500 mb-3">Choose a property to view its report.</p>
          <div className="flex flex-col gap-2 max-w-sm">
            {myProperties.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPropertyId(p.id)}
                className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[#0D9488] hover:bg-teal-50 transition-colors text-sm font-medium text-gray-900"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <p className="text-gray-600">
          {suppliedProperty === null && !loadingProperties && myProperties.length === 0
            ? 'No properties found for your account.'
            : 'No property selected.'}
        </p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

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
          <p className="text-sm text-gray-500">{property.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-6">
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
