import { apiRequest, API_BASE_URL } from '../utils/authUtils';

// Alvin AI help centre chat (ClickUp wdy2xh1r0r), /api/react/alvin/*.

export type AlvinRole = 'user' | 'assistant';

// A "Take me there" button: a Studio page id (App's app-navigate ids) and its name.
export interface AlvinPageLink {
  page: string;
  label: string;
}

// A file sent with a question (the file itself isn't kept on the server).
export interface AlvinAttachmentInfo {
  name: string;
  mime: string;
  size: number;
  kind: 'image' | 'document';
}

// A detail on a confirmation card (app/Services/Alvin/Actions in the web API).
export interface AlvinActionField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'select' | 'multiselect';
  value: string | string[] | null;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
}

// Something Alvin offers to do; nothing happens until the person confirms.
export interface AlvinActionCard {
  id: string;
  type: string;
  title: string;
  confirm_label: string;
  fields: AlvinActionField[];
  notes?: string[];
  credits: number;
  credits_left?: number;
  status: 'proposed' | 'done' | 'failed' | 'cancelled';
  problem?: string | null;
}

export interface AlvinActionResult {
  ok: boolean;
  card?: AlvinMessage;
  done?: AlvinMessage;
  code?: string;
  message?: string;
}

export interface AlvinMessage {
  id: number | string;
  role: AlvinRole;
  body: string;
  meta: { failed?: boolean; links?: AlvinPageLink[]; attachments?: AlvinAttachmentInfo[]; action?: AlvinActionCard; [key: string]: unknown };
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
  // 'no_credits' (reading files needs an AI credit), 'file_rejected', 'daily_limit'
  code?: string;
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
        code: r.code,
        dailyLimit: r.code === 'daily_limit',
        message: r.message || r.error || NETWORK_ERROR,
      };
    } catch {
      return { ok: false, dailyLimit: false, message: NETWORK_ERROR };
    }
  },

  // Multipart, so it can't go through apiRequest (which always sends JSON).
  async sendWithFiles(message: string, page: string | null, files: File[]): Promise<AlvinSendResult> {
    const form = new FormData();
    if (message) form.append('message', message);
    if (page) form.append('page', page);
    files.forEach((f) => form.append('files[]', f));

    try {
      const token = localStorage.getItem('stasht_token');
      const res = await fetch(`${API_BASE_URL}/alvin/messages`, {
        method: 'POST',
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.data?.question && data?.data?.answer) {
        return { ok: true, data: data.data };
      }
      if (res.status === 401) {
        return { ok: false, message: 'Your session has ended. Please sign in again.' };
      }
      if (res.status === 413) {
        return { ok: false, message: 'These files are too big to send together. Try fewer or smaller files.' };
      }
      if (res.status === 429 && data?.code !== 'daily_limit') {
        return { ok: false, message: "You're sending messages quickly. Please wait a moment and try again." };
      }
      if (res.status === 422 && !data?.code && data?.errors && Object.keys(data.errors).some((k) => k.startsWith('files'))) {
        return { ok: false, message: "A file didn't upload. Files can be up to 10 MB (images up to 5 MB), and up to 5 at a time." };
      }
      const firstError = data?.errors ? (Object.values(data.errors)[0] as string[] | undefined)?.[0] : undefined;
      return {
        ok: false,
        code: data?.code,
        dailyLimit: data?.code === 'daily_limit',
        message: (data?.code ? data?.message : firstError || data?.message) || NETWORK_ERROR,
      };
    } catch {
      return { ok: false, message: NETWORK_ERROR };
    }
  },

  // Confirm (with the person's edits) or cancel a confirmation card. Errors still return the updated card.
  async confirmAction(messageId: number | string, fields: Record<string, unknown>): Promise<AlvinActionResult> {
    return actionCall(`/alvin/actions/${messageId}/confirm`, { fields });
  },

  async cancelAction(messageId: number | string): Promise<AlvinActionResult> {
    return actionCall(`/alvin/actions/${messageId}/cancel`, {});
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

async function actionCall(path: string, body: Record<string, unknown>): Promise<AlvinActionResult> {
  try {
    const res = await apiRequest<any>(path, { method: 'POST', body: JSON.stringify(body), noRateLimitRetry: true } as RequestInit);
    // Success: `data` is the whole body ({ success, data }). Errors: the body is spread into the result.
    const r = res as any;
    const payload = res.success ? r.data?.data : r.data;
    return {
      ok: !!res.success,
      card: payload?.card,
      done: payload?.done,
      code: r.code,
      message: res.success ? undefined : r.message || r.error || NETWORK_ERROR,
    };
  } catch {
    return { ok: false, message: NETWORK_ERROR };
  }
}
