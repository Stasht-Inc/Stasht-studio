import { useEffect, useMemo, useState } from "react";
import { Folder, FolderOpen, ChevronRight, ChevronDown, Search, Store } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import ImageHoverPopover from "./ImageHoverPopover";
import CatalogItemDetailModal from "./CatalogItemDetailModal";
import { loadCatalogueForBrowsing, type CatalogueItemSummary } from "../services/catalogueAPI";
import { WEBSITE_CATALOG_COLOR } from "../utils/categoryColorManager";
import { runWhenIdle } from "../utils/deferIdle";

// One of the website's own categories, built client-side from the flat item list.
interface ItemGroup {
  name: string;
  items: CatalogueItemSummary[];
}

const OTHER_GROUP = "Other";

// Groups items by the site's category (alphabetical); items without one go last, under "Other".
function groupByCategory(items: CatalogueItemSummary[]): ItemGroup[] {
  const groups = new Map<string, CatalogueItemSummary[]>();
  items.forEach((item) => {
    const key = item.category?.trim() || OTHER_GROUP;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === OTHER_GROUP ? 1 : b === OTHER_GROUP ? -1 : a.localeCompare(b)))
    .map(([name, groupItems]) => ({ name, items: groupItems }));
}

function matchesSearch(item: CatalogueItemSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.title, item.category, item.price_label].some((value) => (value || "").toLowerCase().includes(q));
}

// One item row (leaf): opens the item's detail view.
function ItemLeaf({ item, onOpen }: { item: CatalogueItemSummary; onOpen: (id: number) => void }) {
  const thumbFallback = (
    <span className="w-full h-full bg-gray-200 flex items-center justify-center">
      <Store className="w-3 h-3 text-gray-400" aria-hidden="true" />
    </span>
  );

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="ml-6 flex items-center gap-2 p-2 rounded-lg text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
      style={{ width: "calc(100% - 1.5rem)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${WEBSITE_CATALOG_COLOR}1A`; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
    >
      <span className="w-4 h-4 flex items-center justify-center flex-shrink-0" aria-hidden="true">
        <span className="w-3 h-0.5 bg-gray-300 rounded" />
      </span>

      {item.main_image ? (
        <ImageHoverPopover src={item.main_image} alt={item.title}>
          <span className="block w-8 h-8 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
            <ImageWithFallback src={item.main_image} alt={item.title} className="w-full h-full object-cover" fallback={thumbFallback} />
          </span>
        </ImageHoverPopover>
      ) : (
        <span className="flex w-8 h-8 rounded-md overflow-hidden flex-shrink-0">{thumbFallback}</span>
      )}

      <span className="flex-1 min-w-0">
        <span className="block text-sm text-gray-700 truncate font-medium">{item.title}</span>
        {item.price_label && (
          <span className="block text-xs font-semibold" style={{ color: WEBSITE_CATALOG_COLOR }}>{item.price_label}</span>
        )}
      </span>
    </button>
  );
}

// One category group: expands to its items (always open while searching).
// Expansion is tracked by the parent (keyed on group name), not local state here — a search that
// momentarily filters a group out of the list (no matches) unmounts this component, which would
// otherwise forget the user manually expanded it once the search is cleared.
function GroupNode({
  group,
  expanded,
  forceOpen,
  onToggle,
  onOpen,
}: {
  group: ItemGroup;
  expanded: boolean;
  forceOpen: boolean;
  onToggle: (name: string) => void;
  onOpen: (id: number) => void;
}) {
  const open = expanded || forceOpen;
  const coverThumb = group.items.find((i) => i.main_image)?.main_image || "";
  const coverFallback = (
    <span className="w-full h-full bg-gray-200 flex items-center justify-center">
      <Store className="w-4 h-4 text-gray-400" aria-hidden="true" />
    </span>
  );

  return (
    <div>
      <div className="flex items-center gap-2 p-2 rounded-lg transition-all duration-200">
        <button
          type="button"
          onClick={() => onToggle(group.name)}
          className="w-4 h-4 flex items-center justify-center text-gray-500 transition-colors rounded hover:bg-gray-100"
          aria-label={`${open ? "Collapse" : "Expand"} ${group.name}`}
          aria-expanded={open}
        >
          {open
            ? <ChevronDown className="w-3 h-3" style={{ color: WEBSITE_CATALOG_COLOR }} />
            : <ChevronRight className="w-3 h-3" />}
        </button>

        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
          {coverThumb
            ? <ImageWithFallback src={coverThumb} alt={group.name} className="w-full h-full object-cover" fallback={coverFallback} />
            : coverFallback}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 line-clamp-2" title={group.name}>{group.name}</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
              <div className="text-gray-600 text-xs font-medium">
                {group.items.length} item{group.items.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-1 space-y-1">
          {group.items.map((item) => (
            <ItemLeaf key={item.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

// Self-contained "Website Catalogue" box for the memories-page sidebar, built like CarsCatalogNav:
// the connected website's items grouped by the site's own categories, a search box, hover
// previews and a detail view per item. Browse-only. Renders nothing unless the account can use
// the catalogue and has items (loadCatalogueForBrowsing asks GET /website-catalogue first, so
// other accounts never call the Business-only items route — and never see the upgrade modal).
export default function WebsiteCatalogNav() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogueItemSummary[]>([]);
  const [boxExpanded, setBoxExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    // Off the initial-load critical path, like the other sidebar extras (utils/deferIdle.ts).
    const cancelIdle = runWhenIdle(() => {
      loadCatalogueForBrowsing().then((list) => {
        if (cancelled) return;
        setItems(list);
        if (list.length > 0) setBoxExpanded(true);
        setLoading(false);
      });
    });
    return () => { cancelled = true; cancelIdle(); };
  }, []);

  const searching = query.trim() !== "";
  const groups = useMemo(() => groupByCategory(items.filter((item) => matchesSearch(item, query))), [items, query]);

  if (loading || items.length === 0) return null;

  return (
    <>
      <div className="w-full rounded-lg transition-all duration-200" style={{ backgroundColor: `${WEBSITE_CATALOG_COLOR}1A` }}>
        <button
          type="button"
          onClick={() => setBoxExpanded((v) => !v)}
          aria-expanded={boxExpanded}
          className="w-full p-3 flex items-center justify-between rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
          onMouseEnter={(e) => { if (!boxExpanded) e.currentTarget.style.backgroundColor = `${WEBSITE_CATALOG_COLOR}26`; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <ChevronRight
              className={`w-3 h-3 transition-all duration-200 ${boxExpanded ? "rotate-90" : ""}`}
              style={{ color: boxExpanded ? WEBSITE_CATALOG_COLOR : "" }}
            />
            {boxExpanded
              ? <FolderOpen className="w-4 h-4" style={{ color: WEBSITE_CATALOG_COLOR }} />
              : <Folder className="w-4 h-4 text-muted-foreground" />}
            <span className={`text-sm ${boxExpanded ? "font-bold" : "font-medium"} text-foreground truncate`}>Website Catalogue</span>
          </span>
          <span
            className="text-xs px-2 py-1 rounded-full transition-all duration-200 text-black flex-shrink-0"
            style={{ backgroundColor: boxExpanded ? `${WEBSITE_CATALOG_COLOR}33` : "" }}
          >
            {items.length}
          </span>
        </button>

        {boxExpanded && (
          <div className="px-3 pb-3 pt-1">
            <label className="relative block mb-2">
              <span className="sr-only">Search your Website Catalogue</span>
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items"
                className="w-full h-9 pl-8 pr-2 rounded-md bg-white text-sm text-gray-700 placeholder:text-gray-500 border border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
              />
            </label>
            {groups.length === 0 ? (
              <p className="px-2 py-3 text-xs text-gray-500">No items match “{query.trim()}”.</p>
            ) : (
              <div className="space-y-1">
                {groups.map((group) => (
                  <GroupNode
                    key={group.name}
                    group={group}
                    expanded={expandedGroups.has(group.name)}
                    forceOpen={searching}
                    onToggle={toggleGroup}
                    onOpen={setOpenItemId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CatalogItemDetailModal itemId={openItemId} onClose={() => setOpenItemId(null)} />
    </>
  );
}
