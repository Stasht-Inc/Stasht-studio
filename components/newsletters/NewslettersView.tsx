import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mail, MoreHorizontal, Pencil, Plus } from 'lucide-react';
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
import { EDIT_SCHEDULED_CONFIRM, markUnscheduled } from './lib/editScheduled';
import SegmentedSwitch from './SegmentedSwitch';
import StatusChip from './StatusChip';
import NewsletterResults from './NewsletterResults';
import { GENERIC_ERROR, PLAN_REQUIRED_ERROR } from './lib/apiResult';
import { formatCount } from './lib/audience';
import { NEWSLETTER_FILTERS, NEWSLETTERS_CHANGED_EVENT, announceNewslettersChanged, withHighlightFirst, type NewsletterFilter } from './lib/campaignsView';
import {
  ACTION_LABEL, NEWSLETTERS_TABLE, actionsFor, deleteConfirmText, failureText, isLive, listRateBase, newslettersLayout, opensRow, plural, primaryAction, rate, whenText, type NewsletterAction,
} from './lib/newsletterList';
import { useElementWidth } from './hooks/useElementWidth';
import { BUTTON_OUTLINE, BUTTON_PRIMARY } from './lib/ui';
import { keyboardOnlyFocusReturn } from '../../utils/menuFocus';

const POLL_MS = 30000;
// The All Campaigns list: a grey header row and rows of the same grid, sized by the list's own width
// (NEWSLETTERS_TABLE, newslettersLayout). The last column holds a draft's Edit (icon only, except in the wide
// layout where there is room for the word) and the menu.
const HIGHLIGHT_MS = 4000;
const CREATE_BUTTON = 'bg-[#6C60FF] text-white hover:bg-[#5B52FF] focus:ring-2 focus:ring-[#6C60FF] focus:ring-opacity-50 active:bg-[#6C60FF]';

export interface NewslettersViewProps {
  onCreate(): void;
  onEdit(id: number): void;
  /** Phones: the Campaigns page's sidebar toggle, shown in this header as in All Campaigns. */
  onToggleMobileSidebar?(): void;
  showMobileSidebar?: boolean;
  /** Open this newsletter's results ("View" on the sent / scheduled toast); a new nonce opens it again. */
  openResults?: { id: number; nonce: number } | null;
  /** Save Draft: show this newsletter at the top, highlighted for a moment; a new nonce highlights it again. */
  highlight?: { id: number; nonce: number } | null;
}

// Row actions (Edit, "⋯"): plain like row actions elsewhere in Studio (Lists, Campaigns) — no border or outline, grey,
// light grey on hover, and the purple ring only for keyboard focus (Chris, 31 Oct / 1 Nov 2026).
const ROW_ACTION = 'inline-flex h-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';

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
        <button type="button" aria-label={`Actions for ${item.name || 'this newsletter'}`} title="More actions" disabled={busy} className={`${ROW_ACTION} w-8`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4 text-gray-500" aria-hidden="true" />}
        </button>
      </DropdownMenuTrigger>
      {/* Focus goes back to "⋯" only after a keyboard close: no focus ring left on it after a click (utils/menuFocus). */}
      <DropdownMenuContent align="end" className="w-48 rounded-md border border-gray-200 bg-white shadow-lg" onCloseAutoFocus={keyboardOnlyFocusReturn}>
        {safe.map(item_)}
        {risky.length ? <DropdownMenuSeparator /> : null}
        {risky.map(item_)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Campaigns page → Newsletters (spec decision 3): drafts, scheduled, sending and sent, with their results. */
/** A draft's main action, beside its menu (wdy2xh2t3y). */
function EditButton({ item, onEdit, compact = false }: { item: NewsletterSummary; onEdit(id: number): void; compact?: boolean }) {
  return (
    <button type="button" onClick={() => onEdit(item.id)} aria-label={`Edit ${item.name || 'this newsletter'}`} title="Edit"
      className={`${ROW_ACTION} gap-1.5 text-xs font-medium ${compact ? 'px-2' : 'px-2.5'}`}>
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />{compact ? null : <span>Edit</span>}
    </button>
  );
}

export default function NewslettersView({ onCreate, onEdit, onToggleMobileSidebar, showMobileSidebar = false, openResults = null, highlight = null }: NewslettersViewProps) {
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
  // The newsletter Save Draft just saved: first in the list (while this view is open), glowing for a moment.
  const [topId, setTopId] = useState<number | null>(highlight?.id ?? null);
  const [glowId, setGlowId] = useState<number | null>(highlight?.id ?? null);
  useEffect(() => {
    if (!highlight) return undefined;
    setTopId(highlight.id);
    setGlowId(highlight.id);
    // A draft shows under All (and Drafts); any other filter would hide it.
    setFilter((f) => (f === 'all' || f === 'draft' ? f : 'all'));
    const timer = window.setTimeout(() => setGlowId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight]);
  // The list's layout follows its own width (App's sidebars leave it about 650 px at a 1280 px window).
  const rootRef = useRef<HTMLDivElement>(null);
  const layout = newslettersLayout(useElementWidth(rootRef));
  const [confirm, setConfirm] = useState<{ action: 'cancel' | 'delete' | 'editScheduled'; item: Pick<NewsletterSummary, 'id' | 'name'> & Partial<Pick<NewsletterSummary, 'status'>> } | null>(null);
  // Delete keeps its dialog open until the API answers; a refusal (e.g. sending right now) shows at its bottom.
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  // After the person agrees: a scheduled newsletter goes back to being a draft (its time is kept), then opens in the
  // composer, which says it is off the schedule and offers to put it back on closing. Once it has started sending
  // the API answers 409 with what to do instead.
  const editScheduled = async (id: number) => {
    setBusyId(id);
    const res = await newslettersAPI.unschedule(id);
    setBusyId(null);
    announceNewslettersChanged();
    if (res.ok) {
      markUnscheduled(id, res.data?.planned_send_at ?? null);
      onEdit(id);
      return;
    }
    toast.error(res.error ?? GENERIC_ERROR);
  };

  const act = async (action: NewsletterAction, item: NewsletterSummary) => {
    if (action === 'edit') { onEdit(item.id); return; }
    if (action === 'editScheduled') { setConfirm({ action, item }); return; }
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

  const runDelete = async (item: Pick<NewsletterSummary, 'id'>) => {
    setDeleting(true);
    setDeleteError(null);
    const res = await newslettersAPI.remove(item.id);
    setDeleting(false);
    if (res.ok) {
      // A deleted newsletter's copies kept in this browser go with it.
      clearNewsletterBackups(undefined, item.id);
      setConfirm(null);
      toast.success('Newsletter deleted.');
      announceNewslettersChanged();
      return;
    }
    setDeleteError(res.error ?? GENERIC_ERROR);
    // 409: it started sending meanwhile; 404: deleted elsewhere. Show where it is now.
    void load();
  };

  const closeConfirm = () => { if (deleting) return; setConfirm(null); setDeleteError(null); };

  const runConfirmed = async () => {
    if (!confirm) return;
    const { action, item } = confirm;
    if (action === 'delete') { await runDelete(item); return; }
    setConfirm(null);
    if (action === 'editScheduled') { await editScheduled(item.id); return; }
    setBusyId(item.id);
    const res = await newslettersAPI.cancel(item.id);
    setBusyId(null);
    if (res.ok) {
      toast.success('Newsletter cancelled. Nothing more will be sent.');
      announceNewslettersChanged();
    } else {
      toast.error(res.error ?? GENERIC_ERROR);
      // 409: it changed status meanwhile (sent, or cancelled elsewhere); 404: deleted elsewhere. Show where it is now.
      void load();
    }
  };

  const open = (item: NewsletterSummary) => void act(primaryAction(item.status), item);
  const rows = items ? withHighlightFirst(items, topId) : null;
  const glowing = Boolean(glowId && items?.some((n) => n.id === glowId));
  useEffect(() => {
    if (!glowing) return;
    document.querySelector(`[data-newsletter-row="${glowId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [glowing, glowId]);
  const glow = (id: number) => (id === glowId ? 'bg-[#6C60FF]/10 ring-2 ring-inset ring-[#6C60FF]/40' : '');
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
        {layout !== 'cards' ? (() => {
          const t = NEWSLETTERS_TABLE[layout];
          const wide = layout === 'wide';
          return (
        <div role="table" aria-label="Your newsletters">
          <div role="rowgroup" className={`border-b border-gray-100 bg-gray-50 ${t.padding} py-4`}>
            <div role="row" className={`${t.grid} text-sm font-medium text-gray-600`}>
              <div role="columnheader">Newsletter</div>
              <div role="columnheader">Status</div>
              {wide ? <div role="columnheader">When</div> : null}
              <div role="columnheader" className="text-right">Recipients</div>
              <div role="columnheader" className="text-right">Opened</div>
              <div role="columnheader" className="text-right">Clicked</div>
              <div role="columnheader"><span className="sr-only">Actions</span></div>
            </div>
          </div>
          <div role="rowgroup" className="divide-y divide-gray-100">
            {(rows ?? []).map((n) => {
              const base = listRateBase(n.counts);
              const notSent = n.status === 'draft' || n.status === 'scheduled';
              const failedTitle = n.status === 'failed' ? failureText(n.failure_reason) : undefined;
              // The whole row opens it (a draft in the composer, anything else its results), as the name does; the
              // name stays the keyboard way in. Edit, "⋯" and the menu's items act for themselves (opensRow).
              return (
                <div key={n.id} role="row" data-newsletter-row={n.id}
                  onClick={(e) => {
                    const row = e.currentTarget;
                    if (opensRow({ target: e.target as Element, contains: (el) => row.contains(el as Node), selection: window.getSelection?.()?.toString() ?? '' })) open(n);
                  }}
                  className={`group ${t.grid} ${t.padding} cursor-pointer py-4 text-sm transition-colors duration-700 hover:bg-gray-50 hover:duration-150 ${glow(n.id)}`}>
                  <div role="cell" className="min-w-0">
                    <button type="button" onClick={() => open(n)} className="block max-w-full rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                      <span className="block truncate font-medium text-gray-900 group-hover:text-[#6C60FF]">{n.name || 'Untitled newsletter'}</span>
                      <span className="block truncate text-xs text-gray-500">{n.subject || 'No subject yet'}</span>
                    </button>
                  </div>
                  <div role="cell" className="min-w-0">
                    <StatusChip status={n.status} title={failedTitle} />
                    {wide ? null : <span className="mt-1 block text-xs text-gray-600" title={failedTitle}>{whenText(n)}</span>}
                  </div>
                  {wide ? <div role="cell" className="text-gray-600" title={failedTitle}>{whenText(n)}</div> : null}
                  <div role="cell" className="text-right tabular-nums text-gray-900">{n.counts.recipients > 0 ? formatCount(n.counts.recipients) : '—'}</div>
                  <div role="cell" className="text-right tabular-nums text-gray-900">{notSent ? '—' : rate(n.counts.opened, base)}</div>
                  <div role="cell" className="text-right tabular-nums text-gray-900">{notSent ? '—' : rate(n.counts.clicked, base)}</div>
                  <div role="cell" className="flex items-center justify-end gap-1">
                    {n.status === 'draft' ? <EditButton item={n} onEdit={onEdit} compact={!wide} /> : null}
                    <RowMenu item={n} busy={busyId === n.id} onAction={act} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          );
        })() : (
        // Phones, and any list narrower than the table (NEWSLETTERS_TABLE.table.from): the All Campaigns card rows.
        <ul aria-label="Your newsletters" className="divide-y divide-gray-100">
          {(rows ?? []).map((n) => (
            <li key={n.id} data-newsletter-row={n.id} className={`flex items-start justify-between gap-3 px-4 py-4 transition-colors duration-700 ${glow(n.id)}`}>
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
              <div className="flex flex-shrink-0 items-center gap-1">
                {n.status === 'draft' ? <EditButton item={n} onEdit={onEdit} /> : null}
                <RowMenu item={n} busy={busyId === n.id} onAction={act} />
              </div>
            </li>
          ))}
        </ul>
        )}
      </>
    );
  }

  return (
    <div ref={rootRef} className="bg-white md:rounded-xl md:border md:border-gray-100 md:shadow-sm">
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
        onEditScheduled={(id) => {
          setResultsId(null);
          setConfirm({ action: 'editScheduled', item: items?.find((n) => n.id === id) ?? { id, name: null } });
        }} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => { if (!o) closeConfirm(); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.action === 'delete' ? 'Delete this newsletter?' : confirm?.action === 'editScheduled' ? 'Edit this scheduled newsletter?' : 'Cancel this newsletter?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === 'delete' ? deleteConfirmText(confirm.item.status) : confirm?.action === 'editScheduled' ? EDIT_SCHEDULED_CONFIRM : 'Nothing more will be sent. People who already got it keep it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{confirm?.action === 'editScheduled' ? 'Not now' : 'Keep it'}</AlertDialogCancel>
            <AlertDialogAction disabled={deleting}
              onClick={(e) => { if (confirm?.action === 'delete') e.preventDefault(); void runConfirmed(); }}
              className={confirm?.action === 'editScheduled' ? 'bg-[#6C60FF] text-white hover:bg-[#5B50E6]' : 'bg-red-600 text-white hover:bg-red-700'}>
              {confirm?.action === 'delete' ? (deleting ? 'Deleting…' : 'Yes, delete it') : confirm?.action === 'editScheduled' ? 'Edit it' : 'Yes, cancel it'}
            </AlertDialogAction>
          </AlertDialogFooter>
          {confirm?.action === 'delete' && deleteError ? (
            <p role="alert" className="text-sm text-red-600">{deleteError}</p>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
