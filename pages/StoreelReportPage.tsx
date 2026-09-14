import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { dashboardAPI } from '../utils/authUtils';

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
  property: StoreelReportProperty | null;
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

const COLUMNS: { key: keyof StoreelReportRow; label: string; format?: (row: StoreelReportRow) => string }[] = [
  { key: 'sends', label: 'Sends' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'clicked', label: 'Clicked', format: (r) => `${r.clicked} (${formatPct(r.click_rate)})` },
  { key: 'viewed', label: 'Viewed', format: (r) => `${r.viewed} (${formatPct(r.view_rate)})` },
  { key: 'median_depth_pct', label: 'Median Depth', format: (r) => (r.median_depth_pct === null ? '—' : `${r.median_depth_pct}%`) },
  { key: 'replied', label: 'Replied', format: (r) => `${r.replied} (${formatPct(r.reply_rate)})` },
  { key: 'median_response_seconds', label: 'Median Response', format: (r) => formatDuration(r.median_response_seconds) },
  { key: 'said_yes', label: 'Said Yes', format: (r) => `${r.said_yes} (${formatPct(r.yes_rate)})` },
  { key: 'visited', label: 'Visited' },
  { key: 'sold', label: 'Sold' },
];

// Per-rep / per-campaign Storeel report (Plan #4). Reads GET /storeels/report,
// built and reviewed on the backend as part of Plan #1 — this page is its
// first consumer.
export default function StoreelReportPage({ property, onBack }: StoreelReportPageProps) {
  const [groupBy, setGroupBy] = useState<'rep' | 'memory'>('rep');
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [rows, setRows] = useState<StoreelReportRow[]>([]);
  const [totals, setTotals] = useState<StoreelReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchReport();
  }, [fetchReport]);

  if (!property) {
    return (
      <div className="p-6">
        <p className="text-gray-600">No property selected.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const summaryStats = totals
    ? [
        { label: 'Sends', value: totals.sends },
        { label: 'Delivered', value: totals.delivered },
        { label: 'Clicked', value: `${totals.clicked} (${formatPct(totals.click_rate)})` },
        { label: 'Viewed', value: `${totals.viewed} (${formatPct(totals.view_rate)})` },
        { label: 'Replied', value: `${totals.replied} (${formatPct(totals.reply_rate)})` },
        { label: 'Said Yes', value: `${totals.said_yes} (${formatPct(totals.yes_rate)})` },
        { label: 'Visited', value: totals.visited },
        { label: 'Sold', value: totals.sold },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storeel Report</h1>
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
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#6C60FF] focus:outline-none"
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
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#6C60FF] focus:outline-none"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setGroupBy('rep')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              groupBy === 'rep' ? 'bg-[#6C60FF] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            By Rep
          </button>
          <button
            onClick={() => setGroupBy('memory')}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
              groupBy === 'memory' ? 'bg-[#6C60FF] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
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
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-4 py-3 font-medium whitespace-nowrap">{groupBy === 'rep' ? 'Rep' : 'Campaign'}</th>
              {COLUMNS.map((c) => (
                <th key={String(c.key)} className="px-4 py-3 font-medium whitespace-nowrap">
                  {c.label}
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
