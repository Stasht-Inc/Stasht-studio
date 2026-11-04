import { Calendar, ExternalLink, MapPin, MessageSquare, Play } from 'lucide-react';
import { storeelPreviewModel, type StoreelPreviewInput } from './storeelPreview';
import CampaignCover from '../ui/CampaignCover';
import { brandCoverColor } from '../../utils/campaignCover';
import type { PreviewMoment } from './lib/previewMoments';

/**
 * [wdy2xh2t3z] The Storeel tab's PREVIEW (Chris's prototype): a dark phone-style Storeel that follows the form —
 * the cover, "Timeline · N moments" with Continue, a moment card (author, comments, place, date, the first image or
 * "Add content here") and "Powered by Stasht". Display only.
 *
 * Storeel flow v2 (4 Nov 2026): the timeline shows EVERY moment the campaign will have, in order, as the campaign
 * page shows it: an uploaded photo / video, a Website Catalogue product (its moment, then its "View on website"
 * button card), a vehicle or a linked campaign — with the right "N moments". With none yet, one empty card.
 *
 * The cover is what the saved campaign page will show (Chris, 4 Nov 2026): the chosen cover photo, the intro video's
 * first frame, else the brand (account / property avatar) shown nicely by CampaignCover — else the initial on the
 * profile colour, as the campaign page does. Never the first photo, never a grey box.
 */
export default function StoreelLivePreview({ input, avatarUrl, avatarColor }: {
  input: StoreelPreviewInput;
  avatarUrl?: string | null;
  avatarColor?: string | null;
}) {
  const m = storeelPreviewModel(input);
  const color = brandCoverColor(avatarColor);
  const initialCover = (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: color }}>
      <span className="text-6xl font-bold uppercase text-white">{m.initial}</span>
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Preview</p>
        <span className="rounded-full bg-[#6C60FF]/10 px-2 py-0.5 text-xs font-medium text-[#6C60FF]">Live</span>
      </div>
      <div data-testid="storeel-preview" aria-label="Live preview of your Storeel" role="figure"
        className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[1.25rem] bg-[#111827] text-white shadow-sm">
        {/* Cover */}
        <div className="relative h-52 overflow-hidden rounded-b-[1.25rem]" data-testid="storeel-preview-cover" data-cover-kind={m.coverKind ?? 'none'}>
          {m.coverKind === 'video' && m.cover ? (
            <>
              <video src={`${m.cover}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
                  <Play className="ml-0.5 h-5 w-5 text-white" aria-hidden="true" />
                </span>
              </span>
            </>
          ) : m.cover ? (
            <CampaignCover src={m.cover} isFallback={m.coverKind === 'brand'} color={color} className="h-full w-full" fallback={initialCover} />
          ) : initialCover}
          {m.title ? (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-8">
              <p className="line-clamp-2 break-words text-lg font-bold leading-6">{m.title}</p>
            </div>
          ) : null}
        </div>
        {/* Timeline */}
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <p className="min-w-0 truncate text-base"><span className="font-semibold">Timeline</span><span className="text-gray-300"> · {m.moments}</span></p>
          <span className="flex-shrink-0 rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-gray-900">Continue</span>
        </div>
        {/* Moment cards: every moment, in order (scrolls inside the phone when there are many) */}
        <ul data-testid="storeel-preview-moments" aria-label="Moments" className="space-y-3 px-4 lg:max-h-[32rem] lg:overflow-y-auto">
          {m.momentCards.length ? m.momentCards.map((moment) => (
            <li key={moment.key} data-moment-kind={moment.kind} className="space-y-3">
              <MomentCard moment={moment} author={m.author} initial={m.initial} avatarUrl={avatarUrl} color={color} />
            </li>
          )) : (
            <li className="overflow-hidden rounded-xl bg-white text-gray-900">
              <div className="h-32 bg-gray-100" />
              <div className="space-y-2 px-4 py-3">
                <AuthorRow author={m.author} initial={m.initial} avatarUrl={avatarUrl} color={color} />
                <PlaceAndDate location={m.location} date={m.date} />
                <p className="text-sm text-gray-700">Add content here</p>
              </div>
            </li>
          )}
        </ul>
        <p className="py-5 text-center text-sm text-gray-400">Powered by <span className="font-semibold text-[#6C60FF]">Stasht</span></p>
      </div>
    </div>
  );
}

const VIDEO_FRAME = (src: string) => `${src}#t=0.1`;

function MomentPicture({ src, video }: { src: string | null; video?: boolean }) {
  if (!src) return <div className="h-32 bg-gray-100" />;
  if (video) return <video src={VIDEO_FRAME(src)} muted playsInline preload="metadata" className="h-32 w-full object-cover" />;
  return <img src={src} alt="" className="h-32 w-full object-cover" />;
}

function AuthorRow({ author, initial, avatarUrl, color }: { author: string; initial: string; avatarUrl?: string | null; color: string }) {
  return (
    <div className="flex items-center gap-2">
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
        : <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: color }}>{initial}</span>}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{author}</span>
      <span className="flex items-center gap-1 text-sm text-gray-600"><MessageSquare className="h-4 w-4" aria-hidden="true" />0</span>
    </div>
  );
}

function PlaceAndDate({ location, date }: { location: string; date: string }) {
  if (!location && !date) return null;
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm text-gray-600">
      {location ? <span className="flex min-w-0 items-center gap-1"><MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" /><span className="truncate">{location}</span></span> : null}
      {date ? <span className="flex flex-shrink-0 items-center gap-1"><Calendar className="h-4 w-4" aria-hidden="true" />{date}</span> : null}
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
        <div className="overflow-hidden rounded-xl bg-white text-gray-900">
          <MomentPicture src={moment.image} video={moment.kind === 'photo' && moment.video} />
          <div className="space-y-2 px-4 py-3">
            <AuthorRow author={author} initial={initial} avatarUrl={avatarUrl} color={color} />
            <PlaceAndDate location={moment.location} date={moment.date} />
            {moment.title ? <p className="line-clamp-2 break-words text-sm font-medium text-gray-900">{moment.title}</p> : null}
            {caption ? <p className="line-clamp-3 whitespace-pre-line break-words text-sm text-gray-700">{caption}</p> : null}
          </div>
        </div>
        {/* A product's "View on website" button card (CatalogSnapshotWriter's CTA: its price, else its title). */}
        {moment.kind === 'product' && moment.cta ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4 text-center text-gray-900">
            <p className="line-clamp-2 break-words text-base font-bold">{moment.price || moment.title}</p>
            <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C60FF] px-4 py-2.5 text-sm font-semibold text-white">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />View on website
            </span>
          </div>
        ) : null}
      </>
    );
  }
  // A vehicle or a linked campaign / Shopify collection: a campaign card (MemoryCard), as the campaign page shows it.
  const details = moment.kind === 'vehicle' ? [moment.price, ...moment.tags].filter(Boolean) : [moment.meta];
  return (
    <div className="overflow-hidden rounded-xl bg-white text-gray-900">
      <MomentPicture src={moment.image} />
      <div className="space-y-1 px-4 py-3">
        <p className="line-clamp-2 break-words text-sm font-semibold">{moment.title || 'Untitled'}</p>
        {details.length ? <p className="truncate text-sm text-gray-600">{details.join(' · ')}</p> : null}
      </div>
    </div>
  );
}
