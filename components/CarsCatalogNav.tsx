import { useState, useEffect } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Car as CarIcon } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import ImageHoverPopover from "./ImageHoverPopover";
import { dashboardAPI } from "../utils/authUtils";
import { CARS_COLOR } from "../utils/categoryColorManager";

// A single listing as returned by GET /cars. We only read the fields we render.
interface CarListing {
  id: number | string;
  title: string;
  category?: string; // e.g. "preowned" | "hybrid" — the grouping key
  price?: string | number | null;
  main_image?: string | null;
  listing_url?: string;
}

// One category group ("preowned"/"hybrid") built client-side from the flat /cars list.
interface CarGroup {
  name: string; // display label, e.g. "Preowned"
  cars: CarListing[];
}

function formatPrice(price?: string | number | null): string {
  if (price === null || price === undefined || price === "") return "";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (!Number.isFinite(num)) return "";
  return `$${num.toLocaleString()}`;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Groups a flat car list by its `category` field. Cars without a category fall into "Other".
function groupByCategory(cars: CarListing[]): CarGroup[] {
  const groups = new Map<string, CarListing[]>();
  cars.forEach((car) => {
    const key = car.category ? titleCase(car.category) : "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(car);
  });
  return Array.from(groups.entries()).map(([name, groupCars]) => ({ name, cars: groupCars }));
}

// One car row (leaf) — read-only, opens the source listing in a new tab.
function CarLeaf({ car }: { car: CarListing }) {
  const price = formatPrice(car.price);

  return (
    <a
      href={car.listing_url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-6 flex items-center gap-2 p-2 rounded-lg transition-all duration-200"
      style={{ width: "calc(100% - 1.5rem)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${CARS_COLOR}1A`; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
    >
      <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-0.5 bg-gray-300 rounded" />
      </div>

      {car.main_image ? (
        <ImageHoverPopover src={car.main_image} alt={car.title}>
          <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
            <ImageWithFallback
              src={car.main_image}
              alt={car.title}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <CarIcon className="w-3 h-3 text-gray-400" />
                </div>
              }
            />
          </div>
        </ImageHoverPopover>
      ) : (
        <div className="w-8 h-8 rounded-md overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
          <CarIcon className="w-3 h-3 text-gray-400" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate font-medium">{car.title}</p>
        {price && (
          <p className="text-xs font-semibold" style={{ color: CARS_COLOR }}>{price}</p>
        )}
      </div>
    </a>
  );
}

// One category group node (e.g. "Preowned" / "Hybrid") — expands to its cars.
function CarGroupNode({ group }: { group: CarGroup }) {
  const [expanded, setExpanded] = useState(false);
  const coverThumb = group.cars.find((c) => c.main_image)?.main_image || "";

  return (
    <div>
      <div className="flex items-center gap-2 p-2 rounded-lg transition-all duration-200">
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
          className="w-4 h-4 flex items-center justify-center text-gray-500 transition-colors rounded hover:bg-gray-100"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded
            ? <ChevronDown className="w-3 h-3" style={{ color: CARS_COLOR }} />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        {coverThumb ? (
          <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
            <ImageWithFallback
              src={coverThumb}
              alt={group.name}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <CarIcon className="w-4 h-4 text-gray-400" />
                </div>
              }
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
            <CarIcon className="w-4 h-4 text-gray-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 line-clamp-2" title={group.name}>
            {group.name}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
              <div className="text-gray-600 text-[10px] font-medium">
                {group.cars.length} item{group.cars.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-1 space-y-1">
          {group.cars.map((car) => (
            <CarLeaf key={String(car.id)} car={car} />
          ))}
        </div>
      )}
    </div>
  );
}

// Self-contained "Cars" category box for the memories-page sidebar (desktop, expanded mode).
// Mirrors ShopifyCatalogNav's box UI, but groups the flat /cars feed client-side by each
// car's `category` field (e.g. preowned/hybrid) instead of a backend-provided collection.
export default function CarsCatalogNav() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CarGroup[]>([]);
  const [boxExpanded, setBoxExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardAPI.carsGetCatalog();
        if (cancelled) return;
        const list: CarListing[] = res.data?.data?.cars || (res.data as any)?.cars || [];
        if (res.success && Array.isArray(list)) {
          const built = groupByCategory(list);
          setGroups(built);
          if (built.length > 0) setBoxExpanded(true);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalCount = groups.reduce((sum, g) => sum + g.cars.length, 0);

  // Nothing to show yet (still loading), the fetch failed, or there are no cars —
  // the box only ever appears when it actually has cars in it.
  if (failed || loading || totalCount === 0) return null;

  return (
    <div
      className="w-full rounded-lg transition-all duration-200 cursor-pointer"
      style={{ backgroundColor: `${CARS_COLOR}1A` }}
      onMouseEnter={(e) => { if (!boxExpanded) e.currentTarget.style.backgroundColor = `${CARS_COLOR}26`; }}
      onMouseLeave={(e) => { if (!boxExpanded) e.currentTarget.style.backgroundColor = `${CARS_COLOR}1A`; }}
      onClick={() => setBoxExpanded((v) => !v)}
    >
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <ChevronRight
              className={`w-3 h-3 transition-all duration-200 ${boxExpanded ? "rotate-90" : ""}`}
              style={{ color: boxExpanded ? CARS_COLOR : "" }}
            />
            {boxExpanded
              ? <FolderOpen className="w-4 h-4" style={{ color: CARS_COLOR }} />
              : <Folder className="w-4 h-4 text-muted-foreground" />}
            <span className={`text-sm ${boxExpanded ? "font-bold" : "font-medium"} text-foreground`}>Cars</span>
          </div>
          <span
            className="text-xs px-2 py-1 rounded-full transition-all duration-200 text-black flex-shrink-0"
            style={{ backgroundColor: boxExpanded ? `${CARS_COLOR}33` : "" }}
          >
            {totalCount}
          </span>
        </div>
      </div>

      {boxExpanded && (
        <div className="px-3 pb-3 pt-1" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1">
            {groups.map((group) => (
              <CarGroupNode key={group.name} group={group} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
