import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, MoreHorizontal, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { qrCodesAPI, QR_GENERIC_ERROR } from '../../services/qrCodesAPI';
import {
  DELETE_TEXT, EMPTY_TEXT, campaignHint, campaignUse, canPick, canPublish, cleanName, opensLabel, opensWarning, scansLabel,
  type QrCampaignOption, type QrCode,
} from '../../utils/qrCodes';
import { keyboardOnlyFocusReturn } from '../../utils/menuFocus';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, BUTTON_SMALL, BUTTON_SMALL_PRIMARY, LINK_BUTTON, inputClass } from '../newsletters/lib/ui';
import { BrandedQr, QrDownloadMenu, QrStyleControls } from './BrandedQr';

const SEARCH_DELAY_MS = 300;
const LOAD_AHEAD = '0px 0px 240px 0px';

const ROW_ACTION = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';

// code: one code's view (just made, or opened from the list): the code as it prints, Download, image and colour.
type Screen = { name: 'list' } | { name: 'pick'; change: QrCode | null } | { name: 'code'; code: QrCode };

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

export interface QrCodesDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The property view's property; null in the account view. */
  propertyId: number | string | null;
}

/**
 * Dynamic QR Codes (3 Nov 2026), from the Campaigns tab. A code is printed once and opens whichever campaign it points
 * at now; "Change campaign" re-points it without reprinting. Codes belong to the view they were made in (account or
 * property). Full screen on phones, a dialog from sm up.
 */
export default function QrCodesDialog({ open, onOpenChange, propertyId }: QrCodesDialogProps) {
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [codes, setCodes] = useState<QrCode[] | null>(null);
  /** Whether the API can save an image / colour per code yet (else: the default look, no controls). */
  const [styleAvailable, setStyleAvailable] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<{ id: number; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QrCode | null>(null);
  /** The colour drawn while the custom picker is open (undefined: the saved one). */
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const listRequest = useRef(0);

  // A fresh list each time it opens, and when the view changes underneath it.
  useEffect(() => {
    if (!open) return;
    const request = ++listRequest.current;
    setCodes(null);
    setListError(null);
    void qrCodesAPI.list(propertyId).then((res) => {
      if (request !== listRequest.current) return;
      if (res.ok && res.data) {
        setCodes(res.data.codes);
        setStyleAvailable(res.data.styleAvailable);
      }
      else {
        setCodes([]);
        setListError(res.error ?? QR_GENERIC_ERROR);
      }
    });
  }, [open, propertyId, attempt]);

  useEffect(() => {
    if (!open) {
      setScreen({ name: 'list' });
      setRenaming(null);
      setBusyId(null);
    }
  }, [open]);

  useEffect(() => { setPreview(undefined); }, [screen]);

  const replaceCode = (code: QrCode) => setCodes((list) => (list ?? []).map((c) => (c.id === code.id ? code : c)));

  const saveName = async () => {
    if (!renaming) return;
    const code = codes?.find((c) => c.id === renaming.id);
    const name = cleanName(renaming.value);
    if (!code || !name || name === code.name) {
      setRenaming(null);
      return;
    }
    setBusyId(code.id);
    const res = await qrCodesAPI.update(code.id, { name });
    setBusyId(null);
    if (res.ok && res.data) {
      replaceCode(res.data);
      setRenaming(null);
    } else {
      toast.error(res.error ?? QR_GENERIC_ERROR);
    }
  };

  const deleteCode = async (code: QrCode) => {
    setBusyId(code.id);
    const res = await qrCodesAPI.remove(code.id);
    setBusyId(null);
    if (res.ok) setCodes((list) => (list ?? []).filter((c) => c.id !== code.id));
    else toast.error(res.error ?? QR_GENERIC_ERROR);
  };

  // A campaign chosen in the picker: make a new code for it, or point the code being changed at it.
  const onPicked = async (option: QrCampaignOption, change: QrCode | null): Promise<boolean> => {
    if (change) {
      const res = await qrCodesAPI.update(change.id, { memory_id: option.id });
      if (!res.ok || !res.data) {
        toast.error(res.error ?? QR_GENERIC_ERROR);
        return false;
      }
      replaceCode(res.data);
      setScreen({ name: 'list' });
      return true;
    }
    const res = await qrCodesAPI.create(option.id, propertyId);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? QR_GENERIC_ERROR);
      return false;
    }
    const code = res.data;
    setCodes((list) => [code, ...(list ?? []).filter((c) => c.id !== code.id)]);
    setScreen({ name: 'code', code });
    return true;
  };

  const startCreate = () => setScreen({ name: 'pick', change: null });

  let title = 'QR Codes';
  let body: ReactElement;
  let footer: ReactElement | null = null;
  let back: (() => void) | null = null;

  if (screen.name === 'pick') {
    title = screen.change ? 'Change campaign' : 'Choose a campaign';
    back = () => setScreen({ name: 'list' });
    body = <CampaignPicker propertyId={propertyId} current={screen.change?.memoryId ?? null} onPick={(o) => onPicked(o, screen.change)} />;
  } else if (screen.name === 'code') {
    const code = codes?.find((c) => c.id === screen.code.id) ?? screen.code;
    body = (
      <div className="flex flex-col items-center py-2 text-center">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white" data-qr-view={code.publicCode}>
          <BrandedQr code={code} size={220} color={preview} label={`QR code for ${code.name}`} />
        </div>
        <p className="mt-3 max-w-full truncate text-base font-semibold text-gray-900">{code.name}</p>
        <p className="max-w-full truncate text-sm text-gray-600">{opensLabel(code)}</p>
        <div className="mt-4 flex w-full justify-center">
          <QrDownloadMenu code={code}>
            <button type="button" className={`${BUTTON_PRIMARY} w-full sm:w-auto`}><Download className="h-4 w-4" aria-hidden="true" />Download</button>
          </QrDownloadMenu>
        </div>
        {styleAvailable ? (
          <div className="mt-5 w-full border-t border-gray-100 pt-4">
            <QrStyleControls code={code} propertyId={propertyId} onChanged={(c) => { replaceCode(c); setScreen({ name: 'code', code: c }); }} onPreview={setPreview} />
          </div>
        ) : null}
      </div>
    );
    footer = <button type="button" onClick={() => setScreen({ name: 'list' })} className={BUTTON_OUTLINE}>Done</button>;
  } else if (codes === null) {
    body = <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting your QR codes…</p>;
  } else if (listError) {
    body = (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm text-gray-700">{listError}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-3`}>Try again</button>
      </div>
    );
  } else if (codes.length === 0) {
    body = (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="max-w-sm text-sm text-gray-700">{EMPTY_TEXT}</p>
        <button type="button" onClick={startCreate} className={`${BUTTON_PRIMARY} mt-4`}>Create QR Code</button>
      </div>
    );
  } else {
    body = (
      <ul aria-label="Your QR codes" className="divide-y divide-gray-100">
        {codes.map((code) => {
          const busy = busyId === code.id;
          const isRenaming = renaming?.id === code.id;
          return (
            <li key={code.id} data-qr-row={code.publicCode} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button type="button" onClick={() => setScreen({ name: 'code', code })} aria-label={`Open ${code.name}`} title={styleAvailable ? 'Image & colour' : code.name}
                  className="flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                  <BrandedQr code={code} size={48} />
                </button>
                <div className="min-w-0 flex-1">
                  {isRenaming ? (
                    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
                      <label htmlFor={`qr-name-${code.id}`} className="sr-only">Name</label>
                      <input id={`qr-name-${code.id}`} autoFocus value={renaming.value} maxLength={120} disabled={busy}
                        onChange={(e) => setRenaming({ id: code.id, value: e.target.value })} className={inputClass()} />
                      <button type="submit" disabled={busy} className={BUTTON_SMALL_PRIMARY}>Save</button>
                      <button type="button" disabled={busy} onClick={() => setRenaming(null)} className={BUTTON_SMALL}>Cancel</button>
                    </form>
                  ) : (
                    <p className="truncate text-sm font-medium text-gray-900" title={code.name}>{code.name}</p>
                  )}
                  <p className={`truncate text-xs ${opensWarning(code) ? 'text-amber-700' : 'text-gray-600'}`}>{opensLabel(code)}</p>
                  <p className="text-xs text-gray-500">{scansLabel(code.scanCount)}</p>
                </div>
              </div>
              {isRenaming ? null : (
                <div className="flex flex-shrink-0 items-center gap-2 pl-[3.5rem] sm:pl-0">
                  <button type="button" disabled={busy} onClick={() => setScreen({ name: 'pick', change: code })} className={BUTTON_SMALL}>Change campaign</button>
                  <QrDownloadMenu code={code} disabled={busy}>
                    <button type="button" disabled={busy} className={BUTTON_SMALL}><Download className="h-3.5 w-3.5" aria-hidden="true" />Download</button>
                  </QrDownloadMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`More actions for ${code.name}`} title="More actions" disabled={busy} className={ROW_ACTION}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4 text-gray-500" aria-hidden="true" />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-md border border-gray-200 bg-white shadow-lg" onCloseAutoFocus={keyboardOnlyFocusReturn}>
                      {/* Open the next thing after the menu has closed, or Radix leaves the page unclickable. */}
                      <DropdownMenuItem className="cursor-pointer hover:bg-[#6C60FF]/5" onSelect={() => window.setTimeout(() => setRenaming({ id: code.id, value: code.name }), 0)}>Rename</DropdownMenuItem>
                      {styleAvailable ? (
                        <DropdownMenuItem className="cursor-pointer hover:bg-[#6C60FF]/5" onSelect={() => window.setTimeout(() => setScreen({ name: 'code', code }), 0)}>Image &amp; colour</DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="cursor-pointer text-red-600 hover:bg-red-50 focus:text-red-600" onSelect={() => window.setTimeout(() => setConfirmDelete(code), 0)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
    footer = <button type="button" onClick={startCreate} className={BUTTON_PRIMARY}>Create QR Code</button>;
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={(e) => {
              // Escape steps back first: out of a rename, then out of the picker / new code.
              if (renaming) { e.preventDefault(); setRenaming(null); } else if (screen.name !== 'list') { e.preventDefault(); setScreen({ name: 'list' }); }
            }}
            className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:max-w-[600px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:shadow-xl"
          >
            <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
              {back ? (
                <button type="button" onClick={back} aria-label="Back" className="-ml-1.5 rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : null}
              <Dialog.Title className="min-w-0 flex-1 truncate text-lg font-semibold text-gray-900">{title}</Dialog.Title>
              <Dialog.Close aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">{body}</div>
            {footer ? <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">{footer}</div> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this QR code?</AlertDialogTitle>
            <AlertDialogDescription>{DELETE_TEXT}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmDelete) void deleteCode(confirmDelete); }} className="bg-red-600 text-white hover:bg-red-700">
              Yes, delete it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

/** One pick from the view's campaigns. Not published → Publish (publicly) in place when the API allows it (can_publish);
 * private, or anything else the API calls unusable → its reason, not pickable. */
function CampaignPicker({ propertyId, current, onPick }: {
  propertyId: number | string | null;
  current: number | null;
  onPick(option: QrCampaignOption): Promise<boolean>;
}) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<QrCampaignOption[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const request = ++requestRef.current;
    setRows(null);
    setError(null);
    setMoreError(null);
    setLoadingMore(false);
    setPage(1);
    void qrCodesAPI.campaignOptions(propertyId, query, 1).then((res) => {
      if (request !== requestRef.current) return;
      if (res.ok && res.data) {
        setRows(res.data.options);
        setTotalPages(res.data.totalPages);
      } else {
        setRows([]);
        setError(res.error ?? QR_GENERIC_ERROR);
      }
    });
  }, [propertyId, query, attempt]);

  const loadMore = useCallback(async () => {
    const request = requestRef.current;
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    const next = page + 1;
    const res = await qrCodesAPI.campaignOptions(propertyId, query, next);
    if (request !== requestRef.current) return;
    setLoadingMore(false);
    if (res.ok && res.data) {
      const seen = new Set((rows ?? []).map((r) => r.id));
      setRows([...(rows ?? []), ...res.data.options.filter((o) => !seen.has(o.id))]);
      setPage(next);
      setTotalPages(res.data.options.length ? res.data.totalPages : next);
    } else {
      setMoreError(res.error ?? QR_GENERIC_ERROR);
    }
  }, [loadingMore, page, propertyId, query, rows]);

  const hasMore = rows !== null && rows.length > 0 && page < totalPages && !moreError;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!hasMore || loadingMore || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { root: scrollParent(el), rootMargin: LOAD_AHEAD });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  // Publish, then ask the server how the campaign stands now (it may still have no public link) rather than assume.
  const publish = async (o: QrCampaignOption) => {
    setPublishingId(o.id);
    const res = await qrCodesAPI.publish(o.id);
    if (!res.ok) {
      setPublishingId(null);
      toast.error(res.error ?? "Couldn't publish this campaign. Please try again.");
      return;
    }
    const again = await qrCodesAPI.campaignOptions(propertyId, o.title, 1);
    setPublishingId(null);
    const fresh = again.ok ? again.data?.options.find((r) => r.id === o.id) : undefined;
    if (fresh) setRows((list) => (list ?? []).map((r) => (r.id === o.id ? fresh : r)));
    else setAttempt((a) => a + 1); // not found by its title: load the list again
  };

  const pick = async (o: QrCampaignOption) => {
    if (pickingId !== null) return;
    setPickingId(o.id);
    const done = await onPick(o);
    if (!done) setPickingId(null);
  };

  let list: ReactElement;
  if (rows === null) {
    list = <p className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting your campaigns…</p>;
  } else if (error) {
    list = (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm text-gray-700">{error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-3`}>Try again</button>
      </div>
    );
  } else if (rows.length === 0) {
    list = <p className="py-10 text-center text-sm text-gray-600">{query ? `No campaigns match “${query}”.` : 'You have no campaigns yet.'}</p>;
  } else {
    list = (
      <>
        <ul aria-label="Your campaigns" className="divide-y divide-gray-100">
          {rows.map((o) => {
            const use = campaignUse(o);
            const pickable = canPick(use);
            const hint = campaignHint(o);
            const isCurrent = current === o.id;
            const cover = o.coverUrl && /^https:\/\//i.test(o.coverUrl) ? o.coverUrl : null;
            const inner = (
              <>
                <span aria-hidden="true" className={`flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#6C60FF]/20 to-[#6C60FF]/5 ${pickable ? '' : 'opacity-50'}`}>
                  {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-[#6C60FF]/60" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${pickable ? 'text-gray-900' : 'text-gray-500'}`}>{o.title}</span>
                  {canPublish(o) ? (
                    <span className="block text-xs text-gray-600">
                      {hint} ·{' '}
                      <button type="button" onClick={() => void publish(o)} disabled={publishingId !== null} className={`${LINK_BUTTON} text-xs`}>
                        {publishingId === o.id ? <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Publishing…</> : 'Publish'}
                      </button>
                    </span>
                  ) : hint ? (
                    <span className={`block text-xs ${use === 'viewOnly' || use === 'unpublished' ? 'text-gray-500' : 'text-amber-700'}`}>{hint}</span>
                  ) : null}
                </span>
                {pickingId === o.id ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[#6C60FF]" aria-hidden="true" /> : null}
                {isCurrent && pickingId !== o.id ? <Check className="h-4 w-4 flex-shrink-0 text-[#6C60FF]" aria-label="Opens now" /> : null}
              </>
            );
            return (
              <li key={o.id}>
                {pickable ? (
                  <button type="button" onClick={() => void pick(o)} disabled={pickingId !== null || isCurrent} aria-current={isCurrent || undefined}
                    className="flex w-full items-center gap-3 rounded-lg py-3 text-left hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                    {inner}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 py-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
        {loadingMore ? (
          <p role="status" className="flex items-center justify-center gap-2 py-3 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading more…</p>
        ) : null}
        {moreError ? (
          <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-3 text-center">
            <p className="text-xs text-red-600">{moreError}</p>
            <button type="button" onClick={() => { setMoreError(null); void loadMore(); }} className={BUTTON_SMALL}>Try again</button>
          </div>
        ) : null}
        {hasMore ? <div ref={sentinelRef} aria-hidden="true" className="h-px" /> : null}
      </>
    );
  }

  return (
    <>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <label htmlFor="qr-campaign-search" className="sr-only">Search your campaigns</label>
        <input id="qr-campaign-search" type="search" value={search} placeholder="Search your campaigns" autoComplete="off"
          onChange={(e) => setSearch(e.target.value)} className={`${inputClass()} pl-9`} />
      </div>
      {list}
    </>
  );
}
