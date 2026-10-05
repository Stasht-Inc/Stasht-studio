import { apiRequest } from '../utils/authUtils';

// Alvin AI help centre chat (ClickUp wdy2xh1r0r), /api/react/alvin/*.

export type AlvinRole = 'user' | 'assistant';

export interface AlvinMessage {
  id: number | string;
  role: AlvinRole;
  body: string;
  meta: { failed?: boolean; [key: string]: unknown };
  created_at: string | null;
}

export interface AlvinConversation {
  messages: AlvinMessage[];
  suggestions: string[];
  questions_left_today: number;
}

export interface AlvinAnswer {
  question: AlvinMessage;
  answer: AlvinMessage;
  questions_left_today: number;
}

// ok: data is set. Not ok: message says why (dailyLimit when today's free questions are used up).
export interface AlvinSendResult {
  ok: boolean;
  data?: AlvinAnswer;
  dailyLimit?: boolean;
  message?: string;
}

const NETWORK_ERROR = "Sorry, I couldn't reach Alvin. Check your connection and try again.";

export const alvinAPI = {
  async getConversation(): Promise<AlvinConversation | null> {
    // apiRequest's `data` is the whole response body ({ success, data }).
    const res = await apiRequest<{ data?: AlvinConversation }>('/alvin/conversation', { method: 'GET', skipCache: true } as RequestInit);
    const conv = res.success ? res.data?.data : undefined;
    return conv ? { ...conv, messages: conv.messages ?? [], suggestions: conv.suggestions ?? [] } : null;
  },

  async send(message: string, page: string | null): Promise<AlvinSendResult> {
    try {
      const res = await apiRequest<{ data?: AlvinAnswer }>('/alvin/messages', {
        method: 'POST',
        body: JSON.stringify({ message, page }),
        // A 429 here is the daily question limit or the per-minute throttle: retrying can't help.
        noRateLimitRetry: true,
      } as RequestInit);

      const answer = res.success ? res.data?.data : undefined;
      if (answer?.question && answer?.answer) {
        return { ok: true, data: answer };
      }
      const r = res as any;
      return {
        ok: false,
        dailyLimit: r.code === 'daily_limit',
        message: r.message || r.error || NETWORK_ERROR,
      };
    } catch {
      return { ok: false, dailyLimit: false, message: NETWORK_ERROR };
    }
  },

  async startOver(): Promise<boolean> {
    const res = await apiRequest('/alvin/conversation/reset', { method: 'POST' });
    return res.success;
  },
};
