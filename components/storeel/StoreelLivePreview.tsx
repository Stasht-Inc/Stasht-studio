import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Calendar, ExternalLink, Heart, MapPin, MessageSquare, MoreVertical, Play, Plus, SquarePen, X } from 'lucide-react';
import { storeelPreviewModel, type StoreelPreviewInput } from './storeelPreview';
import CampaignCover from '../ui/CampaignCover';
import { brandCoverColor } from '../../utils/campaignCover';
import type { PreviewMoment } from './lib/previewMoments';
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
 * page shows it: an uploaded photo / video, a Website Catalogue product (its moment, then its "View on website"
 * button card), a vehicle or a linked campaign — with the right "N moments". With none yet, one empty card.
 *
 * The cover is what the saved campaign page will show (Chris, 4 Nov 2026): the chosen cover photo, the intro video's
 * first frame, else the brand (account / property avatar) shown nicely by CampaignCover — else the initial on the
 * profile colour, as the campaign page does. Never the first photo, never a grey box.
 */

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

export default function StoreelLivePreview({ input, avatarUrl, avatarColor }: {
  input: StoreelPreviewInput;
  avatarUrl?: string | null;
  avatarColor?: string | null;
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
            className="h-7 min-w-0 rounded-md border border-gray-200 bg-white pl-2 pr-7 text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40"
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
              data-testid="storeel-preview-screen"
              className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-white text-gray-900 [&::-webkit-scrollbar]:hidden"
              style={{ width: device.width, height: device.height, borderRadius: screenRadius, scrollbarWidth: 'none' }}
            >
              <Cover m={m} height={device.height} color={color} avatarUrl={avatarUrl} initialCover={initialCover} />
              {/* Moment cards: every moment, in order (the page scrolls inside the phone) */}
              <ul data-testid="storeel-preview-moments" aria-label="Moments" className="relative z-10 px-4" style={{ marginTop: -CARD_OVERLAP }}>
                {m.momentCards.length ? m.momentCards.map((moment, i) => (
                  <li key={moment.key} data-moment-kind={moment.kind}>
                    {i > 0 ? <div className="my-[18px]"><Divider subtle={moment.kind === 'vehicle' || moment.kind === 'campaign'} /></div> : null}
                    <MomentCard moment={moment} author={m.author} initial={m.initial} avatarUrl={avatarUrl} color={color} />
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
function Cover({ m, height, color, avatarUrl, initialCover }: { m: Model; height: number; color: string; avatarUrl?: string | null; initialCover: ReactNode }) {
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
        <CampaignCover src={m.cover} isFallback={m.coverKind === 'brand'} color={color} className="h-full w-full" fallback={initialCover} centerY={0.3} />
      ) : initialCover}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 38%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.82) 100%)' }} />
      {/* Edit Cover / close, as in the design (display only) */}
      <div aria-hidden="true" className="absolute left-[27px] right-[28px] top-[18px] flex items-center justify-between">
        <span className={`${chip} h-10 gap-2 rounded-full px-4 text-[12.5px] font-medium`}><SquarePen className="h-[18px] w-[18px]" />Edit Cover</span>
        <span className={`${chip} h-[42px] w-[42px] rounded-full`}><X className="h-5 w-5" /></span>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 text-white" style={{ paddingBottom: CARD_OVERLAP + 18 }}>
        <div className="flex h-[35px] items-center gap-[5px]">
          {m.category ? <span className="flex h-full max-w-[60%] items-center truncate rounded-lg bg-[#6C60FF] px-[9px] text-[12.5px] text-white">{m.category}</span> : null}
          {m.year ? <span className="flex h-full items-center rounded-lg bg-[#FEC53D] px-[10px] text-[12.5px] font-medium text-gray-900">{m.year}</span> : null}
          <span className="ml-auto flex items-center gap-3 text-[13px]">
            <span className="flex items-center gap-1"><Heart className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
          </span>
        </div>
        <div className="mt-1 flex min-h-[36px] items-start gap-3">
          <p data-testid="storeel-preview-title" className="line-clamp-2 min-w-0 flex-1 break-words text-[29px] font-bold leading-[36px]">{m.title}</p>
          <span aria-hidden="true" className="mt-[5px] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-black/30"><MoreVertical className="h-4 w-4" /></span>
        </div>
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
          {/* The app's Continue (display only) */}
          <span aria-hidden="true" className="flex h-[39px] w-[103px] flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-[12.5px] text-gray-900 shadow-sm">Continue</span>
        </div>
        <div className="mt-[25px]"><Divider /></div>
      </div>
    </div>
  );
}

/** The line with the round + between the timeline's items (display only). */
function Divider({ subtle = false }: { subtle?: boolean }) {
  return (
    <div aria-hidden="true" className="relative flex items-center justify-center">
      <span className={`absolute inset-x-0 top-1/2 h-px ${subtle ? 'bg-gray-200' : 'bg-[#6C60FF]'}`} />
      <span className={`relative flex h-[33px] w-[33px] items-center justify-center rounded-full border bg-[#F3F4F6] ${subtle ? 'border-gray-200 text-gray-400' : 'border-[#6C60FF] text-[#6C60FF]'}`}>
        <Plus className="h-4 w-4" />
      </span>
    </div>
  );
}

const VIDEO_FRAME = (src: string) => `${src}#t=0.1`;

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

function AuthorRow({ author, initial, avatarUrl, color }: { author: string; initial: string; avatarUrl?: string | null; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar url={avatarUrl} initial={initial} color={color} size={35} />
      <span className="min-w-0 flex-1 truncate text-[15px]">{author}</span>
      <span className="flex flex-shrink-0 items-center gap-3 text-[13px] text-gray-900">
        <span className="flex items-center gap-1"><Heart className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
        <span className="flex items-center gap-1"><MessageSquare className="h-[18px] w-[18px]" aria-hidden="true" />0</span>
        <MoreVertical className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
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
function MomentCard({ moment, author, initial, avatarUrl, color }: { moment: PreviewMoment; author: string; initial: string; avatarUrl?: string | null; color: string }) {
  if (moment.kind === 'photo' || moment.kind === 'product') {
    // The campaign page: the moment's title, then its caption (a product's caption is made from the website by the API).
    const caption = moment.kind === 'photo' ? moment.caption : '';
    return (
      <>
        <Card>
          <MomentPicture src={moment.image} video={moment.kind === 'photo' && moment.video} />
          <div className="px-[21px] pb-[22px] pt-[21px]">
            <AuthorRow author={author} initial={initial} avatarUrl={avatarUrl} color={color} />
            <PlaceAndDate location={moment.location} date={moment.date} />
            {moment.title ? <p className="mt-[6px] line-clamp-2 break-words text-[18.5px] font-bold leading-[26px] text-[#1A1A1A]">{moment.title}</p> : null}
            {caption ? <p className="mt-[6px] line-clamp-3 whitespace-pre-line break-words text-[14.5px] leading-[21px] text-[#364153]">{caption}</p> : null}
          </div>
        </Card>
        {/* A product's "View on website" button card (CatalogSnapshotWriter's CTA: its price, else its title). */}
        {moment.kind === 'product' && moment.cta ? (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 text-center text-gray-900">
            <p className="line-clamp-2 break-words text-[19px] font-bold">{moment.price || moment.title}</p>
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C60FF] px-4 py-3 text-[15px] font-semibold text-white">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />View on website
            </span>
          </div>
        ) : null}
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
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
        <p className="line-clamp-2 break-words text-[24px] font-bold leading-[30px]">{moment.title || 'Untitled'}</p>
        {details.length ? <p className="mt-1 truncate text-[14px]">{details.join(' · ')}</p> : null}
      </div>
    </div>
  );
}
