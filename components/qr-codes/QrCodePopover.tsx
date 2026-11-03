import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
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
// (every campaign of the view, published or not; searchable when long), Edit (that campaign's page), Download, and
// "Logo & colour" tucked away behind one small link.

const SEARCH_DELAY_MS = 300;
/** Load the next page this close (px) to the list's end. */
const LOAD_AHEAD_PX = 120;
/** More campaigns than this: the dropdown gets a search box. */
const SEARCH_FROM = 8;
/** Above the bottom nav's floating + button (z-[10000]) on phones. */
const SHEET_Z = 'z-[10002]';
const FLOAT_Z = 'z-[10003]';
const QR_SIZE = 200;

export interface QrCodePopoverProps {
  /** The property view's property; null in the account view. */
  propertyId: number | string | null;
  /** Edit: open this campaign's page in Studio. */
  onEditCampaign(memoryId: number): void;
  /** The QR Code button. */
  children: ReactElement;
}

export default function QrCodePopover({ propertyId, onEditCampaign, children }: QrCodePopoverProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const edit = (id: number) => {
    setOpen(false);
    onEditCampaign(id);
  };
  const panel = (sheet: boolean) => <QrCodePanel propertyId={propertyId} onEdit={edit} floatLayer={sheet ? FLOAT_Z : 'z-[60]'} />;

  if (isMobile) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{children}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={`fixed inset-0 ${SHEET_Z} bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`} />
          <Dialog.Content
            aria-describedby={undefined}
            data-qr-popover="sheet"
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
          className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[360px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {panel(false)}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** What the popover / sheet shows: mounted on open, so each open asks the API afresh. */
function QrCodePanel({ propertyId, onEdit, floatLayer }: {
  propertyId: number | string | null;
  onEdit(memoryId: number): void;
  /** z-index class for what floats above the panel (the dropdown, the Download menu). */
  floatLayer: string;
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

  const makeLive = async (option: QrCampaignOption) => {
    if (!code || option.id === code.memoryId) return;
    setSaving(true);
    const res = await qrCodesAPI.update(code.id, { memory_id: option.id });
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
      <LiveCampaignSelect propertyId={propertyId} live={live} saving={saving} onPick={makeLive} floatLayer={floatLayer} />

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

/** The Live campaign dropdown: every campaign of the view (20 a page, more on scroll), a search box when there are many. */
function LiveCampaignSelect({ propertyId, live, saving, onPick, floatLayer }: {
  propertyId: number | string | null;
  live: QrCampaignOption | null;
  saving: boolean;
  onPick(option: QrCampaignOption): void;
  floatLayer: string;
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
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  // The first page as the panel opens (so the dropdown opens at once), again for each search.
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

  useEffect(() => { if (!open) setSearch(''); }, [open]);

  const shown = rows ? liveCampaignRows(rows, live, query !== '') : null;
  const noCampaigns = !live && rows !== null && rows.length === 0 && !query && !error;
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
        <Command.Empty className="px-3 py-6 text-center text-sm text-gray-600">{query ? `No campaigns match “${query}”.` : 'You have no campaigns yet.'}</Command.Empty>
        {shown.map((o) => {
          const selected = live?.id === o.id;
          return (
            <Command.Item
              key={o.id}
              value={String(o.id)}
              onSelect={() => { setOpen(false); onPick(o); }}
              data-selected-campaign={selected || undefined}
              // ! : styles/globals.css paints every [data-selected] / [aria-selected] solid purple (for date pickers).
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-gray-900 outline-none data-[selected=true]:!rounded-md data-[selected=true]:!bg-[#6C60FF]/10 data-[selected=true]:!text-gray-900"
            >
              <span className="min-w-0 flex-1 truncate" title={o.title}>{o.title}</span>
              {selected ? <Check className="h-4 w-4 flex-shrink-0 text-[#6C60FF]" aria-label="Live now" /> : null}
            </Command.Item>
          );
        })}
        {loadingMore ? <p role="status" className="flex items-center justify-center gap-2 py-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#6C60FF]" aria-hidden="true" />Loading more…</p> : null}
      </>
    );
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-labelledby="qr-live-label qr-live-value"
          aria-haspopup="listbox"
          disabled={saving || noCampaigns}
          className="mt-1.5 flex h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm text-gray-900 hover:border-gray-400 disabled:cursor-default disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
        >
          <span id="qr-live-value" className="min-w-0 flex-1 truncate">{noCampaigns ? 'No campaigns yet' : live ? live.title : 'Choose a campaign'}</span>
          {saving ? <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[#6C60FF]" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className={`${floatLayer} w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg outline-none`}
        >
          <Command shouldFilter={false} loop label="Live campaign">
            {searchable ? (
              <div className="border-b border-gray-100 p-2">
                <Command.Input value={search} onValueChange={setSearch} placeholder="Search campaigns" aria-label="Search campaigns"
                  className="h-9 w-full rounded-md border border-gray-200 px-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20" />
              </div>
            ) : null}
            <Command.List onScroll={(e) => onListScroll(e.currentTarget)} className="max-h-[min(280px,var(--radix-popover-content-available-height))] overflow-y-auto p-1">
              {body}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
