import { MessageSquare } from 'lucide-react';
import { Badge } from './ui/badge';

/**
 * Chris 21 Nov 2026 (P3): the pieces a product moment's card shares between the Storeel preview and the published
 * campaign page the recipient opens, so both look the same:
 * - the price as a BADGE — the product page's yellow price pill (MemoryDetailsPage: bg #FEC53D, "$65 CAD");
 * - the "Enquire" button (Chris 16 Nov 2026: a product with "Show the Enquire button" on), as the published page drew it.
 * The buy button is ProductCardButton (the product page's ProductBuyButton is that same button).
 */
export function ProductPriceBadge({ price, className = '' }: { price: string; className?: string }) {
  if (!price.trim()) return null;
  return (
    <Badge data-testid="product-price-badge" className={`bg-[#FEC53D] text-[#364153] border-0 px-3 py-1.5 text-sm rounded-2xl ${className}`}>{price}</Badge>
  );
}

export function ProductEnquireButton({ onClick, postId, className = 'mt-3' }: { onClick?: () => void; postId?: string; className?: string }) {
  return (
    <button
      type="button"
      data-enquire-post={postId}
      data-testid="product-enquire-button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#6C60FF] bg-white px-6 py-2.5 text-base font-semibold text-[#6C60FF] transition-colors hover:bg-[#6C60FF]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 ${className}`}
    >
      <MessageSquare className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
      Enquire
    </button>
  );
}
