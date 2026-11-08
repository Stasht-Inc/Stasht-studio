import { Play, Pointer, ShoppingCart, Upload } from 'lucide-react';
import type { PreviewWidget } from './lib/storeelWidgets';

/**
 * A saved campaign's widget in the Storeel preview (Chris, 8 Nov 2026, point 1), drawn like the campaign page's
 * timeline card: Call to Action / Share Request a Moment (title + the styled button), HTML, YouTube, Quote, AI Creator,
 * Shopify product. Display only — they are edited on the campaign page, as before.
 */
export default function PreviewWidgetCard({ widget }: { widget: PreviewWidget }) {
  const card = 'overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900';
  switch (widget.type) {
    case 'cta': {
      const request = widget.mode === 'request_moment';
      const Icon = request ? Upload : Pointer;
      return (
        <div className={`${card} flex flex-col items-center gap-3 p-5 text-center`} data-preview-widget="cta">
          {widget.title ? <p className="line-clamp-2 break-words text-[19px] font-bold">{widget.title}</p> : null}
          <span className="inline-flex max-w-full items-center justify-center gap-2 px-6 py-3 text-[15px] font-semibold"
            style={{ backgroundColor: widget.buttonColor || '#6C60FF', color: widget.textColor || '#FFFFFF', borderRadius: widget.borderRadius ?? 12 }}>
            <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{widget.buttonText || (request ? 'Share a Moment' : 'Learn More')}</span>
          </span>
        </div>
      );
    }
    case 'html':
      return (
        <div className={`${card} p-5`} data-preview-widget="html">
          {widget.title ? <p className="mb-2 break-words text-[18px] font-bold">{widget.title}</p> : null}
          {/* The owner's own HTML, shown as the campaign page shows it. */}
          <div className="max-h-[320px] overflow-hidden break-words text-[14.5px] leading-[21px] text-[#364153] [&_a]:text-[#6C60FF] [&_a]:underline [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: widget.content || '' }} />
        </div>
      );
    case 'youtube':
      return (
        <div className={card} data-preview-widget="youtube">
          <div className="relative aspect-video bg-black">
            {widget.videoId ? <img src={`https://i.ytimg.com/vi/${encodeURIComponent(widget.videoId)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" /> : null}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF0000]/90"><Play className="ml-1 h-6 w-6 text-white" aria-hidden="true" /></span>
            </span>
          </div>
          {widget.title ? <p className="line-clamp-2 break-words px-5 py-4 text-[16px] font-semibold">{widget.title}</p> : null}
        </div>
      );
    case 'quote':
      return (
        <div className={`${card} p-5`} data-preview-widget="quote">
          <p className="text-[40px] font-serif leading-none text-[#F59E0B]" aria-hidden="true">“</p>
          <p className="-mt-2 whitespace-pre-line break-words text-[17px] italic leading-[25px] text-gray-800">{widget.text}</p>
          {widget.author ? <p className="mt-3 text-[14px] font-medium text-gray-500">— {widget.author}</p> : null}
        </div>
      );
    case 'ai_creator':
      return (
        <div className="relative overflow-hidden rounded-2xl p-6 text-white" data-preview-widget="ai_creator"
          style={{ background: widget.imageUrl ? `center / cover no-repeat url("${widget.imageUrl}")` : (widget.background || 'linear-gradient(135deg, #6C60FF 0%, #F6339A 100%)') }}>
          {widget.imageUrl ? <div className="absolute inset-0 bg-black/35" aria-hidden="true" /> : null}
          <p className="relative whitespace-pre-line break-words text-[18px] font-semibold leading-[26px]">{widget.text}</p>
        </div>
      );
    case 'product':
      return (
        <div className={card} data-preview-widget="product">
          {widget.image ? <img src={widget.image} alt="" className="aspect-square w-full bg-gray-100 object-cover" /> : null}
          <div className="space-y-2 p-4">
            {widget.title ? <p className="break-words text-[18px] font-bold">{widget.title}</p> : null}
            {widget.price ? <p className="text-[16px] font-semibold text-[#6C60FF]">{widget.price}</p> : null}
            <span className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C60FF] px-6 py-3 text-[15px] font-semibold text-white">
              <ShoppingCart className="h-[18px] w-[18px]" aria-hidden="true" />Buy Now
            </span>
          </div>
        </div>
      );
    default:
      return null;
  }
}
