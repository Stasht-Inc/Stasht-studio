import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mail, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { newslettersAPI, type NewsletterSummary } from '../../services/newslettersAPI';
import { useIsStarterPlan } from '../../hooks/usePlan';
import { requestUpgrade } from '../../utils/planEvents';
import { clearNewsletterBackups } from '../../utils/newsletterBackups';
import SegmentedSwitch from './SegmentedSwitch';
import StatusChip from './StatusChip';
import NewsletterResults from './NewsletterResults';
import { GENERIC_ERROR, PLAN_REQUIRED_ERROR } from './lib/apiResult';
import { formatCount } from './lib/audience';
import { NEWSLETTER_FILTERS, NEWSLETTERS_CHANGED_EVENT, announceNewslettersChanged, type NewsletterFilter } from './lib/campaignsView';
import { ACTION_LABEL, actionsFor, failureText, isLive, listRateBase, plural, primaryAction, rate, whenText, type NewsletterAction } from './lib/newsletterList';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from './lib/ui';

const POLL_MS = 30000;
// The All Campaigns list: a grey header row and rows of the same grid.
const GRID = 'grid grid-cols-[minmax(0,1fr)_100px_200px_96px_80px_80px_40px] items-center gap-3';
const CREATE_BUTTON = 'bg-[#6C60FF] text-white hover:bg-[#5B52FF] focus:ring-2 focus:ring-[#6C60FF] focus:ring-opacity-50 active:bg-[#6C60FF]';

export interface NewslettersViewProps {
  onCreate(): void;
  onEdit(id: number): void;
  /** Phones: the Campaigns page's sidebar toggle, shown in this header as in All Campaigns. */
  onToggleMobileSidebar?(): void;
  showMobileSidebar?: boolean;
  /** Open this newsletter's results ("View" on the sent / scheduled toast); a new nonce opens it again. */
  openResults?: { id: number; nonce: number } | null;
}

function RowMenu({ item, busy, onAction }: { item: NewsletterSummary; busy: boolean; onAction(action: NewsletterAction, item: NewsletterSummary): void }) {
  const actions = actionsFor(item.status);
  const safe = actions.filter((a) => a !== 'cancel' && a !== 'delete');
  const risky = actions.filter((a) => a === 'cancel' || a === 'delete');
  const item_ = (action: NewsletterAction) => (
    // Open dialogs after the menu has closed, or Radix leaves the page unclickable.
    <DropdownMenuItem key={action} onSelect={() => window.setTimeout(() => onAction(action, item), 0)}
      className={`cursor-pointer ${action === 'cancel' || action === 'delete' ? 'text-red-600 hover:bg-red-50 focus:text-red-600' : 'hover:bg-[#6C60FF]/5'}`}>
      {ACTION_LABEL[action]}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label={`Actions for ${item.name || 'this newsletter'}`} disabled={busy} className="h-8 w-8 p-0 hover:bg-gray-100">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4 text-gray-500" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-md border border-gray-200 bg-white shadow-lg">
        {safe.map(item_)}
        {risky.length ? <DropdownMenuSeparator /> : null}
        {risky.map(item_)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Campaigns page → Newsletters (spec decision 3): drafts, scheduled, sending and sent, with their results. */
export default function NewslettersView({ onCreate, onEdit, onToggleMobileSidebar, showMobileSidebar = false, openResults = null }: NewslettersViewProps) {
  const { isStarter, known } = useIsStarterPlan();
  // Paid plans only, and only once the plan is known: a Starter account would get 403 plan_required (contract note 1).
  const enabled = known && !isStarter;
  const [filter, setFilter] = useState<NewsletterFilter>('all');
  const [items, setItems] = useState<NewsletterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsId, setResultsId] = useState<number | null>(openResults?.id ?? null);
  useEffect(() => {
    if (openResults) setResultsId(openResults.id);
  }, [openResults]);
  const [confirm, setConfirm] = useState<{ action: 'cancel' | 'delete'; item: NewsletterSummary } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Only the latest request may update the list (the filter can change while one is on its way).
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    const res = await newslettersAPI.list(filter === 'all' ? undefined : filter);
    if (request !== requestRef.current) return;
    if (res.ok) {
      setItems(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } else {
      setItems((prev) => prev ?? []);
      setError(res.error ?? GENERIC_ERROR);
    }
  }, [filter]);

  // A new filter starts from "Loading…", never the previous filter's rows.
  useEffect(() => { setItems(null); setError(null); }, [filter]);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onChanged = () => void load();
    window.addEventListener(NEWSLETTERS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NEWSLETTERS_CHANGED_EVENT, onChanged);
  }, [enabled, load]);

  // Sending rows, and scheduled ones due within about 10 minutes, change on their own: check every 30 s while the
  // tab is visible (and once on coming back to it).
  const live = Boolean(items?.some((n) => isLive(n)));
  useEffect(() => {
    if (!enabled || !live) return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [enabled, live, load]);

  // A scheduled newsletter goes back to being a draft (its time is kept), then opens in the composer. Once it has
  // started sending the API answers 409 with what to do instead.
  const editScheduled = async (id: number) => {
    setBusyId(id);
    const res = await newslettersAPI.unschedule(id);
    setBusyId(null);
    announceNewslettersChanged();
    if (res.ok) { onEdit(id); return; }
    toast.error(res.error ?? GENERIC_ERROR);
  };

  const act = async (action: NewsletterAction, item: NewsletterSummary) => {
    if (action === 'edit') { onEdit(item.id); return; }
    if (action === 'editScheduled') { await editScheduled(item.id); return; }
    if (action === 'results') { setResultsId(item.id); return; }
    if (action === 'cancel' || action === 'delete') { setConfirm({ action, item }); return; }
    setBusyId(item.id);
    const res = await newslettersAPI.duplicate(item.id);
    setBusyId(null);
    if (res.ok && res.data) {
      const copy = res.data;
      toast.success('Copied. The copy is a draft.', { action: { label: 'Edit', onClick: () => onEdit(copy.id) } });
      announceNewslettersChanged();
    } else {
      toast.error(res.error ?? GENERIC_ERROR);
      // It may be gone (404, deleted elsewhere): show what is there now.
      void load();
    }
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    const { action, item } = confirm;
    setConfirm(null);
    setBusyId(item.id);
    const res = action === 'cancel' ? await newslettersAPI.cancel(item.id) : await newslettersAPI.remove(item.id);
    setBusyId(null);
    if (res.ok) {
      // A deleted newsletter's copies kept in this browser go with it.
      if (action === 'delete') clearNewsletterBackups(undefined, item.id);
      toast.success(action === 'cancel' ? 'Newsletter cancelled. Nothing more will be sent.' : 'Newsletter deleted.');
      announceNewslettersChanged();
    } else {
      toast.error(res.error ?? GENERIC_ERROR);
      // 409: it changed status meanwhile (sent, or cancelled elsewhere); 404: deleted elsewhere. Show where it is now.
      void load();
    }
  };

  const open = (item: NewsletterSummary) => void act(primaryAction(item.status), item);
  const count = items ? plural(items.length, 'newsletter', 'newsletters') : known && isStarter ? 'Paid plans' : 'Loading…';

  const sidebarToggle = onToggleMobileSidebar && !showMobileSidebar ? (
    <button type="button" onClick={onToggleMobileSidebar} className="rounded-lg p-2 transition-colors hover:bg-gray-100" aria-label="Open sidebar">
      <img src="/Icon.svg" alt="" className="h-5 w-5" />
    </button>
  ) : null;

  let body;
  if (!known) {
    body = <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading newsletters…</div>;
  } else if (isStarter) {
    body = (
      <div className="px-4 py-16 text-center">
        <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#6C60FF]/10"><Mail className="h-6 w-6 text-[#6C60FF]" /></span>
        <h3 className="text-lg font-medium text-gray-900">Newsletters are part of paid plans</h3>
        <p className="mx-auto mt-1 max-w-md text-gray-600">Upgrade to send newsletters by email and text to your leads and lists.</p>
        <button type="button" onClick={() => requestUpgrade(PLAN_REQUIRED_ERROR)} className={`${BUTTON_PRIMARY} mt-4`}>See plans</button>
      </div>
    );
  } else if (items === null) {
    body = <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading newsletters…</div>;
  } else if (items.length === 0) {
    body = (
      <div className="px-4 py-16 text-center">
        <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#6C60FF]/10"><Mail className="h-6 w-6 text-[#6C60FF]" /></span>
        <h3 className="text-lg font-medium text-gray-900">{filter === 'all' ? 'No newsletters yet' : 'Nothing here yet'}</h3>
        <p className="mx-auto mt-1 max-w-md text-gray-600">{filter === 'all' ? 'Send your leads news, offers and updates by email and text.' : 'No newsletters have this status.'}</p>
        {filter === 'all'
          ? <button type="button" onClick={onCreate} className={`${BUTTON_PRIMARY} mt-4`}><Plus className="h-4 w-4" aria-hidden="true" />Create your first newsletter</button>
          : <button type="button" onClick={() => setFilter('all')} className={`${BUTTON_OUTLINE} mt-4`}>Show all newsletters</button>}
      </div>
    );
  } else {
    body = (
      <>
        <div role="table" aria-label="Your newsletters" className="hidden md:block">
          <div role="rowgroup" className="border-b border-gray-100 bg-gray-50 px-6 py-4">
            <div role="row" className={`${GRID} text-sm font-medium text-gray-600`}>
              <div role="columnheader">Newsletter</div>
              <div role="columnheader">Status</div>
              <div role="columnheader">When</div>
              <div role="columnheader" className="text-right">Recipients</div>
              <div role="columnheader" className="text-right">Opened</div>
              <div role="columnheader" className="text-right">Clicked</div>
              <div role="columnheader"><span className="sr-only">Actions</span></div>
            </div>
          </div>
          <div role="rowgroup" className="divide-y divide-gray-100">
            {items.map((n) => {
              const base = listRateBase(n.counts);
              const notSent = n.status === 'draft' || n.status === 'scheduled';
              return (
                <div key={n.id} role="row" className={`${GRID} px-6 py-4 text-sm transition-colors hover:bg-gray-50`}>
                  <div role="cell" className="min-w-0">
                    <button type="button" onClick={() => open(n)} className="block max-w-full rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                      <span className="block truncate font-medium text-gray-900 hover:text-[#6C60FF]">{n.name || 'Untitled newsletter'}</span>
                      <span className="block truncate text-xs text-gray-500">{n.subject || 'No subject yet'}</span>
                    </button>
                  </div>
                  <div role="cell"><StatusChip status={n.status} title={n.status === 'failed' ? failureText(n.failure_reason) : undefined} /></div>
                  <div role="cell" className="text-gray-600" title={n.status === 'failed' ? failureText(n.failure_reason) : undefined}>{whenText(n)}</div>
                  <div role="cell" className="text-right tabular-nums text-gray-900">{n.counts.recipients > 0 ? formatCount(n.counts.recipients) : '—'}</div>
                  <div role="cell" className="text-right tabular-nums text-gray-900">{notSent ? '—' : rate(n.counts.opened, base)}</div>
                  <div role="cell" className="text-right tabular-nums text-gray-900">{notSent ? '—' : rate(n.counts.clicked, base)}</div>
                  <div role="cell" className="flex justify-end"><RowMenu item={n} busy={busyId === n.id} onAction={act} /></div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Phones: the All Campaigns card rows. */}
        <ul aria-label="Your newsletters" className="divide-y divide-gray-100 md:hidden">
          {items.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 px-4 py-4">
              <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                <span className="mb-1 block truncate text-sm font-semibold text-gray-900">{n.name || 'Untitled newsletter'}</span>
                <span className="block truncate text-xs text-gray-500">{n.subject || 'No subject yet'}</span>
                <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                  <StatusChip status={n.status} title={n.status === 'failed' ? failureText(n.failure_reason) : undefined} />
                  <span>{whenText(n)}</span>
                  {n.status === 'sent' || n.status === 'sending' ? <span>· {rate(n.counts.opened, listRateBase(n.counts))} opened</span> : null}
                </span>
                {n.status === 'failed' ? <span className="mt-1.5 block text-xs text-red-700">{failureText(n.failure_reason)}</span> : null}
              </button>
              <RowMenu item={n} busy={busyId === n.id} onAction={act} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="bg-white md:rounded-xl md:border md:border-gray-100 md:shadow-sm">
      <div className="sticky top-20 z-10 bg-white">
        <div className="flex items-center justify-between gap-3 px-0 py-4 lg:px-4">
          {/* Phones: the sidebar toggle stays, as on All Campaigns. */}
          <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
            {sidebarToggle}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900">Newsletters</h2>
              <p className="text-sm text-gray-600">{count}</p>
            </div>
          </div>
          <div className="hidden md:block">
            <h2 className="text-xl font-bold text-gray-900">Newsletters</h2>
            <p className="mt-1 text-gray-600">{count}</p>
          </div>
          {enabled ? (
            <Button onClick={onCreate} className={`${CREATE_BUTTON} md:flex-initial`}>
              <Plus className="-mr-1 h-4 w-4" aria-hidden="true" />
              <span className="sm:hidden">Create</span>
              <span className="hidden sm:inline">Create a Newsletter</span>
            </Button>
          ) : null}
        </div>
      </div>
      {enabled ? (
        <div className="border-b border-gray-100 bg-white px-0 pb-4 pt-2 md:p-6">
          <SegmentedSwitch<NewsletterFilter> label="Show" options={NEWSLETTER_FILTERS} value={filter} onChange={setFilter} />
        </div>
      ) : null}
      {error ? <p role="alert" className="mx-4 my-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:mx-6">{error}</p> : null}

      {body}

      <NewsletterResults newsletterId={resultsId} onOpenChange={(o) => { if (!o) setResultsId(null); }} onChanged={announceNewslettersChanged}
        onEditScheduled={(id) => { setResultsId(null); void editScheduled(id); }} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.action === 'delete' ? 'Delete this newsletter?' : 'Cancel this newsletter?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'delete' ? "This can't be undone." : 'Nothing more will be sent. People who already got it keep it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runConfirmed()} className="bg-red-600 text-white hover:bg-red-700">
              {confirm?.action === 'delete' ? 'Yes, delete it' : 'Yes, cancel it'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
