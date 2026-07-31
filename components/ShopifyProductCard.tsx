import { useState } from "react";
import { ShoppingCart, ShoppingBag } from "lucide-react";
import { MockPost } from "../data/mockPosts";
import {
  sanitizeRichText,
  stripHtml,
  getVariantOptions,
  formatShopifyPrice,
} from "../utils/shopifyProduct";

// A dedicated e-commerce-style card for Shopify collection products rendered inside the
// memory-detail timeline. Shows the product image with floating category + price badges,
// a rich-text description, selectable variant chips, and an "Add to Cart" CTA that
// deep-links to the product (and the chosen variant) on the connected Shopify store.
interface ShopifyProductCardProps {
  post: MockPost;
  onImageClick?: (src: string, alt: string, title?: string, subtitle?: string, imageId?: string) => void;
}

const MAX_VISIBLE_VARIANTS = 3;

export default function ShopifyProductCard({ post, onImageClick }: ShopifyProductCardProps) {
  const options = getVariantOptions(post.variants);
  const [selectedVariantId, setSelectedVariantId] = useState<string | number | null>(null);

  const priceLabel = formatShopifyPrice(post.price, post.currency);
  const compareLabel = formatShopifyPrice(post.compare_at_price, post.currency);
  const hasCompare = !!compareLabel && compareLabel !== priceLabel;
  const description = sanitizeRichText(post.content || "");

  const visibleOptions = options.slice(0, MAX_VISIBLE_VARIANTS);
  const overflowCount = options.length - visibleOptions.length;

  const baseUrl = post.product_url
    || (post.shop_domain && post.handle ? `https://${post.shop_domain}/products/${post.handle}` : "");
  const buyUrl = baseUrl
    ? (selectedVariantId ? `${baseUrl}?variant=${selectedVariantId}` : baseUrl)
    : "";

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      {/* Image with floating badges */}
      <div className="relative aspect-square bg-gray-100">
        {post.image ? (
          <img
            src={post.image}
            alt={post.title || "Product"}
            className={`w-full h-full object-cover ${onImageClick ? "cursor-pointer" : ""}`}
            onClick={() => onImageClick?.(post.image as string, post.title || "Product", post.title || "", stripHtml(post.content), String(post.id))}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-gray-300" />
          </div>
        )}

        {/* Category badge (top-left) */}
        {post.category && (
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#FF60E0] text-white text-xs font-semibold shadow-sm">
            {post.category}
          </span>
        )}

        {/* Price badge (top-right) */}
        {priceLabel && (
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            <span className="px-3 py-1 rounded-full bg-[#FBBF24] text-[#1F2937] text-sm font-bold shadow-sm">
              {priceLabel}
            </span>
            {hasCompare && (
              <span className="px-2 py-0.5 rounded-full bg-white/90 text-gray-400 text-[11px] font-medium line-through shadow-sm">
                {compareLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {post.title && (
          <h3 className="text-lg font-bold text-gray-900 break-words leading-snug">{post.title}</h3>
        )}

        {description.trim() && (
          <p
            className="text-sm text-gray-600 whitespace-pre-line line-clamp-3"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}

        {/* Variant chips (selectable) + overflow */}
        {options.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {visibleOptions.map((opt, i) => {
              const isSelected = selectedVariantId !== null && selectedVariantId === opt.id;
              return (
                <button
                  key={`${opt.label}-${i}`}
                  type="button"
                  onClick={() => setSelectedVariantId((prev) => (prev === opt.id ? null : opt.id))}
                  className={`min-w-[2.25rem] px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-[#6C60FF] text-white border border-[#6C60FF]"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-[#6C60FF]/50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {overflowCount > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                +{overflowCount}
              </span>
            )}
          </div>
        )}

        {/* CTA */}
        <a
          href={buyUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (!buyUrl) e.preventDefault(); }}
          className={`mt-1 inline-flex w-full items-center justify-center gap-2 px-6 py-3 font-semibold text-white rounded-xl transition-opacity no-underline ${
            buyUrl ? "bg-[#111827] hover:opacity-90" : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          <ShoppingCart className="w-[18px] h-[18px]" />
          <span>Add to Cart</span>
        </a>
      </div>
    </div>
  );
}
