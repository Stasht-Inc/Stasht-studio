import { apiRequest } from '../utils/authUtils';
import { GENERIC_ERROR, toResult, type ApiLikeResponse, type NlResult } from '../components/newsletters/lib/apiResult';
import { countFromResponse, type StoreelCountResult, type StoreelSendSummary } from '../components/storeel/lib/storeelSend';
import type { AudienceItem, NewsletterChannel } from './newslettersAPI';

// The Storeel flow's step 3 Send (Chris, 4 Nov 2026, point 9): a campaign sent as tracked Storeels to a newsletter-
// style audience. /api/react, Bearer token, not plan-gated (only whoever may publish the campaign may count or send).
// 503 not_available until the server's SQL has run.

const memory = (id: number) => `/memories/${encodeURIComponent(String(id))}`;

async function raw(endpoint: string, init: RequestInit): Promise<ApiLikeResponse | null> {
  try {
    return (await apiRequest(endpoint, init)) as unknown as ApiLikeResponse;
  } catch {
    return null;
  }
}

export const storeelBroadcastAPI = {
  /** Estimated recipients for this audience and channels (the newsletter counts), the per-send cap and, when the API
   *  sends it, the monthly allowance. */
  async audienceCount(memoryId: number, audience: AudienceItem[], channels: NewsletterChannel[]): Promise<StoreelCountResult> {
    const res = await raw(`${memory(memoryId)}/storeel-audience-count`, { method: 'POST', body: JSON.stringify({ audience, channels }) });
    return res ? countFromResponse(res) : { ok: false, error: GENERIC_ERROR, fieldErrors: {} };
  },

  async send(memoryId: number, body: { audience: AudienceItem[]; channels: NewsletterChannel[]; message: string; idempotency_key: string; subject?: string }): Promise<NlResult<StoreelSendSummary>> {
    return toResult<StoreelSendSummary>(await raw(`${memory(memoryId)}/storeel-send`, { method: 'POST', body: JSON.stringify(body) }));
  },
};
