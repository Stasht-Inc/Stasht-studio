// Which campaign cards the sidebar's expand/collapse state hides from the Storeels "All Campaigns" grid
// (pages/MemoriesPage.tsx: the grid and its "N campaigns found" count).
//
// Collapsing a category row in the sidebar hides that category's campaigns from the grid. Only a category that HAS a
// row can be collapsed: a card whose category has no sidebar row has nothing to collapse, so it always shows. The API
// files a published campaign under the virtual category "Published"; on an account with no "Published" row the
// sidebar's auto-expand (its own non-empty rows) left "Published" out of the expanded list, and the published
// campaign disappeared from All Campaigns (real local E2E, 9 Nov 2026: "3 campaigns found" of 4).

type CampaignCard = {
  isShared?: boolean;
  category?: { name?: string | null } | string | null;
  property_category?: { name?: string | null } | null;
} | null | undefined;

/** The sidebar row a card belongs to: shared cards → "Shared With", any other card → its own category. */
export function campaignSidebarBucket(memory: CampaignCard): string {
  if (!memory) return '';
  if (memory.isShared) return 'Shared With';
  const category = typeof memory.category === 'string' ? memory.category : memory.category?.name;
  return category || memory.property_category?.name || '';
}

/**
 * True when the card's sidebar row exists and is collapsed. Nothing expanded at all means no sidebar filter.
 * `sidebarCategoryNames`: the names of the category rows the sidebar shows.
 */
export function hiddenByCollapsedCategory(
  memory: CampaignCard,
  expandedCategories: readonly string[] | null | undefined,
  sidebarCategoryNames: readonly string[] | null | undefined,
): boolean {
  if (!memory || !Array.isArray(expandedCategories) || expandedCategories.length === 0) return false;
  const bucket = campaignSidebarBucket(memory);
  if (expandedCategories.includes(bucket)) return false;
  return Array.isArray(sidebarCategoryNames) && sidebarCategoryNames.includes(bucket);
}
