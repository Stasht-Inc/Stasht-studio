import { Calendar, MapPin, MessageSquare } from 'lucide-react';
import { storeelPreviewModel, type StoreelPreviewInput } from './storeelPreview';

/**
 * [wdy2xh2t3z] The Storeel tab's PREVIEW (Chris's prototype): a dark phone-style Storeel that follows the form —
 * the cover (first picked image, or a gradient), "Timeline · N moments" with Continue, a moment card (author,
 * comments, place, date, the first image or "Add content here") and "Powered by Stasht". Display only.
 */
export default function StoreelLivePreview({ input, avatarUrl, avatarColor }: {
  input: StoreelPreviewInput;
  avatarUrl?: string | null;
  avatarColor?: string | null;
}) {
  const m = storeelPreviewModel(input);
  const color = avatarColor && /^#[0-9a-f]{6}$/i.test(avatarColor) ? avatarColor : '#6C60FF';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Preview</p>
        <span className="rounded-full bg-[#6C60FF]/10 px-2 py-0.5 text-xs font-medium text-[#6C60FF]">Live</span>
      </div>
      <div data-testid="storeel-preview" aria-label="Live preview of your Storeel" role="img"
        className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[1.25rem] bg-[#111827] text-white shadow-sm">
        {/* Cover */}
        <div className="relative h-52 overflow-hidden rounded-b-[1.25rem]">
          {m.cover
            ? <img src={m.cover} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-gradient-to-b from-gray-300 via-gray-500 to-gray-900" />}
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
        {/* Moment card */}
        <div className="mx-4 overflow-hidden rounded-xl bg-white text-gray-900">
          {m.firstImage ? <img src={m.firstImage} alt="" className="h-32 w-full object-cover" /> : <div className="h-32 bg-gray-100" />}
          <div className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-2">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                : <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: color }}>{m.initial}</span>}
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.author}</span>
              <span className="flex items-center gap-1 text-sm text-gray-600"><MessageSquare className="h-4 w-4" aria-hidden="true" />0</span>
            </div>
            {m.location || m.date ? (
              <div className="flex min-w-0 items-center gap-3 text-sm text-gray-600">
                {m.location ? <span className="flex min-w-0 items-center gap-1"><MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" /><span className="truncate">{m.location}</span></span> : null}
                {m.date ? <span className="flex flex-shrink-0 items-center gap-1"><Calendar className="h-4 w-4" aria-hidden="true" />{m.date}</span> : null}
              </div>
            ) : null}
            <p className="text-sm text-gray-700">Add content here</p>
          </div>
        </div>
        <p className="py-5 text-center text-sm text-gray-400">Powered by <span className="font-semibold text-[#6C60FF]">Stasht</span></p>
      </div>
    </div>
  );
}
