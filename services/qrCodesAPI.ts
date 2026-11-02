import { apiRequest } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';
import {
  campaignOptionsFromResponse, qrCodeFromResponse, qrCodesFromResponse, viewQuery,
  type QrCode, type QrOptionsPage,
} from '../utils/qrCodes';

// Dynamic QR Codes (3 Nov 2026), /api/react/qr-codes. Codes belong to the view they are made in: the account's own
// (no property_id) or a property's (property_id; the External view also sends X-Stasht-Property, added by
// apiRequest). Every call returns { ok, data?, error? }; a refusal ({success: false, code, message}: qr_codes_unavailable,
// property_forbidden, account_not_ready, qr_code_not_found, campaign_*) carries the server's message as the error.

export interface QrResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const QR_GENERIC_ERROR = 'Something went wrong. Please try again.';

type PropertyId = number | string | null | undefined;

/** apiRequest answers success for any 2xx; a body that says success: false is still a refusal. */
function result<T>(res: ApiResponse<any>, read: (body: unknown) => T | null): QrResult<T> {
  const body = res.data as any;
  if (!res.success || (body && typeof body === 'object' && body.success === false)) {
    const error = (body && typeof body === 'object' && (body.message || body.error)) || res.error || QR_GENERIC_ERROR;
    return { ok: false, error: String(error) };
  }
  const data = read(body);
  return data === null ? { ok: false, error: QR_GENERIC_ERROR } : { ok: true, data };
}

const json = (method: string, payload: Record<string, unknown>): RequestInit => ({ method, body: JSON.stringify(payload) });

const withProperty = (payload: Record<string, unknown>, propertyId: PropertyId) => {
  const q = viewQuery(propertyId);
  return q ? { ...payload, property_id: Number(new URLSearchParams(q).get('property_id')) } : payload;
};

export const qrCodesAPI = {
  /** The codes of this view, newest first. Never from apiRequest's short GET cache: scan counts move. */
  list: async (propertyId: PropertyId): Promise<QrResult<QrCode[]>> =>
    result(await apiRequest(`/qr-codes${viewQuery(propertyId)}`, { skipCache: true } as RequestInit), qrCodesFromResponse),

  create: async (memoryId: number, propertyId: PropertyId, name?: string | null): Promise<QrResult<QrCode>> =>
    result(
      await apiRequest('/qr-codes', json('POST', withProperty({ memory_id: memoryId, ...(name ? { name } : {}) }, propertyId))),
      qrCodeFromResponse,
    ),

  /** Point the code at another campaign, or rename it. */
  update: async (id: number, changes: { memory_id?: number; name?: string }): Promise<QrResult<QrCode>> =>
    result(await apiRequest(`/qr-codes/${id}`, json('PATCH', changes)), qrCodeFromResponse),

  remove: async (id: number): Promise<QrResult<true>> =>
    result(await apiRequest(`/qr-codes/${id}`, { method: 'DELETE' }), () => true),

  /** Campaigns of this view for the picker, with each one's published state (20 a page). */
  campaignOptions: async (propertyId: PropertyId, search: string, page: number): Promise<QrResult<QrOptionsPage>> =>
    result(
      await apiRequest(`/qr-codes/campaign-options${viewQuery(propertyId, { search: search || undefined, page })}`, { skipCache: true } as RequestInit),
      (body) => campaignOptionsFromResponse(body, page),
    ),

  /**
   * Publish a campaign publicly (role 1) through the existing publish endpoint, so a code can open it, with
   * publish_only: true as the QR codes contract asks. Only for options whose can_publish is true.
   */
  publish: async (memoryId: number): Promise<QrResult<true>> =>
    result(await apiRequest(`/memories/${memoryId}/publish`, json('POST', { role: 1, publish_only: true })), () => true),
};
