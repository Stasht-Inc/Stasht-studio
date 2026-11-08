import { Play, Pointer, ShoppingCart, Upload } from 'lucide-react';
import { sanitizeAiCreatorText } from '../../utils/memoryUtils';
import type { PreviewWidget } from './lib/storeelWidgets';

/**
 * A saved campaign's widget in the Storeel preview (Chris, 8 Nov 2026, point 1), drawn like the campaign page's
 * timeline card (pages/MemoryDetailsPage.tsx: CTAWidgetCard, the HTML / YouTube / Quote cards, renderAiCreatorWidgets,
 * ProductWidgetCard). Display only — they are edited on the campaign page, as before. YouTube shows its thumbnail
 * (the page embeds the player; a player inside the scaled phone would be heavy and can't be tapped through anyway).
 */
/** The campaign page's quote marks (its Quote card). */
function QuoteMark({ className }: { className: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"><path d="M10.6668 2C10.3132 2 9.97407 2.14048 9.72402 2.39052C9.47397 2.64057 9.3335 2.97971 9.3335 3.33333V7.33333C9.3335 7.68696 9.47397 8.02609 9.72402 8.27614C9.97407 8.52619 10.3132 8.66667 10.6668 8.66667C10.8436 8.66667 11.0132 8.7369 11.1382 8.86193C11.2633 8.98695 11.3335 9.15652 11.3335 9.33333V10C11.3335 10.3536 11.193 10.6928 10.943 10.9428C10.6929 11.1929 10.3538 11.3333 10.0002 11.3333C9.82335 11.3333 9.65378 11.4036 9.52876 11.5286C9.40373 11.6536 9.3335 11.8232 9.3335 12V13.3333C9.3335 13.5101 9.40373 13.6797 9.52876 13.8047C9.65378 13.9298 9.82335 14 10.0002 14C11.061 14 12.0784 13.5786 12.8286 12.8284C13.5787 12.0783 14.0002 11.0609 14.0002 10V3.33333C14.0002 2.97971 13.8597 2.64057 13.6096 2.39052C13.3596 2.14048 13.0205 2 12.6668 2H10.6668Z" fill="currentColor"/><path d="M3.33333 2C2.97971 2 2.64057 2.14048 2.39052 2.39052C2.14048 2.64057 2 2.97971 2 3.33333V7.33333C2 7.68696 2.14048 8.02609 2.39052 8.27614C2.64057 8.52619 2.97971 8.66667 3.33333 8.66667C3.51014 8.66667 3.67971 8.7369 3.80474 8.86193C3.92976 8.98695 4 9.15652 4 9.33333V10C4 10.3536 3.85952 10.6928 3.60948 10.9428C3.35943 11.1929 3.02029 11.3333 2.66667 11.3333C2.48986 11.3333 2.32029 11.4036 2.19526 11.5286C2.07024 11.6536 2 11.8232 2 12V13.3333C2 13.5101 2.07024 13.6797 2.19526 13.8047C2.32029 13.9298 2.48986 14 2.66667 14C3.72753 14 4.74495 13.5786 5.49509 12.8284C6.24524 12.0783 6.66667 11.0609 6.66667 10V3.33333C6.66667 2.97971 6.52619 2.64057 6.27614 2.39052C6.02609 2.14048 5.68696 2 5.33333 2H3.33333Z" fill="currentColor"/></svg>
  );
}

export default function PreviewWidgetCard({ widget }: { widget: PreviewWidget }) {
  switch (widget.type) {
    case 'cta': {
      const request = widget.mode === 'request_moment';
      const Icon = request ? Upload : Pointer;
      return (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 text-center" data-preview-widget="cta">
          {widget.title ? <h3 className="break-words text-xl font-bold text-gray-900">{widget.title}</h3> : null}
          <span className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold"
            style={{
              backgroundColor: widget.buttonColor || '#6C60FF', color: widget.textColor || '#FFFFFF', fontSize: widget.fontSize || 16,
              borderRadius: widget.borderRadius ?? 12, width: widget.buttonWidth ? `${widget.buttonWidth}px` : '100%', maxWidth: '100%',
            }}>
            <Icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{widget.buttonText || (request ? 'Share a Moment' : 'Learn More')}</span>
          </span>
        </div>
      );
    }
    case 'html':
      return (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-4" data-preview-widget="html">
          {/* The owner's own HTML, shown as the campaign page shows it. */}
          <div className="max-h-[420px] overflow-hidden break-words [&_a]:text-[#6C60FF] [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-bold [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: widget.content || '' }} />
        </div>
      );
    case 'youtube':
      return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4" data-preview-widget="youtube">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            {widget.videoId ? <img src={`https://i.ytimg.com/vi/${encodeURIComponent(widget.videoId)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" /> : null}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-[#FF0000]/90"><Play className="ml-0.5 h-6 w-6 fill-white text-white" aria-hidden="true" /></span>
            </span>
          </div>
        </div>
      );
    case 'quote':
      return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 border-l-4 border-l-[#6C60FF] bg-[#F0EEFF] p-6" data-preview-widget="quote">
          <QuoteMark className="absolute left-4 top-4 text-[#6C60FF]/30" />
          <p className="mt-4 overflow-hidden break-words text-center text-xl font-bold leading-relaxed text-gray-800">{widget.text}</p>
          {widget.author ? <p className="mt-3 text-center text-sm text-gray-500">— {widget.author}</p> : null}
          <QuoteMark className="absolute bottom-4 right-4 rotate-180 text-[#6C60FF]/30" />
        </div>
      );
    case 'ai_creator':
      return (
        <div className="relative flex min-h-[160px] w-full items-center justify-center overflow-hidden rounded-2xl bg-cover bg-center p-6" data-preview-widget="ai_creator"
          style={widget.imageUrl ? { backgroundImage: `url(${JSON.stringify(widget.imageUrl)})` } : { background: widget.background || 'linear-gradient(135deg, #6C60FF 0%, #F6339A 100%)' }}>
          {widget.imageUrl ? <div className="absolute inset-0" style={{ background: widget.isDark === false ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }} aria-hidden="true" /> : null}
          {/* Rich text, sanitised exactly as the campaign page does (review M1). */}
          <p className={`relative break-words text-center font-semibold ${widget.imageUrl && widget.isDark === false ? 'text-gray-900' : 'text-white'}`}
            dangerouslySetInnerHTML={{ __html: sanitizeAiCreatorText(widget.text) }} />
        </div>
      );
    case 'product':
      return (
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white" data-preview-widget="product">
          {widget.image ? <div className="aspect-square bg-gray-100"><img src={widget.image} alt="" className="h-full w-full object-cover" /></div> : null}
          <div className="space-y-2 p-4">
            {widget.title ? <h3 className="break-words text-lg font-bold text-gray-900">{widget.title}</h3> : null}
            {widget.price ? <p className="text-base font-semibold text-[#6C60FF]">{widget.price}</p> : null}
            <span className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6C60FF] px-6 py-3 font-semibold text-white">
              <ShoppingCart className="h-[18px] w-[18px]" aria-hidden="true" />Buy Now
            </span>
          </div>
        </div>
      );
    default:
      return null;
  }
}
