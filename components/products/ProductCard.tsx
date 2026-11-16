// components/products/ProductCard.tsx — one Products grid card (spec: main photo, title, price + sale price, status and
// source badges). Card look follows MemoryCard / WebsiteCatalogNav (rounded-xl, gray-200 border, #6C60FF accents).
import { Package } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import type { ProductSummary } from '../../services/productsAPI';
import { BADGE_CLASS, BADGE_LABEL, cardCategories, priceLine, productCategoryColor, sourceLabel } from '../../utils/products';
import { WEBSITE_CATALOG_COLOR } from '../../utils/categoryColorManager';

export default function ProductCard({ product, selectable, selected, onToggle, onOpen, websiteCategoryIds }: {
  /** The account's website categories (teal pills). */
  websiteCategoryIds?: ReadonlySet<number>;
  product: ProductSummary;
  selectable: boolean;
  selected: boolean;
  onToggle(): void;
  onOpen(): void;
}) {
  const price = priceLine(product);
  const cats = cardCategories(product);
  return (
    <div data-testid="product-card" className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${selected ? 'border-[#6C60FF] ring-2 ring-[#6C60FF]/30' : 'border-gray-200'}`}>
      <button type="button" onClick={onOpen} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6C60FF]">
        <div className="relative aspect-square bg-gray-100">
          {product.main_image ? (
            <ImageWithFallback src={product.main_image} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center"><Package className="h-10 w-10 text-gray-300" aria-hidden="true" /></div>
          )}
          {/* C6: the category pill as campaign cards draw it (MemoryCard categoryPill: the category's colour, white
              semibold text, 8px corners, shadow); the first category plus "+N" for the rest. */}
          {cats.first && (
            <span data-testid="product-card-category" className="absolute bottom-2 left-2 right-2 flex min-w-0 items-center gap-1">
              <span className="truncate rounded-lg px-2.5 py-1 text-sm font-semibold leading-5 text-white shadow-lg" style={{ backgroundColor: productCategoryColor(cats.firstId, Boolean(cats.firstId !== null && websiteCategoryIds?.has(cats.firstId))) }}>{cats.first}</span>
              {cats.more > 0 && <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-sm font-semibold leading-5 text-gray-700 shadow-md" aria-label={`and ${cats.more} more ${cats.more === 1 ? 'category' : 'categories'}`}>+{cats.more}</span>}
            </span>
          )}
          {/* Status over source, stacked, so the two never collide on a narrow card; the checkbox sits top-right. */}
          <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${BADGE_CLASS[product.badge]}`}>{BADGE_LABEL[product.badge]}</span>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: product.origin === 'website' ? WEBSITE_CATALOG_COLOR : '#6C60FF' }}>
              {sourceLabel(product)}
            </span>
          </span>
        </div>
        <div className="space-y-1 p-3">
          <p className="line-clamp-2 text-sm font-semibold text-gray-900">{product.title}</p>
          {price.main && (
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className={product.price_on_request || !product.show_price ? 'text-gray-500' : 'font-semibold text-gray-900'}>{price.main}</span>
              {price.was && <span className="text-xs text-gray-400 line-through">{price.was}</span>}
            </p>
          )}
          {product.read_only && product.owner?.name && <p className="text-xs text-gray-500">Shared by {product.owner.name}</p>}
        </div>
      </button>
      {selectable && (
        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow-sm">
          <input type="checkbox" aria-label={`Select ${product.title}`} checked={selected} onChange={onToggle} className="h-4 w-4 accent-[#6C60FF]" />
        </span>
      )}
    </div>
  );
}
