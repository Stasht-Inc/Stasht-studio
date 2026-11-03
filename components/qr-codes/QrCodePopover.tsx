import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type ReactElement, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '../ui/use-mobile';
import { qrCodesAPI, QR_GENERIC_ERROR } from '../../services/qrCodesAPI';
import { liveCampaignRows, type QrCampaignOption, type QrCode } from '../../utils/qrCodes';
import { BUTTON_PRIMARY, BUTTON_SMALL, LINK_BUTTON } from '../newsletters/lib/ui';
import { BrandedQr, QrDownloadMenu, QrStyleControls } from './BrandedQr';

// QR codes v2 (Chris, 3 Nov 2026 evening): "keep it simple. a popover with a dropdown and the Live Campaign selected,
// with edit link". ONE code per view (the account's, or this property's), made by the API on first open. A popover
// from the Campaigns header's QR Code button (a bottom sheet on phones): the branded code, the Live campaign dropdown
// (the view's campaigns; searchable when long; "None" turns the code off), Edit (that campaign's page), Download, and
// "Logo & colour" tucked away behind one small link. The dropdown's list opens inline under it (inside the popover,
// never over the code) and works from the keyboard: arrows move, Enter picks, Escape closes it.

const SEARCH_DELAY_MS = 300;
/** Load the next page this close (px) to the list's end. */
const LOAD_AHEAD_PX = 120;
/** More campaigns than this: the dropdown gets a search box. */
const SEARCH_FROM = 8;
/** Above the bottom nav's floating + button (z-[10000]) on phones. */
const SHEET_Z = 'z-[10002]';
const FLOAT_Z = 'z-[10003]';
const QR_SIZE = 200;
/** The dropdown row that turns the code off (PATCH memory_id null): scans then show the API's 'not linked' page. */
export const NONE_LABEL = 'None (QR shows ‘not linked’)';
const NONE_VALUE = 'none';
/** Escape inside the open list closes the list only: the popover / sheet asks this first (true: handled). */
type EscapeRef = MutableRefObject<(() => boolean) | null>;

export interface QrCodePopoverProps {
  /** The property view's property; null in the account view. */
  propertyId: number | string | null;
  /** Edit: open this campaign's page in Studio. */
  onEditCampaign(memoryId: number): void;
  /** "create one" (no campaigns yet): start a new campaign. */
  onCreateCampaign(): void;
  /** The QR Code button. */
  children: ReactElement;
}

export default function QrCodePopover({ propertyId, onEditCampaign, onCreateCampaign, children }: QrCodePopoverProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const escapeRef: EscapeRef = useRef(null);
  const leave = (then: () => void) => {
    setOpen(false);
    then();
  };
  const onEscape = (e: { preventDefault(): void }) => {
    if (escapeRef.current?.()) e.preventDefault();
  };
  const panel = (sheet: boolean) => (
    <QrCodePanel propertyId={propertyId} onEdit={(id) => leave(() => onEditCampaign(id))} onCreate={() => leave(onCreateCampaign)}
      floatLayer={sheet ? FLOAT_Z : 'z-[60]'} escapeRef={escapeRef} />
  );

  if (isMobile) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{children}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={`fixed inset-0 ${SHEET_Z} bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`} />
          <Dialog.Content
            aria-describedby={undefined}
            data-qr-popover="sheet"
            onEscapeKeyDown={onEscape}
            className={`fixed inset-x-0 bottom-0 ${SHEET_Z} flex max-h-[90dvh] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300`}
          >
            <div className="mx-auto mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-gray-300" aria-hidden="true" />
            <div className="flex flex-shrink-0 items-center justify-between px-4 pb-1 pt-2">
              <Dialog.Title className="text-lg font-semibold text-gray-900">QR Code</Dialog.Title>
              <Dialog.Close aria-label="Close" className="-mr-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{panel(true)}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label="QR Code"
          data-qr-popover="popover"
          onEscapeKeyDown={onEscape}
          className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[360px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {panel(false)}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** What the popover / sheet shows: mounted on open, so each open asks the API afresh. */
function QrCodePanel({ propertyId, onEdit, onCreate, floatLayer, escapeRef }: {
  propertyId: number | string | null;
  onEdit(memoryId: number): void;
  onCreate(): void;
  /** z-index class for what floats above the panel (the Download menu). */
  floatLayer: string;
  escapeRef: EscapeRef;
}) {
  const [code, setCode] = useState<QrCode | null>(null);
  const [styleAvailable, setStyleAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  /** The colour drawn while the custom picker is open (undefined: the saved one). */
  const [preview, setPreview] = useState<string | null | undefined>(undefined);
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    setCode(null);
    setError(null);
    void qrCodesAPI.get(propertyId).then((res) => {
      if (id !== request.current) return;
      if (res.ok && res.data) {
        setCode(res.data.code);
        setStyleAvailable(res.data.styleAvailable);
      } else {
        setError(res.error ?? QR_GENERIC_ERROR);
      }
    });
  }, [propertyId, attempt]);

  /** A campaign goes live, or null: none (the code is off; scans show 'not linked'). */
  const makeLive = async (option: QrCampaignOption | null) => {
    const id = option ? option.id : null;
    if (!code || id === code.memoryId) return;
    setSaving(true);
    const res = await qrCodesAPI.update(code.id, { memory_id: id });
    setSaving(false);
    if (res.ok && res.data) setCode(res.data);
    else toast.error(res.error ?? QR_GENERIC_ERROR);
  };

  if (error) {
    return (
      <div role="alert" className="py-8 text-center">
        <p className="text-sm text-gray-700">{error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-3`}>Try again</button>
      </div>
    );
  }
  if (!code) {
    return <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting your QR code…</p>;
  }

  const live = code.memoryId !== null ? { id: code.memoryId, title: code.campaignTitle ?? '' } : null;
  return (
    <div className="flex flex-col">
      <div className="mx-auto overflow-hidden rounded-xl border border-gray-200 bg-white" data-qr-view={code.publicCode}>
        <BrandedQr code={code} size={QR_SIZE} color={preview} label="Your QR code" />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span id="qr-live-label" className="text-sm font-medium text-gray-900">Live campaign</span>
        {live ? (
          <button type="button" onClick={() => onEdit(live.id)} className={LINK_BUTTON} aria-label={`Edit ${live.title}`}>Edit</button>
        ) : null}
      </div>
      <LiveCampaignSelect propertyId={propertyId} live={live} saving={saving} onPick={makeLive} onCreate={onCreate} escapeRef={escapeRef} />

      <QrDownloadMenu code={code} contentClassName={floatLayer}>
        <button type="button" className={`${BUTTON_PRIMARY} mt-4 w-full`}>
          <Download className="h-4 w-4" aria-hidden="true" />Download<ChevronDown className="h-4 w-4 opacity-80" aria-hidden="true" />
        </button>
      </QrDownloadMenu>

      {styleAvailable ? (
        <div className="mt-3 text-center">
          <button type="button" onClick={() => setStyleOpen((o) => !o)} aria-expanded={styleOpen} aria-controls="qr-style-controls"
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
            Logo &amp; colour
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${styleOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {styleOpen ? (
            <div id="qr-style-controls" className="mt-3 border-t border-gray-100 pt-3">
              <QrStyleControls code={code} propertyId={propertyId} onChanged={setCode} onPreview={setPreview} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The Live campaign dropdown: a button and, when open, a listbox right under it (in the panel's flow, so it never
 * covers the code; it scrolls within its own height). The view's campaigns (20 a page, more on scroll), a search box
 * when there are many, and None at the bottom. Keyboard: Enter / Space / ↓ opens, ↑↓ move, Enter picks, Escape closes.
 */
function LiveCampaignSelect({ propertyId, live, saving, onPick, onCreate, escapeRef }: {
  propertyId: number | string | null;
  live: QrCampaignOption | null;
  saving: boolean;
  onPick(option: QrCampaignOption | null): void;
  onCreate(): void;
  escapeRef: EscapeRef;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<QrCampaignOption[] | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  /** Decided by the first, unsearched page: many campaigns → a search box. */
  const [searchable, setSearchable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** The highlighted row (cmdk value): the live campaign's id, or NONE_VALUE (a pinned, read-only live row: the first row). */
  const [active, setActive] = useState('');
  const requestRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  // The first page as the panel opens (so the list opens at once), again for each search.
  useEffect(() => {
    const request = ++requestRef.current;
    setRows(null);
    setError(null);
    setLoadingMore(false);
    setPage(1);
    void qrCodesAPI.campaignOptions(propertyId, query, 1).then((res) => {
      if (request !== requestRef.current) return;
      if (res.ok && res.data) {
        setRows(res.data.options);
        setTotalPages(res.data.totalPages);
        if (!query && res.data.total > SEARCH_FROM) setSearchable(true);
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
      setTotalPages(page); // stop asking; the loaded campaigns stay
    }
  }, [loadingMore, page, propertyId, query, rows]);

  const hasMore = rows !== null && rows.length > 0 && page < totalPages;
  // The next page once the list is scrolled near its end.
  const onListScroll = (el: HTMLElement) => {
    if (hasMore && !loadingMore && el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_AHEAD_PX) void loadMore();
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    setSearch('');
    if (refocus) triggerRef.current?.focus();
  };

  // Opened: highlight the live row, put the keyboard in the list (the search box when there is one), keep it in view.
  useEffect(() => {
    if (!open) return undefined;
    const pickable = live && rows?.some((r) => r.id === live.id);
    setActive(pickable && live ? String(live.id) : rows?.[0] ? String(rows[0].id) : NONE_VALUE);
    const frame = window.requestAnimationFrame(() => {
      (inputRef.current ?? commandRef.current)?.focus({ preventScroll: true });
      rootRef.current?.scrollIntoView({ block: 'nearest' });
    });
    escapeRef.current = () => {
      close(true);
      return true;
    };
    return () => {
      window.cancelAnimationFrame(frame);
      escapeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (option: QrCampaignOption | null) => {
    close(true);
    onPick(option);
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && !saving && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const shown = rows ? liveCampaignRows(rows, live, query !== '') : null;
  const itemClass = 'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-gray-900 outline-none data-[selected=true]:!rounded-md data-[selected=true]:!bg-[#6C60FF]/10 data-[selected=true]:!text-gray-900';
  let body: ReactNode;
  if (shown === null) {
    body = <p className="flex items-center justify-center gap-2 py-6 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Getting your campaigns…</p>;
  } else if (error) {
    body = (
      <div role="alert" className="px-3 py-5 text-center">
        <p className="text-sm text-gray-700">{error}</p>
        <button type="button" onClick={() => setAttempt((a) => a + 1)} className={`${BUTTON_SMALL} mt-2`}>Try again</button>
      </div>
    );
  } else {
    body = (
      <>
        {shown.length === 0 ? (
          query ? (
            <p className="px-3 py-4 text-center text-sm text-gray-600">No campaigns match “{query}”.</p>
          ) : (
            <p className="px-3 py-4 text-center text-sm text-gray-600" data-qr-no-campaigns>
              No campaigns yet —{' '}
              <button type="button" onClick={onCreate} className={`${LINK_BUTTON} inline`}>create one</button>
            </p>
          )
        ) : null}
        {shown.map((o) => {
          const selected = live?.id === o.id;
          // The live campaign may not be one this person can pick (e.g. another admin's own campaign): pinned on top,
          // shown as the selection, read-only.
          const pinned = selected && !rows?.some((r) => r.id === o.id);
          return (
            // ! : styles/globals.css paints every [data-selected] / [aria-selected] solid purple (for date pickers).
            <Command.Item key={o.id} value={String(o.id)} onSelect={() => pick(o)} disabled={pinned} data-selected-campaign={selected || undefined}
              data-qr-pinned={pinned || undefined} className={`${itemClass} data-[disabled=true]:cursor-default`}>
              <span className="min-w-0 flex-1 truncate" title={o.title}>{o.title}</span>
              {selected ? <Check className="h-4 w-4 flex-shrink-0 text-[#6C60FF]" aria-label="Live now" /> : null}
            </Command.Item>
          );
        })}
        {loadingMore ? <p role="status" className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading more…</p> : null}
        {!query && !hasMore ? (
          <Command.Item value={NONE_VALUE} onSelect={() => pick(null)} data-selected-campaign={live === null || undefined}
            className={`${itemClass} mt-1 border-t border-gray-100 !rounded-none pt-2.5 text-gray-600 data-[selected=true]:!text-gray-700`}>
            <span className="min-w-0 flex-1 truncate">{NONE_LABEL}</span>
            {live === null ? <Check className="h-4 w-4 flex-shrink-0 text-[#6C60FF]" aria-label="Live now" /> : null}
          </Command.Item>
        ) : null}
      </>
    );
  }

  return (
    <div
      ref={rootRef}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) close(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby="qr-live-label qr-live-value"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? 'qr-live-list' : undefined}
        aria-busy={saving || undefined}
        onClick={() => { if (!saving) (open ? close(false) : setOpen(true)); }}
        onKeyDown={onTriggerKeyDown}
        className="mt-1.5 flex h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 hover:border-gray-400 aria-busy:cursor-progress focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
      >
        <span id="qr-live-value" className={`min-w-0 flex-1 truncate ${live ? '' : 'text-gray-600'}`}>{live ? live.title : NONE_LABEL}</span>
        {saving ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[#6C60FF]" aria-hidden="true" /> : <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
      </button>
      {open ? (
        <Command
          ref={commandRef}
          tabIndex={-1}
          shouldFilter={false}
          loop
          value={active}
          onValueChange={setActive}
          label="Live campaign"
          data-qr-live-list
          className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
        >
          {searchable ? (
            <div className="border-b border-gray-100 p-2">
              <Command.Input ref={inputRef} value={search} onValueChange={setSearch} placeholder="Search campaigns" aria-label="Search campaigns"
                className="h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20" />
            </div>
          ) : null}
          <Command.List id="qr-live-list" onScroll={(e) => onListScroll(e.currentTarget)} className="max-h-60 overflow-y-auto p-1">
            {body}
          </Command.List>
        </Command>
      ) : null}
    </div>
  );
}
