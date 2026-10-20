import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Loader2, Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  newslettersAPI, type Newsletter, type NewsletterCounts, type NewsletterResults as ResultsData, type RecipientRow, type ResultsStatusFilter,
} from '../../services/newslettersAPI';
import PreviewDialog from './PreviewDialog';
import SegmentedSwitch from './SegmentedSwitch';
import StatusChip from './StatusChip';
import { GENERIC_ERROR } from './lib/apiResult';
import { formatCount } from './lib/audience';
import { httpsUrl } from './lib/urls';
import {
  CHANNEL_FILTERS, RESULT_STATUS_FILTERS, canCancel, countLabel, countsFor, rate, rateBase, whenText, type ChannelFilter,
} from './lib/newsletterList';
import { BUTTON_SMALL, LABEL, LINK_BUTTON, inputClass } from './lib/ui';

const TILES: Array<{ key: keyof NewsletterCounts; rated?: boolean }> = [
  { key: 'recipients' }, { key: 'delivered' }, { key: 'opened', rated: true }, { key: 'clicked', rated: true },
  { key: 'unsubscribed' }, { key: 'failed' }, { key: 'skipped' },
];

const SENDING_REFRESH_MS = 15000;

/** "Oct 16, 11:00 AM" in the person's time zone (times arrive in UTC, contract note 5). */
function shortTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

function ChannelIcon({ channel }: { channel: RecipientRow['channel'] }) {
  const Icon = channel === 'sms' ? MessageSquare : Mail;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-gray-700"><Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />{channel === 'sms' ? 'Text' : 'Email'}</span>;
}

function PersonCell({ r }: { r: RecipientRow }) {
  return (
    <>
      <span className="block truncate font-medium text-gray-900">{r.name || r.address}</span>
      {r.name ? <span className="block truncate text-xs text-gray-500">{r.address}</span> : null}
      {r.unsubscribed_at ? <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{r.channel === 'sms' ? 'Replied STOP' : 'Unsubscribed'}</span> : null}
    </>
  );
}

/** When they opened (texts: opened the link) and clicked, or a dash. */
function Activity({ r, inline = false }: { r: RecipientRow; inline?: boolean }) {
  const parts: string[] = [];
  if (r.opened_at) parts.push(`${r.channel === 'sms' ? 'Link opened' : 'Opened'} ${shortTime(r.opened_at)}`);
  if (r.clicked_at) parts.push(`Clicked ${shortTime(r.clicked_at)}`);
  if (inline) return <>{parts.map((p) => <span key={p}>{p}</span>)}</>;
  return parts.length ? <>{parts.map((p) => <span key={p} className="block whitespace-nowrap">{p}</span>)}</> : <span aria-label="None yet">—</span>;
}

export interface NewsletterResultsProps {
  /** Open while not null. */
  newsletterId: number | null;
  onOpenChange(open: boolean): void;
  /** Cancelled from here: the list should refresh. */
  onChanged(): void;
}

/**
 * Results for one newsletter (spec §2): the counts (totals, or email / text to match the Channel switch), "opens
 * are approximate", and who got what, filtered by channel and status, 50 people a page.
 */
export default function NewsletterResults({ newsletterId, onOpenChange, onChanged }: NewsletterResultsProps) {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [status, setStatus] = useState<ResultsStatusFilter | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // Only the latest request may update the screen (filters can change while one is on its way).
  const requestRef = useRef(0);

  useEffect(() => {
    setNewsletter(null); setResults(null); setChannel('all'); setStatus(''); setPage(1); setError(null);
  }, [newsletterId]);

  const load = useCallback(async () => {
    if (newsletterId === null) return;
    const request = ++requestRef.current;
    setLoading(true);
    const [n, r] = await Promise.all([
      newslettersAPI.get(newsletterId),
      newslettersAPI.results(newsletterId, { channel: channel === 'all' ? undefined : channel, status: status || undefined, page }),
    ]);
    if (request !== requestRef.current) return;
    setLoading(false);
    if (n.ok && n.data) setNewsletter(n.data);
    if (r.ok && r.data) { setResults(r.data); setError(null); } else setError(r.error ?? GENERIC_ERROR);
  }, [newsletterId, channel, status, page]);

  useEffect(() => { void load(); }, [load]);

  // While it is going out, keep the numbers moving.
  useEffect(() => {
    if (newsletterId === null || newsletter?.status !== 'sending') return undefined;
    const timer = window.setInterval(() => void load(), SENDING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [newsletterId, newsletter?.status, load]);

  const cancel = async () => {
    if (!newsletter) return;
    setCancelling(true);
    const res = await newslettersAPI.cancel(newsletter.id);
    setCancelling(false);
    setConfirmCancel(false);
    if (res.ok && res.data) {
      setNewsletter(res.data);
      toast.success('Newsletter cancelled. Nothing more will be sent.');
      onChanged();
      void load();
    } else toast.error(res.error ?? GENERIC_ERROR);
  };

  const counts: NewsletterCounts | null = results ? countsFor(results.counts, channel) : newsletter?.counts ?? null;
  const base = counts ? rateBase(counts) : null;
  const rows = results?.recipients.data ?? [];
  const meta = results?.recipients.meta;
  const webVersion = httpsUrl(newsletter?.public_url ?? null);
  const emptyText = newsletter?.status === 'scheduled' || newsletter?.status === 'draft' ? 'Nobody has been sent this yet.' : 'Nobody matches these filters.';

  return (
    <Sheet open={newsletterId !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto overflow-x-hidden bg-white p-0 sm:max-w-[600px]">
        <SheetHeader className="gap-1 border-b border-gray-100 px-5 py-4 text-left">
          <SheetTitle className="break-words pr-8 text-lg font-bold text-gray-900">{newsletter?.name || 'Newsletter results'}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {newsletter ? <><StatusChip status={newsletter.status} /><span>{whenText(newsletter)}</span></> : <span>Loading…</span>}
            </div>
          </SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={() => setPreviewOpen(true)} disabled={!newsletter} className={LINK_BUTTON}><Eye className="h-4 w-4" aria-hidden="true" />View exact email</button>
            {webVersion ? <a href={webVersion} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}><ExternalLink className="h-4 w-4" aria-hidden="true" />Open web version</a> : null}
            <button type="button" onClick={() => void load()} disabled={loading} className={LINK_BUTTON}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh</button>
            {newsletter && canCancel(newsletter.status) ? (
              <button type="button" onClick={() => setConfirmCancel(true)} className={`${BUTTON_SMALL} ml-auto border-red-200 text-red-600 hover:bg-red-50`}>Cancel sending</button>
            ) : null}
          </div>
        </SheetHeader>

        <div className="min-w-0 space-y-5 px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className={LABEL} aria-hidden="true">Channel</span>
              <SegmentedSwitch label="Channel" options={CHANNEL_FILTERS} value={channel} onChange={(v) => { setChannel(v); setPage(1); }} />
            </div>
            <div className="w-full min-[420px]:w-56">
              <label htmlFor="nl-results-status" className={LABEL}>Status</label>
              <select id="nl-results-status" value={status} onChange={(e) => { setStatus(e.target.value as ResultsStatusFilter | ''); setPage(1); }} className={inputClass()}>
                {RESULT_STATUS_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {counts ? (
            <div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TILES.map((t) => {
                  // SendGrid never reports delivered: 0 with messages sent means "not reported", not "none" (contract note 10).
                  const notReported = t.key === 'delivered' && counts.delivered === 0 && counts.sent > 0;
                  return (
                    <div key={t.key} className="min-w-0 rounded-xl border border-gray-200 p-3">
                      <p className="text-xs font-medium text-gray-500">{countLabel(t.key, channel)}</p>
                      <p className="mt-0.5 text-lg font-bold text-gray-900">{notReported ? '—' : formatCount(counts[t.key])}</p>
                      {notReported ? <p className="text-xs text-gray-500">Not every email service reports this</p> : null}
                      {t.rated && base ? <p className="text-xs text-gray-500">{rate(counts[t.key], base.base)} {base.label}</p> : null}
                    </div>
                  );
                })}
              </div>
              {channel === 'sms' ? (
                <p className="mt-2 text-xs text-gray-500">Link opened counts people who tapped the link in the text.</p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">* Opens are approximate. Some email apps block the tracking picture, and some open every email by themselves.</p>
              )}
            </div>
          ) : null}

          {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {results === null && !error ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading results…</div>
          ) : rows.length === 0 ? (
            results ? <p className="py-8 text-center text-sm text-gray-500">{emptyText}</p> : null
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100">
              {/* The All Campaigns list look: grey header row, text-sm, rows divided by gray-100. */}
              <table className="hidden w-full table-fixed text-left text-sm md:table">
                <caption className="sr-only">Who got this newsletter</caption>
                <thead className="border-b border-gray-100 bg-gray-50 text-sm font-medium text-gray-600">
                  <tr>
                    <th scope="col" className="w-[34%] py-3 pl-4 pr-2 font-medium">Person</th>
                    <th scope="col" className="w-[15%] px-2 py-3 font-medium">Channel</th>
                    <th scope="col" className="w-[18%] px-2 py-3 font-medium">Status</th>
                    <th scope="col" className="py-3 pl-2 pr-4 font-medium">Opened and clicked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={`${r.channel}-${r.address}-${i}`} className="align-top hover:bg-gray-50">
                      <td className="min-w-0 py-3 pl-4 pr-2"><PersonCell r={r} /></td>
                      <td className="px-2 py-3"><ChannelIcon channel={r.channel} /></td>
                      <td className="px-2 py-3"><StatusChip status={r.status} recipient /></td>
                      <td className="py-3 pl-2 pr-4 text-xs leading-5 text-gray-700"><Activity r={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-gray-100 md:hidden" aria-label="Who got this newsletter">
                {rows.map((r, i) => (
                  <li key={`${r.channel}-${r.address}-${i}`} className="px-4 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1"><PersonCell r={r} /></div>
                      <StatusChip status={r.status} recipient />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <ChannelIcon channel={r.channel} />
                      <Activity r={r} inline />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meta && meta.total_pages > 1 ? (
            <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
              <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className={BUTTON_SMALL}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
              <span aria-live="polite">Page {meta.page} of {meta.total_pages}</span>
              <button type="button" aria-label="Next page" disabled={page >= meta.total_pages || loading} onClick={() => setPage((p) => p + 1)} className={BUTTON_SMALL}>Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          ) : meta && rows.length > 0 ? <p className="text-center text-sm text-gray-600">Page {meta.page} of {meta.total_pages}</p> : null}
        </div>

        {newsletter ? <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} load={() => newslettersAPI.preview(newsletter.id)} /> : null}

        <AlertDialog open={confirmCancel} onOpenChange={(o) => { if (!cancelling) setConfirmCancel(o); }}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this newsletter?</AlertDialogTitle>
              <AlertDialogDescription>Nothing more will be sent. People who already got it keep it.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>Keep it</AlertDialogCancel>
              <AlertDialogAction disabled={cancelling} onClick={(e) => { e.preventDefault(); void cancel(); }} className="bg-red-600 text-white hover:bg-red-700">Yes, cancel it</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
