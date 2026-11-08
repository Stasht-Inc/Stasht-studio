import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Calendar, ExternalLink, Heart, ImageIcon, MapPin, MessageSquare, MoreVertical, Pencil, Play, Plus, SquarePen, Trash2, Video, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { storeelPreviewModel, type StoreelPreviewInput } from './storeelPreview';
import CampaignCover from '../ui/CampaignCover';
import { brandCoverColor } from '../../utils/campaignCover';
import type { PreviewMoment } from './lib/previewMoments';
import { plusAfter } from './lib/momentOrder';
import { PREVIEW_DEVICES, fitScale, previewDevice, readPreviewDevice, savePreviewDevice, type PreviewDevice } from './lib/previewDevice';

/**
 * [wdy2xh2t3z] The Storeel tab's PREVIEW: the Storeel as it will look, following the form. Display only.
 *
 * Chris, 6 Nov 2026 (point 2): a real PHONE SCREEN built to his Figma "Story Details - Cover" — the chosen phone's CSS
 * size (iPhone 15 by default; the small picker above it, remembered in this browser) scaled to fit the panel, with the
 * page scrolling inside it: a full-screen cover (Edit Cover / close chips, category and year pills, likes and comments,
 * the title, place and dates, the author), "Timeline • N moments" with Continue, then the moments as cards.
 *
 * Storeel flow v2 (4 Nov 2026): the timeline shows EVERY moment the campaign will have, in order, as the campaign
 * page shows it: an uploaded photo / video, a Website Catalogue product (its moment, with its "View on website"
 * button inside the card — Chris, 8 Nov 2026), a vehicle or a linked campaign — with the right "N moments". With none yet, one empty card.
 *
 * The cover is what the saved campaign page will show (Chris, 4 Nov 2026): the chosen cover photo, the intro video's
 * first frame, else the brand (account / property avatar) shown nicely by CampaignCover — else the initial on the
 * profile colour, as the campaign page does. Never the first photo, never a grey box.
 */

/** A moment's ⋮ menu (Chris, 7 Nov 2026): only the actions it has are shown. */
export interface MomentMenuActions { label: string; edit?: () => void; up?: () => void; down?: () => void; remove?: () => void }

/**
 * The preview's controls (Chris, 7 Nov 2026, point 6: "I am not able to tap the + buttons"): every "+" adds moments at
 * that place, a moment's ⋮ edits / moves / deletes it, Edit Cover picks the cover, the title's ⋮ goes to the title
 * field, Continue scrolls to the timeline. Without them the preview is display only.
 */
export interface PreviewControls {
  /** A "+": add moments right after the moment with this key (null: first, under the cover). */
  onAddAfter(key: string | null): void;
  menuFor(key: string, index: number): MomentMenuActions | null;
  cover: { onPhoto(): void; onVideo(): void; onRemove?: () => void };
  onEditTitle(): void;
  /** While a change is being saved: the controls wait. */
  busy?: boolean;
}

/** Radix menus portal to <body>: above the Storeel page (z 99999) and its pickers. */
const MENU_Z = { zIndex: 100002 };
const MENU_ITEM = 'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-gray-800 focus:bg-gray-100';

/** The phone's frame around the screen (device CSS px, scaled with it). */
const BEZEL = 10;
/** Screen corner radius per phone (device CSS px). */
const SCREEN_RADIUS: Record<string, number> = { 'iphone-se': 28, 'iphone-15': 55, 'iphone-15-pro-max': 55, 'pixel-8': 46 };
/** Figma: the first moment card overlaps the bottom of the cover by this much. */
const CARD_OVERLAP = 85;

/** The nearest scrolling ancestor (the Storeel page's scroller), else null (the window scrolls). */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/**
 * The room the phone has: the panel's width, and — so the whole phone is seen at once — the height of the page's
 * scroller (less the panel's heading while the preview sits beside the form, sticky).
 */
function useRoom(ref: React.RefObject<HTMLDivElement>) {
  const [room, setRoom] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const width = el.clientWidth;
      const aside = el.closest('aside');
      const sticky = aside ? getComputedStyle(aside).position === 'sticky' : false;
      const visible = scrollParent(el)?.clientHeight ?? window.innerHeight;
      // Beside the form: below the panel's heading, with the page's top padding and the panel's bottom padding still in
      // view. Below the form (phones): the phone alone fits the scroller once scrolled to.
      const above = sticky && aside ? el.getBoundingClientRect().top - aside.getBoundingClientRect().top + 48 : 24;
      const height = Math.round(visible - above);
      setRoom((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [ref]);
  return room;
}

export default function StoreelLivePreview({ input, avatarUrl, avatarColor, controls }: {
  input: StoreelPreviewInput;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  controls?: PreviewControls;
}) {
  const m = storeelPreviewModel(input);
  const color = brandCoverColor(avatarColor);
  const [device, setDevice] = useState<PreviewDevice>(() => readPreviewDevice());
  const chooseDevice = (id: string) => { setDevice(previewDevice(id)); savePreviewDevice(id); };
  const roomRef = useRef<HTMLDivElement>(null);
  const room = useRoom(roomRef);
  const frame = { width: device.width + 2 * BEZEL, height: device.height + 2 * BEZEL };
  const scale = fitScale(frame, room);
  const screenRadius = SCREEN_RADIUS[device.id] ?? 48;
  // A new phone starts at the top of the Storeel.
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => { screenRef.current?.scrollTo?.(0, 0); }, [device.id]);
  // Continue: down to the timeline (the first moment), inside the phone.
  const momentsRef = useRef<HTMLUListElement>(null);
  const toTimeline = () => {
    const screen = screenRef.current;
    const list = momentsRef.current;
    if (screen && list) screen.scrollTo?.({ top: Math.max(0, list.offsetTop - 24), behavior: 'smooth' });
  };

  // The initial sits in the cover's upper part (as the brand logo does, centerY 0.3), clear of the details at its foot.
  const initialCover = (
    <div className="relative h-full w-full" style={{ backgroundColor: color }}>
      <span className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 text-8xl font-bold uppercase text-white">{m.initial}</span>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Preview</p>
        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="Phone size"
            data-testid="storeel-preview-device"
            value={device.id}
            onChange={(e) => chooseDevice(e.target.value)}
            // Compact beside "Live"; 44 px tall on phones (touch target).
            className="h-11 w-[9.5rem] rounded-md border border-gray-200 bg-white pl-2 pr-6 text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 sm:h-7"
          >
            {PREVIEW_DEVICES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <span className="rounded-full bg-[#6C60FF]/10 px-2 py-0.5 text-xs font-medium text-[#6C60FF]">Live</span>
        </div>
      </div>
      <div ref={roomRef} className="flex w-full justify-center">
        {/* The phone keeps its real CSS size and is scaled as a whole, so it is the device's shape at any width. */}
        <div className="relative flex-shrink-0" style={{ width: frame.width * scale, height: frame.height * scale }}>
          <div
            data-testid="storeel-preview" aria-label="Live preview of your Storeel" role="figure"
            data-device={device.id}
            className="absolute left-0 top-0 bg-[#0B0B0F] shadow-[0_8px_24px_rgba(17,24,39,0.18)]"
            style={{ width: frame.width, height: frame.height, padding: BEZEL, borderRadius: screenRadius + BEZEL, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          >
            <div
              ref={screenRef}
              // Keyboard users can scroll the Storeel inside the phone (Safari / Firefox don't focus scrollers themselves).
              tabIndex={0}
              role="region"
              aria-label="Storeel preview, scrolls"
              data-testid="storeel-preview-screen"
              className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-white text-gray-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6C60FF]/50 [&::-webkit-scrollbar]:hidden"
              style={{ width: device.width, height: device.height, borderRadius: screenRadius, scrollbarWidth: 'none' }}
            >
              <Cover m={m} width={device.width} height={device.height} color={color} avatarUrl={avatarUrl} initialCover={initialCover} controls={controls} onContinue={toTimeline} />
              {/* Moment cards: every moment, in order (the page scrolls inside the phone) */}
              <ul ref={momentsRef} data-testid="storeel-preview-moments" aria-label="Moments" className="relative z-10 px-4" style={{ marginTop: -CARD_OVERLAP }}>
                {m.momentCards.length ? m.momentCards.map((moment, i) => (
                  <li key={moment.key} data-moment-kind={moment.kind} data-moment-key={moment.key}>
                    {/* Figma: purple between moments and before the first campaign card, grey after a campaign card. */}
                    {i > 0 ? (
                      <div className="my-[18px]">
                        {/* A "+" only after a moment with a place: vehicles always show last (review minor 5). */}
                        <Divider subtle={isCampaignCard(m.momentCards[i - 1])} controls={plusAfter(m.momentCards, i - 1) ? controls : undefined}
                          label={`Add a moment after ${momentLabel(m.momentCards[i - 1])}`} onAdd={() => controls?.onAddAfter(m.momentCards[i - 1].key)} />
                      </div>
                    ) : null}
                    <MomentCard moment={moment} author={m.author} initial={m.initial} avatarUrl={avatarUrl} color={color} menu={controls?.menuFor(moment.key, i) ?? null} busy={controls?.busy} />
                    {/* After the last moment: one more "+" (Chris: "+ after moments"). */}
                    {controls && i === m.momentCards.length - 1 && plusAfter(m.momentCards, i) ? (
                      <div className="mt-[18px]">
                        <Divider subtle={isCampaignCard(moment)} controls={controls} label="Add a moment at the end" onAdd={() => controls.onAddAfter(moment.key)} />
                      </div>
                    ) : null}
                  </li>
                )) : (
                  <li>
                    <Card>
                      <div className="aspect-[370/256] bg-gray-100" />
                      <div className="px-[21px] pb-[22px] pt-[21px]">
                        <AuthorRow author={m.author} initial={m.initial} avatarUrl={avatarUrl} color={color} />
                        <PlaceAndDate location={m.location} date={m.date} />
                        <p className="mt-[6px] text-[14.5px] leading-[21px] text-[#364153]">Add content here</p>
                      </div>
                    </Card>
                  </li>
                )}
              </ul>
              <p className="py-7 text-center text-[15px] text-gray-400">Powered by <span className="font-semibold text-[#6C60FF]">Stasht</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Model = ReturnType<typeof storeelPreviewModel>;

/**
 * The full-screen cover (Figma "Story Details - Cover"): the picture fills the phone's first screen; the details sit
 * at its bottom over a dark fade, ending with "Timeline • N moments" and the divider the first card follows.
 */
function Cover({ m, width, height, color, avatarUrl, initialCover, controls, onContinue }: {
  m: Model; width: number; height: number; color: string; avatarUrl?: string | null; initialCover: ReactNode; controls?: PreviewControls; onContinue(): void;
}) {
  const chip = 'flex items-center justify-center bg-black/25 text-white backdrop-blur-sm';
  return (
    <div className="relative overflow-hidden" style={{ height }} data-testid="storeel-preview-cover" data-cover-kind={m.coverKind ?? 'none'}>
      {m.coverKind === 'video' && m.cover ? (
        <>
          <video src={VIDEO_FRAME(m.cover)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
              <Play className="ml-1 h-7 w-7 text-white" aria-hidden="true" />
            </span>
          </span>
        </>
      ) : m.cover ? (
        <CampaignCover src={m.cover} isFallback={m.coverKind === 'brand'} color={color} className="h-full w-full" fallback={initialCover} centerY={0.3}
          // "Too small" is judged against the phone's width, not its tall screen: an ordinary photo fills the cover.
          judgeBox={{ width, height: width }} />
      ) : initialCover}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 38%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.82) 100%)' }} />
      {/* Edit Cover: the form's Cover photo / Intro video pickers (Chris, 7 Nov 2026). The design's ✕ closes the app's
          screen, which means nothing here, so it is not drawn. */}
      <div className="absolute left-[27px] top-[18px] flex items-center">
        {controls ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={controls.busy} data-testid="storeel-preview-edit-cover"
                className={`${chip} h-10 gap-2 rounded-full px-4 text-[12.5px] font-medium hover:bg-black/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70`}>
                <SquarePen className="h-[18px] w-[18px]" aria-hidden="true" />Edit Cover
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" style={MENU_Z} className="bg-white">
              <DropdownMenuItem className={MENU_ITEM} onSelect={() => controls.cover.onPhoto()}><ImageIcon className="h-4 w-4" aria-hidden="true" />Cover photo</DropdownMenuItem>
              <DropdownMenuItem className={MENU_ITEM} onSelect={() => controls.cover.onVideo()}><Video className="h-4 w-4" aria-hidden="true" />Intro video</DropdownMenuItem>
              {controls.cover.onRemove ? (
                <DropdownMenuItem className={`${MENU_ITEM} text-red-600 focus:text-red-600`} onSelect={() => controls.cover.onRemove?.()}><X className="h-4 w-4" aria-hidden="true" />Remove cover</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span aria-hidden="true" className={`${chip} h-10 gap-2 rounded-full px-4 text-[12.5px] font-medium`}><SquarePen className="h-[18px] w-[18px]" />Edit Cover</span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 text-white" style={{ paddingBottom: CARD_OVERLAP + 18 }}>
        <div className="flex h-[35px] items-center gap-[5px]">
          {m.category ? <span data-testid="storeel-preview-category" className="flex h-full min-w-0 max-w-[60%] items-center rounded-lg bg-[#6C60FF] px-[9px] text-[12.5px] text-white"><span className="truncate">{m.category}</span></span> : null}
          {m.year ? <span className="flex h-full items-center rounded-lg bg-[#FEC53D] px-[10px] text-[12.5px] font-medium text-gray-900">{m.year}</span> : null}
          <span aria-hidden="true" className="ml-auto flex flex-shrink-0 items-center gap-3 text-[13px]">
            <span className="flex items-center gap-1"><Heart className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
          </span>
        </div>
        {/* No title yet: no row (as the old preview), so no empty band with a lone ⋮. */}
        {m.title ? (
          <div className="mt-1 flex min-h-[36px] items-start gap-3">
            <p data-testid="storeel-preview-title" className="line-clamp-2 min-w-0 flex-1 break-words text-[29px] font-bold leading-[36px]">{m.title}</p>
            {controls ? (
              <button type="button" onClick={controls.onEditTitle} aria-label="Edit the campaign's title and details" data-testid="storeel-preview-title-menu"
                className="mt-[5px] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-black/30 hover:bg-black/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <span aria-hidden="true" className="mt-[5px] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-black/30"><MoreVertical className="h-4 w-4" /></span>
            )}
          </div>
        ) : null}
        {m.location || m.dateRange ? (
          <div className="mt-[6px] flex h-5 min-w-0 items-center gap-4 text-[13.5px]">
            {m.location ? <span className="flex min-w-0 items-center gap-[6px]"><MapPin className="h-[17px] w-[17px] flex-shrink-0" aria-hidden="true" /><span className="truncate">{m.location}</span></span> : null}
            {m.dateRange ? <span className="flex flex-shrink-0 items-center gap-[6px]"><Calendar className="h-[17px] w-[17px]" aria-hidden="true" />{m.dateRange}</span> : null}
          </div>
        ) : null}
        <div className="mt-[9px] flex h-6 min-w-0 items-center gap-2 text-[16px]">
          <Avatar url={avatarUrl} initial={m.initial} color={color} size={24} />
          <span className="min-w-0 truncate">Author: <span className="font-bold">{m.author}</span></span>
        </div>
        <div className="mt-[17px] flex h-[39px] items-center justify-between gap-3 pl-2 pr-0.5">
          <p className="min-w-0 truncate"><span className="text-[16px] font-bold">Timeline</span><span className="text-[13.5px]"> • {m.moments}</span></p>
          {/* The app's Continue: down to the timeline. */}
          {controls ? (
            <button type="button" onClick={onContinue} data-testid="storeel-preview-continue"
              className="flex h-[39px] w-[103px] flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-[12.5px] text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70">
              Continue
            </button>
          ) : (
            <span aria-hidden="true" className="flex h-[39px] w-[103px] flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-[12.5px] text-gray-900 shadow-sm">Continue</span>
          )}
        </div>
        <div className="mt-[25px]"><Divider controls={controls} label="Add a moment at the start" onAdd={() => controls?.onAddAfter(null)} /></div>
      </div>
    </div>
  );
}

/** The line with the round + between the timeline's items: a button that adds moments there (with controls). */
function Divider({ subtle = false, controls, label = '', onAdd }: { subtle?: boolean; controls?: PreviewControls; label?: string; onAdd?: () => void }) {
  const circle = `relative flex h-[33px] w-[33px] items-center justify-center rounded-full border bg-[#F3F4F6] ${subtle ? 'border-gray-200 text-gray-400' : 'border-[#6C60FF] text-[#6C60FF]'}`;
  return (
    <div aria-hidden={controls ? undefined : true} className="relative flex items-center justify-center">
      <span aria-hidden="true" className={`absolute inset-x-0 top-1/2 h-px ${subtle ? 'bg-gray-200' : 'bg-[#6C60FF]'}`} />
      {controls ? (
        // A 44 px hit area (device px) around the drawn 33 px circle.
        <button type="button" onClick={onAdd} disabled={controls.busy} aria-label={label} data-testid="storeel-preview-add"
          className="group relative -my-[5.5px] flex h-11 w-11 items-center justify-center rounded-full focus:outline-none disabled:cursor-wait">
          <span className={`${circle} transition-colors group-hover:bg-[#6C60FF] group-hover:text-white group-focus-visible:ring-4 group-focus-visible:ring-[#6C60FF]/50`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      ) : (
        <span className={circle}><Plus className="h-4 w-4" /></span>
      )}
    </div>
  );
}

/** How a moment is named in the controls' labels. */
function momentLabel(moment: PreviewMoment): string {
  const caption = moment.kind === 'photo' ? moment.caption.split('\n')[0] : '';
  return moment.title || caption || (moment.kind === 'photo' ? (moment.video ? 'this video' : 'this photo') : 'this moment');
}

/** A moment's ⋮: Edit Moment / Move up / Move down / Delete (only those it has). */
function MomentMenu({ menu, busy, className, iconClass = 'h-[18px] w-[18px]' }: { menu: MomentMenuActions; busy?: boolean; className: string; iconClass?: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={busy} aria-label={`Moment actions: ${menu.label}`} data-testid="storeel-preview-moment-menu" className={className}>
          <MoreVertical className={iconClass} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={MENU_Z} className="bg-white">
        {menu.edit ? <DropdownMenuItem className={MENU_ITEM} onSelect={() => menu.edit?.()}><Pencil className="h-4 w-4" aria-hidden="true" />Edit Moment</DropdownMenuItem> : null}
        {menu.up ? <DropdownMenuItem className={MENU_ITEM} onSelect={() => menu.up?.()}><ArrowUp className="h-4 w-4" aria-hidden="true" />Move up</DropdownMenuItem> : null}
        {menu.down ? <DropdownMenuItem className={MENU_ITEM} onSelect={() => menu.down?.()}><ArrowDown className="h-4 w-4" aria-hidden="true" />Move down</DropdownMenuItem> : null}
        {menu.remove ? <DropdownMenuItem className={`${MENU_ITEM} text-red-600 focus:text-red-600`} onSelect={() => menu.remove?.()}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const VIDEO_FRAME = (src: string) => `${src}#t=0.1`;
const isCampaignCard = (moment: PreviewMoment) => moment.kind === 'vehicle' || moment.kind === 'campaign';

function Card({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900">{children}</div>;
}

function MomentPicture({ src, video }: { src: string | null; video?: boolean }) {
  if (!src) return <div className="aspect-[370/256] bg-gray-100" />;
  if (video) return <video src={VIDEO_FRAME(src)} muted playsInline preload="metadata" className="aspect-[370/256] w-full object-cover" />;
  return <img src={src} alt="" className="aspect-[370/256] w-full object-cover" />;
}

function Avatar({ url, initial, color, size }: { url?: string | null; initial: string; color: string; size: number }) {
  return url
    ? <img src={url} alt="" className="flex-shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : (
      <span className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.45) }}>
        {initial}
      </span>
    );
}

function AuthorRow({ author, initial, avatarUrl, color, menu = null, busy }: { author: string; initial: string; avatarUrl?: string | null; color: string; menu?: MomentMenuActions | null; busy?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar url={avatarUrl} initial={initial} color={color} size={35} />
      <span className="min-w-0 flex-1 truncate text-[15px]">{author}</span>
      <span aria-hidden="true" className="flex flex-shrink-0 items-center gap-3 text-[13px] text-gray-900">
        <span className="flex items-center gap-1"><Heart className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
        <span className="flex items-center gap-1"><MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
        {menu ? null : <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />}
      </span>
      {menu ? (
        <MomentMenu menu={menu} busy={busy}
          className="-my-2 -mr-2 flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-md text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#6C60FF]/50" />
      ) : null}
    </div>
  );
}

function PlaceAndDate({ location, date }: { location: string; date: string }) {
  if (!location && !date) return null;
  return (
    <div className="mt-[10px] flex min-w-0 items-center justify-between gap-3 text-[13.5px] text-gray-500">
      {location ? <span className="flex min-w-0 items-center gap-[6px]"><MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" /><span className="truncate">{location}</span></span> : <span />}
      {date ? <span className="flex flex-shrink-0 items-center gap-[6px]"><Calendar className="h-4 w-4" aria-hidden="true" />{date}</span> : null}
    </div>
  );
}

/** One moment as the published campaign shows it (PublishedMemoryPage / the campaign page's timeline). */
function MomentCard({ moment, author, initial, avatarUrl, color, menu = null, busy }: {
  moment: PreviewMoment; author: string; initial: string; avatarUrl?: string | null; color: string; menu?: MomentMenuActions | null; busy?: boolean;
}) {
  if (moment.kind === 'photo' || moment.kind === 'product') {
    // The campaign page: the moment's title, then its caption (a product's caption is made from the website by the API).
    const caption = moment.kind === 'photo' ? moment.caption : '';
    return (
      <>
        <Card>
          <MomentPicture src={moment.image} video={moment.kind === 'photo' && moment.video} />
          <div className="px-[21px] pb-[22px] pt-[21px]">
            <AuthorRow author={author} initial={initial} avatarUrl={avatarUrl} color={color} menu={menu} busy={busy} />
            <PlaceAndDate location={moment.location} date={moment.date} />
            {moment.title ? <p className="mt-[6px] line-clamp-2 break-words text-[18.5px] font-bold leading-[26px] text-[#1A1A1A]">{moment.title}</p> : null}
            {caption ? <p className="mt-[6px] line-clamp-3 whitespace-pre-line break-words text-[14.5px] leading-[21px] text-[#364153]">{caption}</p> : null}
            {/* A product: its price (the moment's details carry it), then its "View on website" button INSIDE the card,
                under the details — no second card repeating the title (Chris, 8 Nov 2026). */}
            {moment.kind === 'product' && moment.price ? <p className="mt-[6px] break-words text-[14.5px] leading-[21px] text-[#364153]">Price: {moment.price}</p> : null}
            {moment.kind === 'product' && moment.cta ? (
              <span data-testid="storeel-preview-product-button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C60FF] px-4 py-3 text-[15px] font-semibold text-white">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />View on website
              </span>
            ) : null}
          </div>
        </Card>
      </>
    );
  }
  // A vehicle or a linked campaign / Shopify collection: the campaign card (Figma: the picture with its title and
  // details over it), as the campaign page shows it.
  const details = moment.kind === 'vehicle' ? [moment.price, ...moment.tags].filter(Boolean) : [moment.meta].filter(Boolean);
  return (
    <div className="relative aspect-[370/281] overflow-hidden rounded-[20px] bg-gray-200 text-white">
      {moment.image ? <img src={moment.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.75) 100%)' }} />
      {menu ? (
        <MomentMenu menu={menu} busy={busy}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70" />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
        <p className="line-clamp-2 break-words text-[24px] font-bold leading-[30px]">{moment.title || 'Untitled'}</p>
        {details.length ? <p className="mt-1 truncate text-[14px]">{details.join(' · ')}</p> : null}
      </div>
    </div>
  );
}
