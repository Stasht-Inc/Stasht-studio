import { useState, useEffect } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, ShoppingBag, Loader2, Package } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import ImageHoverPopover from "./ImageHoverPopover";
import { dashboardAPI } from "../utils/authUtils";
import { SHOPIFY_COLOR } from "../utils/categoryColorManager";

// A single product as returned by GET /shopify/catalog. We only read the fields we render.
interface CatalogProduct {
  id: number | string;
  title: string;
  image?: string | null;
  images?: string[];
  price?: string;
  currency?: string;
}

// A collection groups products. `id` can be null for the "Uncategorized" bucket.
interface CatalogCollection {
  id: string | null;
  title: string;
  products_count: number;
  products: CatalogProduct[];
}

function formatPrice(price?: string, currency?: string): string {
  if (!price) return "";
  const cur = currency || "";
  return cur ? `${cur} ${price}` : price;
}

// One product row (the "moment" leaf) — read-only, no click action for now.
function ProductLeaf({ product }: { product: CatalogProduct }) {
  const thumb = product.image || product.images?.[0] || "";
  const price = formatPrice(product.price, product.currency);

  return (
    <div
      className="ml-6 flex items-center gap-2 p-2 rounded-lg transition-all duration-200"
      style={{ width: "calc(100% - 1.5rem)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${SHOPIFY_COLOR}1A`; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
    >
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-0.5 bg-gray-300 rounded" />
      </div>

      {thumb ? (
        <ImageHoverPopover src={thumb} alt={product.title}>
          <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
            <ImageWithFallback
              src={thumb}
              alt={product.title}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <Package className="w-3 h-3 text-gray-400" />
                </div>
              }
            />
          </div>
        </ImageHoverPopover>
      ) : (
        <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
          <Package className="w-3 h-3 text-gray-400" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate font-medium">{product.title}</p>
        {price && (
          <p className="text-xs font-semibold" style={{ color: SHOPIFY_COLOR }}>{price}</p>
        )}
      </div>
    </div>
  );
}

// One collection node (the "campaign" — like a memory). Clicking it opens the collection
// detail page (memory-detail layout). The chevron still expands an inline product preview.
function CollectionNode({
  collection,
  onSelect,
}: {
  collection: CatalogCollection;
  onSelect?: (collectionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasProducts = collection.products && collection.products.length > 0;
  const coverThumb = collection.products?.[0]?.image || collection.products?.[0]?.images?.[0] || "";
  // Uncategorized bucket has a null id → not navigable, only inline-expandable.
  const canOpen = collection.id != null && !!onSelect;

  const openDetail = () => {
    if (canOpen) onSelect!(String(collection.id));
  };

  return (
    <div>
      <div className="flex items-center gap-2 p-2 rounded-lg transition-all duration-200">
        <button
          onClick={(e) => { e.stopPropagation(); hasProducts && setExpanded((v) => !v); }}
          className={`w-4 h-4 flex items-center justify-center text-gray-500 transition-colors rounded hover:bg-gray-100 ${hasProducts ? "" : "invisible"}`}
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded
            ? <ChevronDown className="w-3 h-3" style={{ color: SHOPIFY_COLOR }} />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        {coverThumb ? (
          <ImageHoverPopover src={coverThumb} alt={collection.title}>
            <div
              className={`w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0 ${canOpen ? "cursor-pointer" : ""}`}
              onClick={openDetail}
            >
              <ImageWithFallback
                src={coverThumb}
                alt={collection.title}
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                  </div>
                }
              />
            </div>
          </ImageHoverPopover>
        ) : (
          <div
            className={`w-10 h-10 rounded-md overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 ${canOpen ? "cursor-pointer" : ""}`}
            onClick={openDetail}
          >
            <ShoppingBag className="w-4 h-4 text-gray-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <button
            onClick={openDetail}
            disabled={!canOpen}
            className="text-sm font-medium text-gray-900 line-clamp-2 w-full text-left transition-all duration-200"
            onMouseEnter={(e) => { if (canOpen) e.currentTarget.style.color = SHOPIFY_COLOR; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = ""; }}
            title={collection.title}
          >
            {collection.title}
          </button>
          <div className="flex items-center gap-2 mt-1">
            <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
              <div className="text-gray-600 text-[10px] font-medium">
                {collection.products_count} item{collection.products_count !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {hasProducts && expanded && (
        <div className="mt-1 space-y-1">
          {collection.products.map((product) => (
            <ProductLeaf key={String(product.id)} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

// Self-contained "Shopify" category box for the memories-page sidebar (desktop, expanded mode).
// - Only renders when a Shopify store is connected.
// - Read-only: no add-campaign / edit / delete.
// - Clicking a collection opens it in the memory-detail page layout via onCollectionSelect.
export default function ShopifyCatalogNav({
  onCollectionSelect,
}: {
  onCollectionSelect?: (collectionId: string) => void;
} = {}) {
  const [connected, setConnected] = useState<boolean | null>(null); // null = still checking
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  const [boxExpanded, setBoxExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await dashboardAPI.shopifyGetStatus();
        const isConnected = !!(status.success && status.data?.connected);
        if (cancelled) return;
        setConnected(isConnected);
        if (!isConnected) return;

        setLoading(true);
        const res = await dashboardAPI.shopifyGetCatalog();
        if (cancelled) return;
        if (res.success && res.data?.collections) {
          setCollections(res.data.collections);
          // Match user categories: a box with content opens itself, an empty one stays shut.
          if (res.data.collections.length > 0) setBoxExpanded(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Requirement: box appears only when Shopify is connected.
  if (connected !== true) return null;

  const collectionCount = collections.length;

  return (
    <div
      className="w-full rounded-lg transition-all duration-200 cursor-pointer"
      style={{ backgroundColor: `${SHOPIFY_COLOR}1A` }}
      onMouseEnter={(e) => { if (!boxExpanded) e.currentTarget.style.backgroundColor = `${SHOPIFY_COLOR}26`; }}
      onMouseLeave={(e) => { if (!boxExpanded) e.currentTarget.style.backgroundColor = `${SHOPIFY_COLOR}1A`; }}
      onClick={() => setBoxExpanded((v) => !v)}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight
              className={`w-3 h-3 transition-all duration-200 ${boxExpanded ? "rotate-90" : ""}`}
              style={{ color: boxExpanded ? SHOPIFY_COLOR : "" }}
            />
            {boxExpanded
              ? <FolderOpen className="w-4 h-4" style={{ color: SHOPIFY_COLOR }} />
              : <Folder className="w-4 h-4 text-muted-foreground" />}
            <span className={`text-sm ${boxExpanded ? "font-bold" : "font-medium"} text-foreground`}>Shopify</span>
          </div>
          <span
            className="text-xs px-2 py-1 rounded-full transition-all duration-200 text-black flex-shrink-0"
            style={{ backgroundColor: boxExpanded ? `${SHOPIFY_COLOR}33` : "" }}
          >
            {collectionCount}
          </span>
        </div>
      </div>

      {boxExpanded && (
        <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: SHOPIFY_COLOR }} />
            </div>
          ) : collectionCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: `${SHOPIFY_COLOR}33` }}
              >
                <ShoppingBag className="w-5 h-5" style={{ color: SHOPIFY_COLOR }} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                No Shopify products found. Sync your store to see products here.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {collections.map((collection, idx) => (
                <CollectionNode
                  key={collection.id ?? `uncategorized-${idx}`}
                  collection={collection}
                  onSelect={onCollectionSelect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
