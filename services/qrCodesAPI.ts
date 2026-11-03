import { apiRequest, fetchWithRateLimitRetry, getApiBaseUrl, getAuthHeaders, tokenUtils } from '../utils/authUtils';
import type { ApiResponse } from '../utils/authUtils';
import {
  campaignOptionsFromResponse, qrCodeAnswer, qrCodeFromResponse, uploadedUrlFromResponse, viewQuery,
  type QrCode, type QrOptionsPage,
} from '../utils/qrCodes';

// QR codes (3 Nov 2026), /api/react/qr-code(s). A code belongs to the view it is made in: the account's own (no
// property_id) or a property's (property_id; the External view also sends X-Stasht-Property, added by apiRequest).
// QR codes v2 (3 Nov 2026 evening): one code per view, made by the API on first open (GET /qr-code); its live campaign
// may be any campaign of the view, published or not. Every call returns { ok, data?, error? }; a refusal ({success:
// false, code, message}: qr_codes_unavailable, property_forbidden, account_not_ready, qr_code_not_found, campaign_*)
// carries the server's message as the error.
//
// Branded codes (3 Nov 2026): PATCH also takes logo_mode (default | custom | none), logo_url (only a URL our upload
// answered) and color (#RRGGBB, or null = auto); 503 qr_style_unavailable before the style columns exist.
// POST /qr-codes/images (multipart, field file: JPG/PNG/GIF/WebP ≤ 5 MB; property_id in a property view, which binds
// the upload to that view's owner) answers {url}; a logo_url from another account is refused (422 errors.logo_url). GET /qr-codes/logo-image?url=
// answers a logo's bytes from Studio's own origin, so the browser may read its pixels (the colour) and embed it in the
// downloads (S3 is another origin); logos are never loaded from S3 directly.

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

/** apiRequest's headers (token, property view) without its JSON content type; null when signed out or expired. */
function rawHeaders(): Record<string, string> | null {
  const token = tokenUtils.getToken();
  if (!token || tokenUtils.isTokenExpired(token)) return null;
  const headers = getAuthHeaders();
  delete headers['Content-Type'];
  return headers;
}

const json = (method: string, payload: Record<string, unknown>): RequestInit => ({ method, body: JSON.stringify(payload) });

const withProperty = (payload: Record<string, unknown>, propertyId: PropertyId) => {
  const q = viewQuery(propertyId);
  return q ? { ...payload, property_id: Number(new URLSearchParams(q).get('property_id')) } : payload;
};

export const qrCodesAPI = {
  /** THE code of this view (made on first open), never from apiRequest's short GET cache: it may have changed elsewhere. */
  get: async (propertyId: PropertyId): Promise<QrResult<{ code: QrCode; styleAvailable: boolean }>> =>
    result(await apiRequest(`/qr-code${viewQuery(propertyId)}`, { skipCache: true } as RequestInit), qrCodeAnswer),

  /** Make another campaign live, drop or restore its image, or set its colour (null = auto). */
  update: async (id: number, changes: { memory_id?: number; logo_mode?: 'default' | 'custom' | 'none'; logo_url?: string; color?: string | null }): Promise<QrResult<QrCode>> =>
    result(await apiRequest(`/qr-codes/${id}`, json('PATCH', changes)), qrCodeFromResponse),
  /** Upload an image for a code's centre; answers its URL (then PATCH logo_mode custom + logo_url). Multipart can't
   * go through apiRequest (it forces JSON). */
  uploadImage: async (file: File, propertyId: PropertyId): Promise<QrResult<string>> => {
    const headers = rawHeaders();
    if (!headers) return { ok: false, error: 'Please sign in again.' };
    const form = new FormData();
    form.append('file', file);
    const pid = withProperty({}, propertyId).property_id;
    if (pid !== undefined) form.append('property_id', String(pid));
    let response: Response;
    try {
      response = await fetchWithRateLimitRetry(`${getApiBaseUrl()}/qr-codes/images`, { method: 'POST', headers: { ...headers, Accept: 'application/json' }, body: form });
    } catch {
      return { ok: false, error: "The image couldn't be uploaded. Check your connection and try again." };
    }
    let body: unknown = null;
    try {
      const raw = await response.text();
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    return result({ success: response.ok, data: body, error: response.ok ? undefined : QR_GENERIC_ERROR } as ApiResponse<any>, uploadedUrlFromResponse);
  },

  /** A logo's bytes through the API (same origin); null when it can't be had (then the code draws without it). */
  logoImage: async (url: string): Promise<Blob | null> => {
    const headers = rawHeaders();
    if (!headers) return null;
    try {
      const response = await fetchWithRateLimitRetry(`${getApiBaseUrl()}/qr-codes/logo-image?${new URLSearchParams({ url })}`, { method: 'GET', headers: { ...headers, Accept: 'image/*' } });
      if (!response.ok || !(response.headers.get('Content-Type') || '').startsWith('image/')) return null;
      return await response.blob();
    } catch {
      return null;
    }
  },

  /** Campaigns of this view for the Live campaign dropdown, any published state (20 a page). */
  campaignOptions: async (propertyId: PropertyId, search: string, page: number): Promise<QrResult<QrOptionsPage>> =>
    result(
      await apiRequest(`/qr-codes/campaign-options${viewQuery(propertyId, { search: search || undefined, page })}`, { skipCache: true } as RequestInit),
      (body) => campaignOptionsFromResponse(body, page),
    ),

};
