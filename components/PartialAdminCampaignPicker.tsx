import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, Search } from 'lucide-react';
import { dashboardAPI } from '../utils/authUtils';

/**
 * The Partial Admin "Select Campaigns" picker shared by Edit Role (Users tab) and Invite to Campaign.
 *
 * Chris 10 Nov 2026 (Royal Wood): the pickers read /existing-memories (first 20 only, no car/Shopify
 * campaigns) and only showed groups from /memory-images/categories, so a big account saw almost nothing.
 * Now: every campaign from GET /memories/campaign-picker, grouped by category (the account's categories
 * first, then any other category a campaign is in), searchable, and long groups render in pages so
 * hundreds of rows stay quick. Ticking nothing is allowed — a leads-only Partial Admin.
 */

export interface PickerCampaign {
  id: string;
  title: string;
  category: string;
  categoryColor?: string;
  thumbnail?: string | null;
  owned: boolean;
  imageCount: number;
}

export interface PickerCategory {
  name: string;
  color: string;
}

const PAGE = 50;

/** Every campaign the signed-in account can pick (all categories, published or not). */
export async function fetchPickerCampaigns(): Promise<PickerCampaign[]> {
  const res: any = await dashboardAPI.getCampaignPicker();
  const raw = res?.data?.data?.memories || res?.data?.memories || [];
  return (Array.isArray(raw) ? raw : []).map((m: any) => ({
    id: String(m.id),
    title: m.title || 'Untitled',
    category: m.category?.name || 'Uncategorized',
    categoryColor: m.category?.color || undefined,
    thumbnail: m.last_update_img || null,
    owned: m.owned !== false,
    imageCount: Number(m.photos_count || 0),
  }));
}

/** The account's categories (minus the virtual Shared With / Published groups), as the pickers always used. */
export async function fetchPickerCategories(): Promise<PickerCategory[]> {
  const res: any = await dashboardAPI.getUserCategories();
  const responseData = res?.data?.data || res?.data;
  const cats: any[] = responseData?.categories || responseData || [];
  return (Array.isArray(cats) ? cats : [])
    .filter((c: any) => {
      const name = c.name || c;
      return name && name !== 'Shared With' && name !== 'Published';
    })
    .map((c: any) => ({ name: c.name || c, color: c.color || '#6C60FF' }));
}

interface Props {
  campaigns: PickerCampaign[];
  categories: PickerCategory[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  renderThumb: (campaign: PickerCampaign) => React.ReactNode;
  loading?: boolean;
  maxHeightClass?: string;
}

export default function PartialAdminCampaignPicker({ campaigns, categories, selected, onChange, renderThumb, loading, maxHeightClass = 'max-h-[280px]' }: Props) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});

  // Account categories first (even empty ones, as before), then any other category a campaign sits in.
  const groups = useMemo(() => {
    const byName = new Map<string, { name: string; color: string; items: PickerCampaign[] }>();
    categories.forEach(c => byName.set(c.name, { name: c.name, color: c.color, items: [] }));
    campaigns.forEach(m => {
      if (!byName.has(m.category)) byName.set(m.category, { name: m.category, color: m.categoryColor || '#6C60FF', items: [] });
      byName.get(m.category)!.items.push(m);
    });
    return Array.from(byName.values());
  }, [campaigns, categories]);

  const q = query.trim().toLowerCase();
  const visibleGroups = q
    ? groups.map(g => ({ ...g, items: g.items.filter(m => m.title.toLowerCase().includes(q)) })).filter(g => g.items.length > 0)
    : groups;

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    onChange(next);
  };

  return (
    <div data-testid="partial-admin-campaign-picker">
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}...`}
          aria-label="Search campaigns"
          className="w-full h-9 pl-9 pr-3 text-sm bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300"
        />
      </div>
      {selected.size === 0 && (
        <p className="text-xs text-gray-500 mb-2">
          No campaigns ticked: they will be a Partial Admin without campaign access (they can still sign in and see the leads shared with them).
        </p>
      )}
      {loading && campaigns.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Loading campaigns...</p>
      ) : visibleGroups.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">{q ? `No campaigns match "${query}"` : 'No campaigns yet'}</p>
      ) : (
        <div className={`space-y-2 ${maxHeightClass} overflow-y-auto pr-1`}>
          {visibleGroups.map((cat) => {
            const items = cat.items;
            const ids = items.map(m => m.id);
            const selectedCount = ids.filter(id => selected.has(id)).length;
            const allSelected = items.length > 0 && selectedCount === items.length;
            const someSelected = selectedCount > 0 && !allSelected;
            const isOpen = q ? true : expanded.has(cat.name);
            const limit = shown[cat.name] || PAGE;
            return (
              <div key={cat.name} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${allSelected ? 'bg-[#6C60FF]/5' : someSelected ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}>
                  <button
                    type="button"
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${cat.name}`}
                    onClick={() => setExpanded(prev => {
                      const next = new Set(prev);
                      if (next.has(cat.name)) next.delete(cat.name); else next.add(cat.name);
                      return next;
                    })}
                    className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <input
                    type="checkbox"
                    aria-label={`Select all in ${cat.name}`}
                    checked={allSelected}
                    disabled={items.length === 0}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={() => toggle(ids, !allSelected)}
                    className="w-4 h-4 rounded border-gray-300 accent-[#6C60FF] cursor-pointer flex-shrink-0"
                  />
                  <Folder className="w-4 h-4 flex-shrink-0" style={{ color: cat.color }} />
                  <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">{cat.name}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {selectedCount}/{items.length} {items.length === 1 ? 'campaign' : 'campaigns'}
                  </span>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {items.length === 0 ? (
                      <div className="px-10 py-3 text-xs text-gray-400 text-center">No campaigns in this category</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {items.slice(0, limit).map(m => {
                          const on = selected.has(m.id);
                          return (
                            <label
                              key={m.id}
                              className={`flex items-center gap-3 pl-10 pr-3 py-2 cursor-pointer transition-colors ${on ? 'bg-[#6C60FF]/5' : 'hover:bg-gray-50'}`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggle([m.id], !on)}
                                className="w-4 h-4 rounded border-gray-300 accent-[#6C60FF] cursor-pointer flex-shrink-0"
                              />
                              {renderThumb(m)}
                              <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{m.title}</span>
                            </label>
                          );
                        })}
                        {items.length > limit && (
                          <button
                            type="button"
                            onClick={() => setShown(prev => ({ ...prev, [cat.name]: limit + PAGE }))}
                            className="w-full px-10 py-2 text-xs font-medium text-[#6C60FF] hover:bg-gray-50 text-left"
                          >
                            Show {Math.min(PAGE, items.length - limit)} more of {items.length - limit}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
