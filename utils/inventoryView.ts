// Whose cars and website-catalogue items the API shows a salesperson (Deepak, 2 Nov 2026, binding).
//
// A salesperson's PERSONAL account sees only its own cars and catalogue items. The main account's (Serpa Chrysler's)
// appear only in the External view of the salesperson's own external property (utils/salespersonLanding). The API
// can't tell the two views apart — they use the same sign-in — so every request made from that External view names
// the property in the X-Stasht-Property header (authUtils getAuthHeaders / apiRequest). The API checks the header each
// time (the property must be this account's own active external property) and ignores it otherwise; every other view
// sends nothing.
//
// The view is THIS tab's: PropertyContext reports each switch here, and a tab starts from what localStorage holds when
// it loads (as PropertyContext does). A switch in another tab rewrites localStorage but doesn't change this tab's
// requests, so a personal tab never gets the main account's inventory because another tab opened the External view.

import { isOwnExternalProperty, ownStashId, signedInUserOr } from './salespersonLanding.ts';

export const PROPERTY_VIEW_HEADER = 'X-Stasht-Property';

type Row = Record<string, any> | null | undefined;

/**
 * The property the API is told about in this view: the External view (view type 'property') of the signed-in
 * salesperson's own external property, as its id. null in the personal view and in any other property view.
 */
export function inventoryViewPropertyId(viewType: unknown, property: Row, user: unknown): string | null {
  if (viewType !== 'property' || !property) return null;
  const id = property.id === null || property.id === undefined ? '' : String(property.id).trim();
  if (!/^\d+$/.test(id) || Number(id) <= 0) return null;
  // A row left over from another sign-in is not this account's own (the API would ignore it anyway).
  const me = ownStashId(user);
  const owner = property.user_id === null || property.user_id === undefined ? '' : String(property.user_id).trim();
  if (me && owner && owner !== me) return null;
  return isOwnExternalProperty(property, user) ? id : null;
}

/** The request headers for that view: { 'X-Stasht-Property': id } or none. */
export function propertyViewHeaders(viewType: unknown, property: Row, user: unknown): Record<string, string> {
  const id = inventoryViewPropertyId(viewType, property, user);
  return id ? { [PROPERTY_VIEW_HEADER]: id } : {};
}

type TabView = { viewType: unknown; property: Row };

let tabView: TabView | null = null;
const listeners = new Set<() => void>();

function storedView(): TabView {
  try {
    if (typeof localStorage === 'undefined') return { viewType: 'personal', property: null };
    const viewType = localStorage.getItem('view_type') === 'property' ? 'property' : 'personal';
    const raw = localStorage.getItem('selected_property');
    return { viewType, property: raw ? JSON.parse(raw) : null };
  } catch {
    return { viewType: 'personal', property: null };
  }
}

/**
 * PropertyContext: the view this tab is in now (each switch, and the view it started in). When that changes what the
 * API is told (switching between the personal and the External view), everything showing cars or catalogue items is
 * told to load them again (subscribePropertyView): a page kept on screen across the switch must not go on showing the
 * main account's inventory in the personal view, or miss it in the External view.
 */
export function setTabPropertyView(viewType: unknown, property: Row): void {
  const before = propertyViewCacheKey();
  tabView = { viewType, property: property ?? null };
  if (propertyViewCacheKey() !== before) listeners.forEach((listener) => listener());
}

/** Called after each change of what the API is told (see setTabPropertyView). Returns the unsubscribe. */
export function subscribePropertyView(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests: forget the tab's view, so the next read starts from localStorage again. */
export function resetTabPropertyView(): void {
  tabView = null;
}

/** The headers every API request from this tab carries (see the file note). */
export function currentPropertyViewHeaders(): Record<string, string> {
  if (!tabView) tabView = storedView();
  return propertyViewHeaders(tabView.viewType, tabView.property, signedInUserOr(null));
}

/** A short key for this tab's view, so cached GET responses of one view are never served in the other. */
export function propertyViewCacheKey(): string {
  return currentPropertyViewHeaders()[PROPERTY_VIEW_HEADER] || '-';
}
