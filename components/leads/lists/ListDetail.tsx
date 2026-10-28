import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, FileUp, Loader2, MoreHorizontal, Pencil, Plus, Search, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  newslettersAPI, type ContactList, type ContactListMember, type ContactListMembers, type MemberStatusFilter, type MergeResult,
} from '../../../services/newslettersAPI';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import ImportListModal from '../../newsletters/ImportListModal';
import SegmentedSwitch from '../../newsletters/SegmentedSwitch';
import { GENERIC_ERROR } from '../../newsletters/lib/apiResult';
import { formatCount } from '../../newsletters/lib/audience';
import { consentLabel } from '../../newsletters/lib/consent';
import {
  MAX_SELECTED, copyResultText, emailStatusChip, listSourceLabel, pageSelection, peopleText, smsStatusChip, toggleSelected, togglePage, type StatusChipInfo,
} from '../../newsletters/lib/lists';
import { memberConsentText, shortDate } from '../../newsletters/lib/manageLists';
import { BUTTON_PRIMARY, BUTTON_SECONDARY, LINK_BUTTON } from '../../newsletters/lib/ui';
import { ConfirmDialog, CopyToListDialog, ErrorNote } from './ListDialogs';
import MemberDialog from './MemberDialog';

export type ListAction = 'open' | 'rename' | 'duplicate' | 'export' | 'delete';

const CHIP_TONE: Record<StatusChipInfo['tone'], string> = {
  good: 'bg-green-50 text-green-700 border-green-200',
  muted: 'bg-gray-100 text-gray-600 border-gray-200',
  bad: 'bg-red-50 text-red-700 border-red-200',
};
const ICON_BUTTON = 'inline-flex h-10 w-10 md:h-8 md:w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
const PAGE_BUTTON = 'inline-flex h-10 md:h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm md:text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';
const MENU_ITEM = 'cursor-pointer gap-2 hover:bg-[#6C60FF]/5';
const MENU_DANGER = 'cursor-pointer gap-2 text-red-600 hover:bg-red-50 focus:text-red-600';

function Chip({ info }: { info: StatusChipInfo | null }) {
  if (!info) return null;
  return <span title={info.title} className={`inline-flex h-6 items-center whitespace-nowrap rounded-md border px-2 text-xs font-medium ${CHIP_TONE[info.tone]}`}>{info.label}</span>;
}

function Chips({ m }: { m: ContactListMember }) {
  const email = emailStatusChip(m.email_status);
  const sms = smsStatusChip(m.sms_status);
  if (!email && !sms) return <span className="text-gray-400">—</span>;
  return <span className="flex flex-wrap gap-1"><Chip info={email} /><Chip info={sms} /></span>;
}

const displayName = (m: ContactListMember) => m.name || m.email || m.phone || 'Someone';

/** Opens dialogs after the menu has closed, or Radix leaves the page unclickable. */
const later = (fn: () => void) => () => window.setTimeout(fn, 0);

export interface ListDetailProps {
  list: ContactList;
  /** The owner's other lists (Copy to list…). */
  otherLists: ContactList[];
  onBack(): void;
  onAction(action: ListAction, list: ContactList): void;
  /** The API answered the list as it is now (remove, import, copy). */
  onListChanged(list: ContactList): void;
  /** Someone was added or edited: the list's counts need reloading. */
  onListsStale(): void;
  /** The list was deleted somewhere else. */
  onGone(message: string): void;
  exporting: boolean;
  /** Bumped by Refresh / pull to refresh. */
  refreshKey: number;
}

/** One list on the Leads page's Lists tab: who is on it, search and filter, add, edit, remove, import, copy. */
export default function ListDetail({ list, otherLists, onBack, onAction, onListChanged, onListsStale, onGone, exporting, refreshKey }: ListDetailProps) {
  const [members, setMembers] = useState<ContactListMembers | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MemberStatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [memberDialog, setMemberDialog] = useState<{ member: ContactListMember | null } | null>(null);
  const [removing, setRemoving] = useState<{ ids: number[]; label: string } | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerBox = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const mine = ++request.current;
    setLoading(true);
    const res = await newslettersAPI.listMembers(list.id, page, { search, status });
    if (mine !== request.current) return;
    setLoading(false);
    if (res.ok && res.data) {
      setMembers(res.data);
      setLoadError(null);
      // Fewer pages now (people removed): go to the last one.
      const pages = res.data.meta?.total_pages ?? 1;
      if (page > pages && pages >= 1) setPage(pages);
    } else if (res.status === 404) {
      onGone('That list was deleted somewhere else.');
    } else {
      setLoadError(res.error ?? GENERIC_ERROR);
    }
  }, [list.id, page, search, status, onGone]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  // A new search or filter starts again on page 1, with nobody chosen (so no one hidden gets removed).
  const applySearch = (value: string) => { setSearch(value.trim()); setPage(1); setSelected(new Set()); };
  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => applySearch(value), 300);
  };
  const onStatusChange = (value: MemberStatusFilter) => { setStatus(value); setPage(1); setSelected(new Set()); };

  const rows = members?.data ?? [];
  const pageIds = useMemo(() => rows.map((m) => m.id).filter((id): id is number => typeof id === 'number'), [rows]);
  const pageState = pageSelection(selected, pageIds);
  useEffect(() => { if (headerBox.current) headerBox.current.indeterminate = pageState === 'some'; }, [pageState]);
  const meta = members?.meta;
  const counts = meta?.counts;
  const filtered = Boolean(search) || status !== 'all';
  const full = selected.size >= MAX_SELECTED;

  const choose = (id: number | undefined) => { if (typeof id === 'number') setSelected((s) => toggleSelected(s, id)); };

  const removeConfirmed = async (): Promise<string | null> => {
    if (!removing) return null;
    const res = await newslettersAPI.removeMembers(list.id, removing.ids);
    if (!res.ok || !res.data) {
      if (res.status === 404) { onGone('That list was deleted somewhere else.'); return null; }
      return res.fieldErrors.ids ?? res.error ?? GENERIC_ERROR;
    }
    const removed = res.data.removed ?? removing.ids.length;
    toast.success(removed === 1 ? `Removed ${removing.label} from the list.` : `Removed ${peopleText(removed)} from the list.`);
    setSelected((s) => { const next = new Set(s); removing.ids.forEach((id) => next.delete(id)); return next; });
    if (res.data.list) onListChanged(res.data.list);
    void load();
    return null;
  };

  const copyTo = async (target: ContactList): Promise<string | null> => {
    const res = await newslettersAPI.copyMembers(list.id, [...selected], target.id);
    if (!res.ok || !res.data) {
      if (res.status === 404 && !res.fieldErrors.target_list_id) return res.error ?? 'That list was deleted somewhere else.';
      return res.fieldErrors.target_list_id ?? res.fieldErrors.ids ?? res.error ?? GENERIC_ERROR;
    }
    toast.success(copyResultText(res.data, res.data.list?.name ?? target.name));
    if (res.data.list) onListChanged(res.data.list);
    setSelected(new Set());
    return null;
  };

  const onMerged = (result: MergeResult) => {
    if (result.list) onListChanged(result.list);
    setPage(1);
    void load();
  };

  const rowMenu = (m: ContactListMember, label: string) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Actions for ${label}`} disabled={m.id == null} className={ICON_BUTTON}>
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-md border border-gray-200 bg-white shadow-lg">
        <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => setMemberDialog({ member: m }))}><Pencil className="h-4 w-4" aria-hidden="true" />Edit</DropdownMenuItem>
        <DropdownMenuItem className={MENU_DANGER} onSelect={later(() => setRemoving({ ids: [m.id!], label }))}><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const box = (m: ContactListMember, label: string) => (
    <label className="-m-2 inline-flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center md:m-0 md:h-auto md:w-auto">
      <input type="checkbox" aria-label={`Choose ${label}`} checked={m.id != null && selected.has(m.id)} disabled={m.id == null || (full && !selected.has(m.id))}
        onChange={() => choose(m.id)} className="h-4 w-4 accent-[#6C60FF]" />
    </label>
  );

  const summary = [
    peopleText(list.member_count),
    `${formatCount(list.email_count)} can get email`,
    `${formatCount(list.sms_count)} can get texts`,
    ...(list.unsubscribed_count ? [`${formatCount(list.unsubscribed_count)} unsubscribed`] : []),
  ].join(' · ');

  let table;
  if (members === null && !loadError) {
    table = <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading people…</div>;
  } else if (!rows.length && !loadError) {
    table = filtered ? (
      <p className="px-4 py-12 text-center text-sm text-gray-600">Nobody on this list matches. Try another search or filter.</p>
    ) : (
      <div className="px-4 py-12 text-center">
        <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100"><UserPlus className="h-6 w-6 text-[#6C60FF]" /></span>
        <p className="text-sm font-medium text-gray-700">Nobody is on this list yet</p>
        <p className="mt-1 text-sm text-gray-600">Add people one at a time, or import a CSV file.</p>
      </div>
    );
  } else if (rows.length) {
    table = (
      <>
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">People on {list.name}</caption>
            <colgroup>
              <col className="w-10" /><col className="w-[16%]" /><col className="w-[23%]" /><col className="w-[13%]" /><col className="w-[17%]" /><col /><col className="w-[7rem]" /><col className="w-12" />
            </colgroup>
            <thead className="border-b border-gray-100 text-sm font-bold text-gray-700">
              <tr>
                <th scope="col" className="py-3 pl-4">
                  <input ref={headerBox} type="checkbox" aria-label="Choose everyone on this page" checked={pageState === 'all'}
                    disabled={!pageIds.length || (full && pageState === 'none')} onChange={() => setSelected((s) => togglePage(s, pageIds))} className="h-4 w-4 accent-[#6C60FF]" />
                </th>
                <th scope="col" className="px-3 py-3">Name</th>
                <th scope="col" className="px-3 py-3">Email</th>
                <th scope="col" className="px-3 py-3">Mobile</th>
                <th scope="col" className="px-3 py-3">Status</th>
                <th scope="col" className="px-3 py-3">How they agreed</th>
                <th scope="col" className="px-3 py-3">Added</th>
                <th scope="col" className="py-3 pr-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((m, i) => {
                const label = displayName(m);
                const chosen = m.id != null && selected.has(m.id);
                return (
                  <tr key={m.id ?? `row-${i}`} className={chosen ? 'bg-purple-50' : 'hover:bg-gray-50'}>
                    <td className="py-3 pl-4 align-top">{box(m, label)}</td>
                    <td className="px-3 py-3 align-top font-medium text-gray-900 [overflow-wrap:anywhere]">{m.name ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3 align-top text-gray-700 [overflow-wrap:anywhere]">{m.email ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3 align-top text-gray-700 [overflow-wrap:anywhere]">{m.phone ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3 align-top"><Chips m={m} /></td>
                    <td className="px-3 py-3 align-top text-gray-700 lg:whitespace-nowrap" title={m.consent_source ?? undefined}>{memberConsentText(m)}</td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-gray-600">{shortDate(m.added_at) || '—'}</td>
                    <td className="py-2 pr-3 text-right align-top">{rowMenu(m, label)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phone cards */}
        <ul className="divide-y divide-gray-100 md:hidden" aria-label={`People on ${list.name}`}>
          {rows.map((m, i) => {
            const label = displayName(m);
            const chosen = m.id != null && selected.has(m.id);
            return (
              <li key={m.id ?? `card-${i}`} className={`flex items-start gap-3 px-4 py-3 ${chosen ? 'bg-purple-50' : ''}`}>
                <span className="pt-0.5">{box(m, label)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]">{label}</p>
                  {m.name && m.email ? <p className="text-sm text-gray-700 [overflow-wrap:anywhere]">{m.email}</p> : null}
                  {m.phone && (m.name || m.email) ? <p className="text-sm text-gray-700">{m.phone}</p> : null}
                  <div className="mt-1.5"><Chips m={m} /></div>
                  <p className="mt-1.5 text-xs text-gray-600">{memberConsentText(m)}{m.added_at ? ` · Added ${shortDate(m.added_at)}` : ''}</p>
                </div>
                {rowMenu(m, label)}
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <button type="button" onClick={onBack} className={`${LINK_BUTTON} min-h-[40px] md:min-h-0`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />All lists
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-gray-900 md:text-xl">{list.name}</h2>
            <p className="mt-1 text-sm text-gray-600">{summary}</p>
            <p className="mt-0.5 text-xs text-gray-500">{listSourceLabel(list.source)} · {consentLabel(list.consent_type)}</p>
          </div>
          {/* Phones: two rows of two ([Add person][Import], [Export CSV][⋯]); one row from md. */}
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
            <button type="button" onClick={() => setMemberDialog({ member: null })} className={`${BUTTON_PRIMARY} px-3 md:px-5`}><Plus className="h-4 w-4" aria-hidden="true" />Add person</button>
            <button type="button" onClick={() => setImportOpen(true)} aria-label="Import into this list" className={`${BUTTON_SECONDARY} whitespace-nowrap px-3 md:px-4`}>
              <FileUp className="h-4 w-4" aria-hidden="true" /><span className="min-[480px]:hidden">Import</span><span className="hidden min-[480px]:inline">Import into this list</span>
            </button>
            <div className="col-span-2 flex gap-2 md:contents">
            <button type="button" onClick={() => onAction('export', list)} disabled={exporting} className={`${BUTTON_SECONDARY} flex-1 px-4 md:flex-none`}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Export CSV
            </button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="More list actions" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-md border border-gray-200 bg-white shadow-lg">
                <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => onAction('rename', list))}><Pencil className="h-4 w-4" aria-hidden="true" />Rename</DropdownMenuItem>
                <DropdownMenuItem className={MENU_ITEM} onSelect={later(() => onAction('duplicate', list))}><Copy className="h-4 w-4" aria-hidden="true" />Duplicate</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className={MENU_DANGER} onSelect={later(() => onAction('delete', list))}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete list</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-3 md:flex-row md:items-center md:justify-between md:px-4">
          <SegmentedSwitch<MemberStatusFilter>
            label="Show"
            value={status}
            onChange={onStatusChange}
            className="w-full gap-0.5 md:w-auto md:gap-1 [&>button]:h-10 [&>button]:min-w-0 [&>button]:flex-auto [&>button]:justify-center [&>button]:gap-1 [&>button]:px-1.5 [&>button]:text-xs min-[400px]:[&>button]:text-sm md:[&>button]:h-8 md:[&>button]:flex-none md:[&>button]:gap-2 md:[&>button]:px-4"
            options={[
              { value: 'all', label: 'All', count: counts?.all ?? null },
              { value: 'subscribed', label: 'Subscribed', count: counts?.subscribed ?? null },
              { value: 'unsubscribed', label: 'Unsubscribed', count: counts?.unsubscribed ?? null },
            ]}
          />
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" value={searchInput} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search name, email or mobile"
              aria-label="Search people on this list" enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (searchTimer.current) clearTimeout(searchTimer.current); applySearch(searchInput); } }}
              className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 md:h-9 md:text-sm" />
          </div>
        </div>

        {selected.size ? (
          // Phones: the count and its clear button on one line, the two actions under it; one line from md.
          <div className="flex flex-col gap-2 border-b border-gray-100 bg-[#6C60FF]/5 px-3 py-2 md:flex-row md:items-center md:px-4">
            <div className="flex items-center justify-between gap-2 md:mr-auto">
              <span className="text-sm font-medium text-gray-900" aria-live="polite">{formatCount(selected.size)} chosen{full ? ` (the most at once is ${formatCount(MAX_SELECTED)})` : ''}</span>
              <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear the choice" className={`${ICON_BUTTON} md:hidden`}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
              <button type="button" onClick={() => setCopyOpen(true)} className={`${BUTTON_SECONDARY} px-3`}><Copy className="h-4 w-4" aria-hidden="true" />Copy to list…</button>
              <button type="button" onClick={() => setRemoving({ ids: [...selected], label: peopleText(selected.size) })} className={`${BUTTON_SECONDARY} border-red-200 px-3 text-red-600 hover:bg-red-50`}><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</button>
              <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear the choice" className={`${ICON_BUTTON} hidden md:inline-flex`}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          </div>
        ) : null}

        {loadError ? <div className="p-3 md:px-4"><ErrorNote>{loadError}</ErrorNote></div> : null}
        <div className={loading && members ? 'opacity-60 transition-opacity' : ''}>{table}</div>

        {meta && meta.total_pages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-3 py-3 text-sm text-gray-600 md:px-4">
            <button type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className={PAGE_BUTTON}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
            <span aria-live="polite">Page {meta.page} of {meta.total_pages}</span>
            <button type="button" aria-label="Next page" disabled={page >= meta.total_pages || loading} onClick={() => setPage((p) => p + 1)} className={PAGE_BUTTON}>Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        ) : null}
      </div>

      <MemberDialog
        open={memberDialog !== null}
        onOpenChange={(o) => { if (!o) setMemberDialog(null); }}
        listId={list.id}
        listName={list.name}
        member={memberDialog?.member ?? null}
        onSaved={(row, mode) => {
          toast.success(mode === 'add' ? `Added ${row ? displayName(row) : 'them'} to the list.` : 'Saved.');
          onListsStale();
          if (mode === 'add') setPage(1);
          void load();
        }}
        onGone={(message) => { if (message === 'Person not found') { toast.error('That person was removed somewhere else.'); void load(); } else onGone('That list was deleted somewhere else.'); }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => { if (!o) setRemoving(null); }}
        title={removing && removing.ids.length > 1 ? `Remove ${removing.label}?` : `Remove ${removing?.label ?? 'this person'}?`}
        confirmLabel="Remove"
        onConfirm={removeConfirmed}
      >
        <p>{removing && removing.ids.length > 1 ? 'They are' : 'This person is'} taken off &ldquo;{list.name}&rdquo; and their details on it are deleted for good. This can&rsquo;t be undone.</p>
      </ConfirmDialog>
      <CopyToListDialog open={copyOpen} onOpenChange={setCopyOpen} lists={otherLists} count={selected.size} onCopy={copyTo} />
      <ImportListModal open={importOpen} onOpenChange={setImportOpen} groups={[]} onCreated={() => {}} intoList={list} onMerged={onMerged} />
    </div>
  );
}
