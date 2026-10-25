import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { composerToast } from './ComposerToaster';
import { newslettersAPI, type ContactList, type ContactListMembers } from '../../services/newslettersAPI';
import ComposerDialog from './ComposerDialog';
import { GENERIC_ERROR } from './lib/apiResult';
import { listDetails, memberConsentText } from './lib/manageLists';
import { LIMITS } from './lib/rules';
import { BUTTON_OUTLINE, BUTTON_SMALL, LINK_BUTTON, inputClass } from './lib/ui';

export interface ManageListsDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** A list was renamed or deleted: the Send to checklist reloads. */
  onChanged(): void;
  onDeleted(listId: number): void;
}

const SMALL_DANGER = `${BUTTON_SMALL} border-red-200 text-red-600 hover:bg-red-50`;
const SMALL_PRIMARY = 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#6C60FF] px-3 text-xs font-medium text-white hover:bg-[#5B50E6] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';

/**
 * [wdy2xh2p3k] The person's own lists (spec privacy follow-up): who is on each one, rename, delete. Deleting removes
 * the people on it for good; a list a scheduled newsletter still needs can't be deleted (409).
 */
export default function ManageListsDialog({ open, onOpenChange, onChanged, onDeleted }: ManageListsDialogProps) {
  const [lists, setLists] = useState<ContactList[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ContactList | null>(null);
  const [members, setMembers] = useState<ContactListMembers | null>(null);
  const [page, setPage] = useState(1);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const requestRef = useRef(0);
  const yesRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Where focus goes after the rows change: a row's Delete button (Keep it), or the row now in the deleted one's place.
  const [focusAfter, setFocusAfter] = useState<{ kind: 'button'; id: number; action: 'delete' | 'rename' } | { kind: 'index'; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await newslettersAPI.contactLists();
    if (res.ok && Array.isArray(res.data)) setLists(res.data);
    else { setLists((prev) => prev ?? []); setLoadError(res.error ?? GENERIC_ERROR); }
  }, []);

  useEffect(() => {
    if (!open) {
      setLists(null); setViewing(null); setMembers(null); setPage(1); setRenaming(null); setDeleting(null); setRowError(null); setBusy(false);
      return;
    }
    void load();
  }, [open, load]);

  // Members of the list being viewed, 50 a page; only the latest request may update the table. A list deleted
  // elsewhere (404) takes the person back to their lists, reloaded.
  useEffect(() => {
    if (!viewing) return;
    const request = ++requestRef.current;
    setMembersError(null);
    void newslettersAPI.listMembers(viewing.id, page).then((res) => {
      if (request !== requestRef.current) return;
      if (res.ok && res.data) setMembers(res.data);
      else if (res.status === 404) {
        setViewing(null); setMembers(null); setPage(1);
        void load().then(() => { setLoadError('That list was deleted somewhere else.'); onChanged(); });
      } else setMembersError(res.error ?? GENERIC_ERROR);
    });
  }, [viewing, page, load, onChanged]);

  // "Yes, delete it" takes focus when the question shows.
  useEffect(() => { if (deleting !== null) yesRef.current?.focus(); }, [deleting]);
  useLayoutEffect(() => {
    if (!focusAfter) return;
    setFocusAfter(null);
    if (focusAfter.kind === 'button') {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-list-id="${focusAfter.id}"] [data-action="${focusAfter.action}"]`)?.focus();
      return;
    }
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-list-id]');
    const row = rows?.[Math.min(focusAfter.index, (rows?.length ?? 1) - 1)];
    (row?.querySelector<HTMLButtonElement>('[data-action="view"]') ?? doneRef.current)?.focus();
  }, [focusAfter, lists]);

  const saveName = async () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) { setRowError({ id: renaming.id, message: 'Give the list a name.' }); return; }
    setBusy(true);
    const res = await newslettersAPI.renameList(renaming.id, name);
    setBusy(false);
    if (!res.ok || !res.data) {
      if (res.status === 404) {
        // Deleted somewhere else: show the lists as they are now.
        setRenaming(null);
        void load().then(() => { setLoadError('That list was deleted somewhere else.'); onChanged(); });
        return;
      }
      setRowError({ id: renaming.id, message: res.fieldErrors.name ?? res.error ?? GENERIC_ERROR });
      return;
    }
    const renamed = res.data;
    setLists((prev) => prev?.map((l) => (l.id === renamed.id ? { ...l, ...renamed } : l)) ?? prev);
    setRenaming(null);
    setRowError(null);
    setFocusAfter({ kind: 'button', id: renamed.id, action: 'rename' });
    composerToast.success('List renamed.');
    onChanged();
  };

  const remove = async (list: ContactList) => {
    setBusy(true);
    const res = await newslettersAPI.deleteList(list.id);
    setBusy(false);
    setDeleting(null);
    if (!res.ok) {
      // 409: a scheduled or sending newsletter still uses it. 404: deleted elsewhere.
      setRowError({ id: list.id, message: res.error ?? GENERIC_ERROR });
      if (!res.conflict) void load();
      setFocusAfter({ kind: 'button', id: list.id, action: 'delete' });
      return;
    }
    const index = lists?.findIndex((l) => l.id === list.id) ?? 0;
    setLists((prev) => prev?.filter((l) => l.id !== list.id) ?? prev);
    setFocusAfter({ kind: 'index', index: Math.max(0, index) });
    setRowError(null);
    composerToast.success(`Deleted the list "${list.name}".`);
    onDeleted(list.id);
    onChanged();
  };

  const footer = <button ref={doneRef} type="button" onClick={() => onOpenChange(false)} className={BUTTON_OUTLINE}>Done</button>;

  let body;
  if (viewing) {
    const rows = members?.data ?? [];
    const meta = members?.meta;
    body = (
      <div className="space-y-3">
        <button type="button" onClick={() => { setViewing(null); setMembers(null); setPage(1); }} className={LINK_BUTTON}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />All lists
        </button>
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold text-gray-900">{viewing.name}</h3>
          <p className="text-xs text-gray-500">{listDetails(viewing)}</p>
        </div>
        {membersError ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{membersError}</p> : null}
        {members === null && !membersError ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading people…</div>
        ) : rows.length === 0 && !membersError ? (
          <p className="py-6 text-center text-sm text-gray-500">Nobody is on this list.</p>
        ) : rows.length ? (
          <div className="rounded-lg border border-gray-200">
            <table className="w-full table-fixed text-left text-xs sm:text-sm">
              <colgroup><col className="w-[30%]" /><col /><col className="w-[6.75rem] sm:w-[8.5rem]" /></colgroup>
              <caption className="sr-only">People on {viewing.name}</caption>
              <thead className="bg-gray-50 text-xs font-medium text-gray-600">
                <tr><th scope="col" className="px-2.5 py-2 sm:px-3">Name</th><th scope="col" className="px-2.5 py-2 sm:px-3">Email</th><th scope="col" className="px-2.5 py-2 sm:px-3">Mobile</th></tr>
              </thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={`${page}-${i}`} className="border-t border-gray-100">
                    <td className="px-2.5 py-2 align-top [overflow-wrap:anywhere] sm:px-3">
                      {m.name ?? '—'}
                      <span className="block text-xs text-gray-500">{memberConsentText(m)}</span>
                    </td>
                    <td className="px-2.5 py-2 align-top [overflow-wrap:anywhere] sm:px-3">{m.email ?? '—'}</td>
                    <td className="whitespace-nowrap px-2.5 py-2 align-top sm:px-3">{m.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {meta && meta.total_pages > 1 ? (
          <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
            <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={BUTTON_SMALL}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
            <span aria-live="polite">Page {meta.page} of {meta.total_pages}</span>
            <button type="button" aria-label="Next page" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)} className={BUTTON_SMALL}>Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        ) : null}
      </div>
    );
  } else if (lists === null) {
    body = <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading your lists…</div>;
  } else {
    body = (
      <div className="space-y-3">
        {loadError ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p> : null}
        {lists.length === 0 && !loadError ? <p className="py-6 text-center text-sm text-gray-500">No lists yet. Use Add a list to bring in your contacts.</p> : null}
        {lists.length ? (
          <ul ref={listRef} aria-label="Your lists" className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {lists.map((l) => (
              <li key={l.id} data-list-id={l.id} className="space-y-2 px-4 py-3">
                {renaming?.id === l.id ? (
                  <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
                    <label htmlFor={`nl-rename-${l.id}`} className="sr-only">New name for {l.name}</label>
                    <input id={`nl-rename-${l.id}`} type="text" value={renaming.name} maxLength={LIMITS.name} autoFocus
                      onChange={(e) => setRenaming({ id: l.id, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveName(); } }}
                      className={`${inputClass(rowError?.id === l.id)} min-w-0 flex-1`} />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void saveName()} disabled={busy} className={SMALL_PRIMARY}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}Save</button>
                      <button type="button" onClick={() => { const id = l.id; setRenaming(null); setRowError(null); setFocusAfter({ kind: 'button', id, action: 'rename' }); }} disabled={busy} className={BUTTON_SMALL}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-gray-900">{l.name}</p>
                    <p className="text-xs text-gray-500">{listDetails(l)}</p>
                  </div>
                )}
                {deleting === l.id ? (
                  <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                    <p>Delete &ldquo;{l.name}&rdquo;? The people on it are removed for good. Newsletters already sent keep their results.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button ref={yesRef} type="button" onClick={() => void remove(l)} disabled={busy} className={`${SMALL_DANGER} bg-white`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}Yes, delete it</button>
                      <button type="button" onClick={() => { setDeleting(null); setFocusAfter({ kind: 'button', id: l.id, action: 'delete' }); }} disabled={busy} className={BUTTON_SMALL}>Keep it</button>
                    </div>
                  </div>
                ) : renaming?.id === l.id ? null : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <button type="button" data-action="view" onClick={() => { setViewing(l); setMembers(null); setPage(1); }} className={LINK_BUTTON}>View people</button>
                    <button type="button" data-action="rename" onClick={() => { setRenaming({ id: l.id, name: l.name }); setDeleting(null); setRowError(null); }} className={LINK_BUTTON}>Rename</button>
                    <button type="button" data-action="delete" onClick={() => { setDeleting(l.id); setRenaming(null); setRowError(null); }} className={`${LINK_BUTTON} text-red-600`}>Delete</button>
                  </div>
                )}
                {rowError?.id === l.id ? <p role="alert" className="text-xs text-red-600">{rowError.message}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }} title="Manage lists" wide
      // Escape while renaming (or asked to delete) cancels that only; the dialog stays open.
      onEscapeKeyDown={(e) => {
        if (renaming) { e.preventDefault(); const id = renaming.id; setRenaming(null); setRowError(null); setFocusAfter({ kind: 'button', id, action: 'rename' }); }
        else if (deleting !== null) { e.preventDefault(); const id = deleting; setDeleting(null); setFocusAfter({ kind: 'button', id, action: 'delete' }); }
      }}
      description="See who is on each list, rename it or delete it." footer={footer}>
      {body}
    </ComposerDialog>
  );
}
