import { apiRequest } from '../utils/authUtils';

// Alvin AI help centre chat (ClickUp wdy2xh1r0r), /api/react/alvin/*.

export type AlvinRole = 'user' | 'assistant';

// A "Take me there" button: a Studio page id (App's app-navigate ids) and its name.
export interface AlvinPageLink {
  page: string;
  label: string;
}

export interface AlvinMessage {
  id: number | string;
  role: AlvinRole;
  body: string;
  meta: { failed?: boolean; links?: AlvinPageLink[]; [key: string]: unknown };
  created_at: string | null;
}

export interface AlvinConversation {
  messages: AlvinMessage[];
  suggestions: string[];
  // Starter questions per Studio page; pages not listed use `suggestions`.
  suggestions_by_page?: Record<string, string[]>;
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
  // Never throws: null when the chat couldn't be loaded.
  async getConversation(): Promise<AlvinConversation | null> {
    try {
      // apiRequest's `data` is the whole response body ({ success, data }).
      const res = await apiRequest<{ data?: AlvinConversation }>('/alvin/conversation', { method: 'GET', skipCache: true } as RequestInit);
      const conv = res.success ? res.data?.data : undefined;
      return conv ? { ...conv, messages: conv.messages ?? [], suggestions: conv.suggestions ?? [] } : null;
    } catch {
      return null;
    }
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
    try {
      const res = await apiRequest('/alvin/conversation/reset', { method: 'POST' });
      return res.success;
    } catch {
      return false;
    }
  },
};
