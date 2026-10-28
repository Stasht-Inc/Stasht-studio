import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronRight, Copy, Download, Eye, FileUp, ListChecks, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { newslettersAPI, type ContactList } from '../../../services/newslettersAPI';
import type { StarterPlanState } from '../../../hooks/usePlan';
import { requestUpgrade } from '../../../utils/planEvents';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import ImportListModal from '../../newsletters/ImportListModal';
import { GENERIC_ERROR } from '../../newsletters/lib/apiResult';
import { formatCount, type GroupOption } from '../../newsletters/lib/audience';
import { announceListsChanged, listSourceLabel, listTotals, listUpdatedText, peopleText, withListSummary } from '../../newsletters/lib/lists';
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../../newsletters/lib/ui';
import { ConfirmDialog, ErrorNote, NameDialog } from './ListDialogs';
import ListDetail, { type ListAction } from './ListDetail';
import type { ContactListsState } from './useContactLists';

export const LISTS_PLAN_MESSAGE = 'Lists are available on paid plans.';

const MENU_ITEM = 'cursor-pointer gap-2 hover:bg-[#6C60FF]/5';
const MENU_DANGER = 'cursor-pointer gap-2 text-red-600 hover:bg-red-50 focus:text-red-600';
const later = (fn: () => void) => () => window.setTimeout(fn, 0);

function slug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'list';
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Cards({ cards }: { cards: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-600">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export interface ListsTabHandle { refresh(): Promise<void> }

export interface ListsTabProps {
  state: ContactListsState;
  plan: StarterPlanState;
  /** Lead groups, for "From leads" in Import CSV's Add a list. */
  groups: GroupOption[];
}

/** Leads page → Lists (Chris, 28 Oct 2026): the account's contact lists, and everything you can do inside one. */
const ListsTab = forwardRef<ListsTabHandle, ListsTabProps>(function ListsTab({ state, plan, groups }, ref) {
  const { lists, error, reload, setLists } = state;
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [renaming, setRenaming] = useState<ContactList | null>(null);
  const [deleting, setDeleting] = useState<ContactList | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const enabled = plan.known && !plan.isStarter;
  // Where focus goes once the view has changed: the opened list's heading, the lists heading, or a list's row.
  type FocusTarget = { kind: 'detail' } | { kind: 'overview' } | { kind: 'row'; id: number };
  const pendingFocus = useRef<FocusTarget | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const focusPending = useCallback(() => {
    const target = pendingFocus.current;
    const box = root.current;
    if (!target || !box) return false;
    const selector = target.kind === 'row' ? `[data-list-row="${target.id}"]` : `[data-lists-focus="${target.kind}"]`;
    // The table (md+) and the phone cards both have a row button: the one on screen.
    const el = [...box.querySelectorAll<HTMLElement>(selector)].find((e) => e.offsetParent !== null);
    if (!el) return false;
    pendingFocus.current = null;
    el.focus();
    return true;
  }, []);
  // After a dialog closes (Create list, Delete): focus the new view instead of the dialog's opener, which is gone.
  const focusAfterDialog = useCallback((event: Event) => {
    if (!pendingFocus.current) return;
    event.preventDefault();
    if (!focusPending()) pendingFocus.current = null;
  }, [focusPending]);
  // "All lists" (no dialog): once the lists show again.
  useEffect(() => {
    if (pendingFocus.current?.kind === 'row' && openId === null) focusPending();
  }, [openId, lists, focusPending]);

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      if (!enabled) return;
      setRefreshKey((k) => k + 1);
      await reload();
    },
  }), [enabled, reload]);

  const changed = useCallback((summary: ContactList) => {
    setLists((prev) => (prev ? withListSummary(prev, summary) : [summary]));
    announceListsChanged();
  }, [setLists]);
  const stale = useCallback(() => { void reload(); announceListsChanged(); }, [reload]);
  const gone = useCallback((message: string) => {
    setOpenId(null);
    toast.error(message);
    void reload();
    announceListsChanged();
  }, [reload]);

  const exportList = async (list: ContactList) => {
    setExportingId(list.id);
    const today = new Date().toISOString().slice(0, 10);
    const res = await newslettersAPI.exportList(list.id, `${slug(list.name)}-${today}.csv`);
    setExportingId(null);
    if (!res.ok || !res.data) {
      if (res.status === 404) { gone('That list was deleted somewhere else.'); return; }
      toast.error(res.error ?? GENERIC_ERROR);
      return;
    }
    download(res.data.blob, res.data.filename);
    toast.success(`Downloaded ${res.data.filename}.`);
  };

  const duplicate = async (list: ContactList) => {
    setBusyId(list.id);
    const res = await newslettersAPI.duplicateList(list.id);
    setBusyId(null);
    if (!res.ok || !res.data) {
      if (res.status === 404) { gone('That list was deleted somewhere else.'); return; }
      toast.error(res.fieldErrors.name ?? res.error ?? GENERIC_ERROR);
      return;
    }
    const copy = res.data;
    setLists((prev) => (prev ? withListSummary(prev, copy) : [copy]));
    announceListsChanged();
    toast.success(`Made a copy: “${copy.name}”.`);
  };

  const onAction = (action: ListAction, list: ContactList) => {
    if (action === 'open') setOpenId(list.id);
    else if (action === 'rename') setRenaming(list);
    else if (action === 'delete') setDeleting(list);
    else if (action === 'duplicate') void duplicate(list);
    else if (action === 'export') void exportList(list);
  };

  const createList = async (name: string): Promise<string | null> => {
    const res = await newslettersAPI.createList(name);
    if (!res.ok || !res.data) return res.fieldErrors.name ?? res.error ?? GENERIC_ERROR;
    const created = res.data;
    setLists((prev) => (prev ? withListSummary(prev, created) : [created]));
    announceListsChanged();
    toast.success(`Created the list “${created.name}”.`);
    pendingFocus.current = { kind: 'detail' };
    setOpenId(created.id);
    return null;
  };

  const renameList = async (name: string): Promise<string | null> => {
    if (!renaming) return null;
    const res = await newslettersAPI.renameList(renaming.id, name);
    if (!res.ok || !res.data) {
      if (res.status === 404) { setRenaming(null); gone('That list was deleted somewhere else.'); return null; }
      return res.fieldErrors.name ?? res.error ?? GENERIC_ERROR;
    }
    changed(res.data);
    toast.success('List renamed.');
    return null;
  };

  const deleteList = async (): Promise<string | null> => {
    if (!deleting) return null;
    const list = deleting;
    const res = await newslettersAPI.deleteList(list.id);
    if (!res.ok) {
      // 409: a scheduled or sending newsletter still uses it (the API's words).
      if (res.status === 404) { setDeleting(null); gone('That list was deleted somewhere else.'); return null; }
      return res.error ?? GENERIC_ERROR;
    }
    setLists((prev) => prev?.filter((l) => l.id !== list.id) ?? prev);
    if (openId === list.id) setOpenId(null);
    pendingFocus.current = { kind: 'overview' };
    announceListsChanged();
    toast.success(`Deleted the list “${list.name}”.`);
    return null;
  };

  const dialogs = (
    <>
      <NameDialog open={createOpen} onOpenChange={setCreateOpen} title="Create a list" description="Start an empty list, then add people or import a CSV file."
        submitLabel="Create list" onSubmit={createList} onCloseAutoFocus={focusAfterDialog} />
      <NameDialog open={renaming !== null} onOpenChange={(o) => { if (!o) setRenaming(null); }} title="Rename list" submitLabel="Save"
        initialName={renaming?.name ?? ''} onSubmit={renameList} />
      <ConfirmDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }} title={`Delete “${deleting?.name ?? ''}”?`}
        confirmLabel="Delete list" onConfirm={deleteList} onCloseAutoFocus={focusAfterDialog}>
        <p>The {deleting ? peopleText(deleting.member_count) : 'people'} on it are removed for good. Newsletters already sent keep their results.</p>
      </ConfirmDialog>
      <ImportListModal open={importOpen} onOpenChange={setImportOpen} groups={groups}
        onCreated={(list) => { setLists((prev) => (prev ? withListSummary(prev, list) : [list])); announceListsChanged(); }} />
    </>
  );

  if (!plan.known) {
    return plan.failed ? (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center">
        <p className="text-sm text-gray-700">We couldn&rsquo;t check your plan.</p>
        <button type="button" onClick={plan.retry} className={`${BUTTON_SECONDARY} mt-3`}>Try again</button>
      </div>
    ) : (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-16 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading lists…</div>
    );
  }

  if (plan.isStarter) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center md:py-16">
        <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#6C60FF]/10"><ListChecks className="h-6 w-6 text-[#6C60FF]" /></span>
        <h3 className="text-lg font-semibold text-gray-900">Lists are part of paid plans</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">Upgrade to keep lists of the people you email and text, import them from a CSV file, and send them newsletters.</p>
        <button type="button" onClick={() => requestUpgrade(LISTS_PLAN_MESSAGE)} className={`${BUTTON_PRIMARY} mt-5`}>See plans</button>
      </div>
    );
  }

  const open = openId !== null ? lists?.find((l) => l.id === openId) ?? null : null;
  // The dialogs stay in one place in the tree whichever view shows, so an open dialog isn't remounted when the
  // view changes under it (Create list opens the new list; Delete in a list goes back to all lists).
  if (open) {
    return (
      <div ref={root}>
        <div>
          <ListDetail
          list={open}
          otherLists={(lists ?? []).filter((l) => l.id !== open.id)}
          onBack={() => { pendingFocus.current = { kind: 'row', id: open.id }; setOpenId(null); }}
          onAction={onAction}
          onListChanged={changed}
          onListsStale={stale}
          onGone={gone}
          exporting={exportingId === open.id}
          refreshKey={refreshKey}
          />
        </div>
        {dialogs}
      </div>
    );
  }

  const totals = listTotals(lists ?? []);
  const cards = [
    { label: 'Total lists', value: formatCount(totals.lists) },
    { label: 'Total people', value: formatCount(totals.people) },
    { label: 'Can email', value: formatCount(totals.email) },
    { label: 'Unsubscribed', value: formatCount(totals.unsubscribed) },
  ];

  const menu = (l: ContactList) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${l.name}`} disabled={busyId === l.id} onClick={(e) => e.stopPropagation()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 md:h-8 md:w-8">
          {busyId === l.id || exportingId === l.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-md border border-gray-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => onAction('open', l))}><Eye className="h-4 w-4" aria-hidden="true" />Open</DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => onAction('rename', l))}><Pencil className="h-4 w-4" aria-hidden="true" />Rename</DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => onAction('duplicate', l))}><Copy className="h-4 w-4" aria-hidden="true" />Duplicate</DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => onAction('export', l))}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_DANGER} onSelect={later(() => onAction('delete', l))}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  let body;
  if (lists === null) {
    body = <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading lists…</div>;
  } else if (!lists.length) {
    body = error ? null : (
      <div className="px-4 py-16 text-center">
        <span aria-hidden="true" className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100"><ListChecks className="h-6 w-6 text-[#6C60FF]" /></span>
        <p className="text-sm font-medium text-gray-700">No lists yet</p>
        <p className="mt-1 text-sm text-gray-600">Create a list, or import a CSV file from Mailchimp or another tool.</p>
      </div>
    );
  } else {
    body = (
      <>
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-left">
            <caption className="sr-only">Your lists</caption>
            <thead>
              <tr className="border-b border-gray-100 text-sm font-bold text-gray-700">
                <th scope="col" className="px-6 py-3">List</th>
                <th scope="col" className="px-4 py-3 text-right">People</th>
                <th scope="col" className="px-4 py-3 text-right">Can email</th>
                <th scope="col" className="px-4 py-3 text-right">Can text</th>
                <th scope="col" className="px-4 py-3">Source</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lists.map((l) => (
                <tr key={l.id} className="cursor-pointer transition-colors hover:bg-gray-50" onClick={() => setOpenId(l.id)}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100"><ListChecks className="h-4 w-4 text-[#6C60FF]" aria-hidden="true" /></span>
                      <button type="button" data-list-row={l.id} onClick={(e) => { e.stopPropagation(); setOpenId(l.id); }}
                        className="min-w-0 break-words rounded text-left text-base font-semibold text-gray-900 hover:text-[#6C60FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                        {l.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-900">{formatCount(l.member_count)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCount(l.email_count)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatCount(l.sms_count)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{listSourceLabel(l.source)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{listUpdatedText(l)}</td>
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>{menu(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone cards */}
        <ul className="divide-y divide-gray-100 md:hidden" aria-label="Your lists">
          {lists.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-1 pl-4 pr-2">
              <button type="button" data-list-row={l.id} onClick={() => setOpenId(l.id)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100"><ListChecks className="h-4 w-4 text-[#6C60FF]" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-900">{l.name}</span>
                  <span className="mt-0.5 block text-xs text-gray-600">{peopleText(l.member_count)} · {formatCount(l.email_count)} email · {formatCount(l.sms_count)} text</span>
                  <span className="block text-xs text-gray-500">{listSourceLabel(l.source)} · Updated {listUpdatedText(l)}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
              </button>
              {menu(l)}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div ref={root}>
      <div className="space-y-3 md:space-y-6">
      <Cards cards={cards} />
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <h2 data-lists-focus="overview" tabIndex={-1} className="rounded text-base font-semibold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">Your lists</h2>
            <p className="text-sm text-gray-600">People you can email and text with newsletters.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setImportOpen(true)} className={`${BUTTON_SECONDARY} flex-1 px-4 md:flex-none`}><FileUp className="h-4 w-4" aria-hidden="true" />Import CSV</button>
            <button type="button" onClick={() => setCreateOpen(true)} className={`${BUTTON_PRIMARY} flex-1 px-4 md:flex-none`}><Plus className="h-4 w-4" aria-hidden="true" />Create list</button>
          </div>
        </div>
        {error ? <div className="px-4 pt-3 md:px-6"><ErrorNote>{error}</ErrorNote></div> : null}
        {body}
      </div>
      </div>
      {dialogs}
    </div>
  );
});

export default ListsTab;
