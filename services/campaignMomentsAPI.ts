import { apiRequest, type ApiResponse } from '../utils/authUtils';
import type { OrderRef } from '../components/storeel/lib/momentOrder';

// A saved campaign's moments (web API CampaignMomentsController, Chris 7 Nov 2026): Add a Moment's products and
// vehicles, and the order the Storeel preview's "+" / Move up / Move down give them. Every call answers
// { ok, error } and never throws.

export interface MomentsResult<T = unknown> { ok: boolean; data?: T; error?: string }

/** Where new moments go: right after a moment / linked campaign, first, or (nothing) last. */
export type MomentPlace = { after: OrderRef } | { start: true } | null;

async function run<T>(request: Promise<ApiResponse<any>>, fallback: string): Promise<MomentsResult<T>> {
  try {
    const res = await request;
    if (!res.success) return { ok: false, error: res.message || res.error || fallback };
    const data = (res.data && typeof res.data === 'object' && 'data' in (res.data as object)) ? (res.data as { data: T }).data : (res.data as T);
    return { ok: true, data };
  } catch {
    return { ok: false, error: fallback };
  }
}

const path = (memoryId: string | number) => `/memories/${encodeURIComponent(String(memoryId))}`;
const send = (method: string, body?: unknown): RequestInit => ({ method, ...(body ? { body: JSON.stringify(body) } : {}), noRateLimitRetry: true } as RequestInit);

export const campaignMomentsAPI = {
  /** Website Catalogue products become moments at `place` (Business plan). */
  addProducts: (memoryId: string | number, itemIds: Array<string | number>, place: MomentPlace) =>
    run<{ moments: number; skipped_item_ids: number[]; already_added_item_ids: number[]; moment_ids: number[] }>(apiRequest(`${path(memoryId)}/catalogue-items`, send('POST', {
      catalog_item_ids: itemIds.map((id) => Number(id)),
      ...(place && 'after' in place ? { after_item_id: place.after.id, after_item_type: place.after.type } : {}),
      ...(place && 'start' in place ? { position: 'start' } : {}),
    })), "The products couldn't be added. Try again."),

  addVehicles: (memoryId: string | number, carIds: Array<string | number>) =>
    run<{ linked: number }>(apiRequest(`${path(memoryId)}/cars`, send('POST', { car_ids: carIds.map((id) => Number(id)) })), "The vehicles couldn't be added. Try again."),

  removeVehicle: (memoryId: string | number, carId: string | number) =>
    run(apiRequest(`${path(memoryId)}/cars/${encodeURIComponent(String(carId))}`, send('DELETE')), "The vehicle couldn't be removed. Try again."),

  /** Add a Moment's "Campaigns (optional)" (Chris, 8 Nov 2026): link existing campaigns at `place`. */
  addLinkedCampaigns: (memoryId: string | number, campaignIds: Array<string | number>, place: MomentPlace) =>
    run<{ linked: number; already_linked_ids: number[] }>(apiRequest(`${path(memoryId)}/linked-memories`, send('POST', {
      linked_memory_ids: campaignIds.map((id) => Number(id)),
      ...(place && 'after' in place ? { after_item_id: place.after.id, after_item_type: place.after.type } : {}),
      ...(place && 'start' in place ? { position: 'start' } : {}),
    })), "The campaigns couldn't be linked. Try again."),

  setOrder: (memoryId: string | number, order: OrderRef[]) =>
    run(apiRequest(`${path(memoryId)}/moment-order`, send('PUT', { order })), "The new order couldn't be saved. Try again."),
};
