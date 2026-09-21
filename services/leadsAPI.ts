import { apiRequest, isPartialAdmin, getPartialAdminEmail } from '../utils/authUtils';

// Fail closed: a session flagged as partial-admin with no email on record is
// corrupted, not "not partial admin" — sending nothing here would let the
// request run unscoped as the full owner. Surface it as an error instead of
// silently escalating access.
const requirePartialAdminEmail = (): string => {
  const email = getPartialAdminEmail();
  if (!email) {
    throw new Error('Partial admin session is missing its email — please sign in again.');
  }
  return email;
};

// Extra body fields for scoped partial-admin sessions — {} otherwise.
const partialAdminBody = (): Record<string, string> =>
  isPartialAdmin() ? { partial_admin_email: requirePartialAdminEmail() } : {};

// Query-string suffix ("&partial_admin_email=..." or "?partial_admin_email=..." or "")
// for GET/DELETE endpoints. Pass '?' when the URL has no existing query string.
const partialAdminQuery = (sep: '?' | '&' = '&'): string =>
  isPartialAdmin() ? `${sep}partial_admin_email=${encodeURIComponent(requirePartialAdminEmail())}` : '';

export interface LeadUser {
  // null for guest leads (photo submitted from a published page, no account) —
  // the backend still fills name/email/phone from the viewer_* columns on the
  // lead row, only `id` is absent.
  id: number | null;
  name: string;
  email: string;
  profile_image?: string;
  phone_number?: string;
  phone?: string;
  location?: string;
  city?: string;
  country?: string;
}

export interface LeadStory {
  id: number;
  title: string;
}

export interface LeadCommentUser {
  id: number;
  name: string;
  profile_image?: string;
}

export interface LeadComment {
  id: number;
  image_id: number;
  parent_id: number | null;
  description: string;
  created_at: string;
  user: LeadCommentUser;
}

export interface LeadMessageAttachment {
  id: number;
  filename: string;
  content_type: string;
  url: string;
  size: number;
}

export interface LeadMessage {
  id: number;
  parent_message_id: number | null;
  direction: 'outbound' | 'inbound';
  channel: 'email' | 'sms';
  body: string;
  subject?: string | null;
  status: string;
  provider_message_id?: string | null;
  sent_at: string;
  attachments?: LeadMessageAttachment[];
}

export interface Lead {
  id: number;
  // null when there's no viewer account AND no guest details on the lead row
  // (rare/malformed rows); guest leads still populate this from viewer_* columns.
  user: LeadUser | null;
  story: LeadStory;
  status: 'hot' | 'warm' | 'cold' | 'visited' | 'sold' | null;
  engagement: number;
  comments: LeadComment[];
  messages_count?: number;
  sent_count?: number;
  unread_count?: number;
  comment_unread_count?: number;
  last_engaged_at: string;
  first_seen_at: string;
  // True when this lead belongs to another owner but rolls up into the
  // current user's list (main-owner admin view) — read-only in the UI.
  is_rollup?: boolean;
}

// Present only when the request sent `page` — the backend omits it otherwise.
export interface LeadsMeta {
  page: number;
  per_page: number;
  total_pages: number;
}

export interface LeadsResponse {
  total: number;
  // Additive fields (Task M4): per-status breakdown and combined sent+received
  // message count across the full filtered/scoped result set — always present,
  // backend-computed pre-pagination so they're correct even when `leads` only
  // holds the current page. Optional here defensively (older cached responses,
  // partial mocks in tests).
  status_counts?: Partial<Record<'hot' | 'warm' | 'cold' | 'visited' | 'sold', number>>;
  messages_total?: number;
  leads: Lead[];
  meta?: LeadsMeta;
}

// Points the lead drawer at a specific message/comment to scroll-to + highlight.
export interface CommentaryTarget {
  kind: 'message' | 'comment';
  id: number;
}

export interface LeadGroupMember {
  lead_id: number;
  status: 'hot' | 'warm' | 'cold' | 'visited' | 'sold' | null;
  user: {
    id: number;
    name: string;
    email: string | null;
    profile_image?: string;
    phone_number?: string | null;
  };
  has_email: boolean;
  has_phone: boolean;
}

// A past broadcast sent to the group (returned by GET /lead-groups/{id}).
export interface LeadGroupBroadcast {
  broadcast_id: string;
  subject: string;
  body: string;
  channels: string[];
  recipient_count: number;
  sent_at: string;
  attachments?: LeadMessageAttachment[];
}

export interface LeadGroup {
  id: number;
  name: string;
  member_count: number;
  created_at: string;
  updated_at: string;
  members: LeadGroupMember[];
  messages?: LeadGroupBroadcast[];
}

// Lightweight member preview included in the GET /lead-groups list response.
export interface LeadGroupMemberPreview {
  lead_id: number;
  name: string;
  profile_image: string | null;
}

// Response from POST /lead-groups/{id}/broadcast. Note: sent/skipped_no_channel/
// failed are arrays of per-lead results; the integer counts live in `summary`.
export interface BroadcastResult {
  group_id: number;
  sent: unknown[];
  skipped_no_channel: unknown[];
  failed: unknown[];
  summary: { total: number; sent: number; skipped: number; failed: number };
}

// Summary row returned by GET /lead-groups (with a members preview for avatars).
export interface LeadGroupSummary {
  id: number;
  name: string;
  member_count: number;
  members: LeadGroupMemberPreview[];
  created_at: string;
  updated_at: string;
}

// ── My Conversations (viewer side) ─────────────────────────────────────────
export interface ConversationOwner {
  id: number;
  name: string;
  profile_image?: string;
}

export interface ConversationLastMessage {
  body: string;
  from_me: boolean;
  channel: string;
  sent_at: string;
}

export interface Conversation {
  lead_id: number;
  owner: ConversationOwner;
  story: { id: number; title: string };
  last_message: ConversationLastMessage | null;
  unread_count: number;
  last_message_at: string;
}

export interface ConversationMessage {
  id?: number;
  from_me: boolean;
  channel: string;
  body: string;
  sent_at: string;
}

export const leadsAPI = {
  getLeads: async (params?: {
    search?: string;
    status?: string;
    sort?: 'name' | 'last_engaged' | 'first_seen' | 'status';
    direction?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.append('search', params.search.trim());
    if (params?.status === 'archived') {
      query.append('archived', '1');
    } else if (params?.status && params.status !== 'all') {
      query.append('status', params.status);
    }
    if (params?.sort) query.append('sort', params.sort);
    if (params?.direction) query.append('direction', params.direction);
    if (params?.page != null) query.append('page', String(params.page));
    if (params?.per_page != null) query.append('per_page', String(params.per_page));
    if (isPartialAdmin()) query.append('partial_admin_email', getPartialAdminEmail());
    const url = `/leads${query.toString() ? `?${query.toString()}` : ''}`;
    return apiRequest<LeadsResponse>(url, { method: 'GET' });
  },

  updateLeadStatus: async (leadId: number, status: 'hot' | 'warm' | 'cold' | 'visited' | 'sold' | null) => {
    return apiRequest(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...partialAdminBody() }),
    });
  },

  // `fresh` bypasses apiRequest's 15s GET cache — a thread must never show a stale copy
  // (opening a lead, Refresh, and the live poll in LeadDetailDrawer all pass it), otherwise a
  // customer's reply can sit unseen for up to 15s.
  getMessages: async (leadId: number, fresh = false) => {
    return apiRequest<{ messages: LeadMessage[] }>(
      `/leads/${leadId}/messages${partialAdminQuery('?')}`,
      { method: 'GET', ...(fresh ? { skipCache: true } : {}) } as RequestInit,
    );
  },

  // POST /api/react/leads/{id}/ai-suggest — generate a suggested message.
  // no_credit:true (retry) regenerates without consuming a credit.
  aiSuggest: async (leadId: number, action: string, noCredit = false) => {
    return apiRequest<{ message?: string; credits_remaining?: number }>(`/leads/${leadId}/ai-suggest`, {
      method: 'POST',
      body: JSON.stringify({ action, no_credit: noCredit, ...partialAdminBody() }),
    });
  },

  // POST /api/react/lead-groups — create a persistent group from selected leads.
  // lead_ids are leads.id values (the id from GET /leads), not viewer user ids.
  createLeadGroup: async (name: string, leadIds: number[]) => {
    return apiRequest<LeadGroup>('/lead-groups', {
      method: 'POST',
      body: JSON.stringify({ name, lead_ids: [...new Set(leadIds)], ...partialAdminBody() }),
    });
  },

  // POST /api/react/lead-groups/ai-suggest — generate a group message.
  // groupId is sent only when the group already exists (the drawer); the create
  // modal omits it. no_credit:true = free retry.
  aiSuggestGroup: async (action: string, noCredit = false, groupId?: number) => {
    const body: Record<string, unknown> = { action, no_credit: noCredit, ...partialAdminBody() };
    if (groupId != null) body.group_id = groupId;
    return apiRequest<{ message?: string; credits_remaining?: number }>(`/lead-groups/ai-suggest`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // GET /api/react/lead-groups — list of groups (summary, no members).
  getLeadGroups: async () => {
    return apiRequest<LeadGroupSummary[] | { groups: LeadGroupSummary[] }>(`/lead-groups${partialAdminQuery('?')}`, { method: 'GET' });
  },

  // GET /api/react/lead-groups/{id} — one group with its members.
  getLeadGroup: async (id: number) => {
    return apiRequest<LeadGroup | { group: LeadGroup }>(`/lead-groups/${id}${partialAdminQuery('?')}`, { method: 'GET' });
  },

  // GET /api/react/my-conversations — conversations where I'm the viewer.
  getMyConversations: async () => {
    return apiRequest<{ total: number; conversations: Conversation[] }>(`/my-conversations${partialAdminQuery('?')}`, { method: 'GET' });
  },

  // GET /api/react/my-conversations/{lead_id}/messages — thread (auto-marks read).
  getConversationMessages: async (leadId: number) => {
    return apiRequest<{ messages: ConversationMessage[] } | ConversationMessage[]>(
      `/my-conversations/${leadId}/messages${partialAdminQuery('?')}`,
      { method: 'GET' }
    );
  },

  // POST /api/react/my-conversations/{lead_id}/reply — viewer replies in-app.
  // NOTE: no idempotencyKey param — this route is served by a different
  // controller (MyConversationsController) than the lead-messaging endpoints
  // above and does not implement server-side idempotency. Double-send
  // protection for this call site is a client-side guard only (see
  // ConversationDrawer.handleSend).
  replyToConversation: async (leadId: number, body: string) => {
    return apiRequest(`/my-conversations/${leadId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body, ...partialAdminBody() }),
    });
  },

  // POST /api/react/my-conversations/{lead_id}/mark-read — mark owner messages read.
  markConversationRead: async (leadId: number) => {
    return apiRequest(`/my-conversations/${leadId}/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ ...partialAdminBody() }),
    });
  },

  // POST /api/react/lead-groups/{id}/broadcast — send one message to the whole
  // group; the server fans out to each member (email if available, else SMS).
  // idempotencyKey (optional): when set, sent as idempotency_key so a retried
  // request (e.g. double Enter/click) is deduped server-side (Task B3).
  broadcastToGroup: async (
    groupId: number,
    message: string,
    attachments?: { filename: string; data: string }[],
    idempotencyKey?: string,
  ) => {
    return apiRequest<BroadcastResult>(
      `/lead-groups/${groupId}/broadcast`,
      {
        method: 'POST',
        body: JSON.stringify({
          body: message,
          ...(attachments && attachments.length ? { attachments } : {}),
          ...partialAdminBody(),
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        }),
      }
    );
  },

  // idempotencyKey (optional): see broadcastToGroup above.
  sendSMS: async (leadId: number, body: string, idempotencyKey?: string) => {
    return apiRequest<LeadMessage>(`/leads/${leadId}/messages/sms`, {
      method: 'POST',
      body: JSON.stringify({ body, ...partialAdminBody(), ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}) }),
    });
  },

  // idempotencyKey (optional): see broadcastToGroup above.
  sendEmail: async (
    leadId: number,
    subject: string,
    body: string,
    attachments?: { filename: string; data: string }[],
    idempotencyKey?: string,
  ) => {
    return apiRequest<LeadMessage>(`/leads/${leadId}/messages/email`, {
      method: 'POST',
      body: JSON.stringify({
        subject,
        body,
        ...(attachments && attachments.length ? { attachments } : {}),
        ...partialAdminBody(),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      }),
    });
  },

  // "Share new cars" — puts cars from the dealer's own inventory (GET /cars) into
  // a NEW campaign (named `title`; the server defaults it to "Vehicles Just for
  // You") and sends the lead that campaign's own link. Never appends to the
  // lead's existing campaign (Chris, 2026-09-20). Same endpoint the mobile app's
  // Share New Cars sheet uses.
  shareCars: async (leadId: number, carIds: number[], title?: string) => {
    return apiRequest<{
      message: string;
      cars_added: number;
      cars_total: number;
      channels: string[];
      campaign?: { id: number; title: string; url: string };
    }>(
      `/leads/${leadId}/share-cars`,
      {
        method: 'POST',
        body: JSON.stringify({ car_ids: carIds, ...(title ? { title } : {}), ...partialAdminBody() }),
      },
    );
  },

  markRead: async (leadId: number) => {
    return apiRequest<{ marked_read: number }>(`/leads/${leadId}/messages/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ ...partialAdminBody() }),
    });
  },

  markCommentsRead: async (leadId: number) => {
    return apiRequest<{ marked_read: number }>(`/leads/${leadId}/comments/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ ...partialAdminBody() }),
    });
  },

  deleteLead: async (leadId: number) => {
    return apiRequest<{ message: string }>(`/leads/${leadId}${partialAdminQuery('?')}`, { method: 'DELETE' });
  },

  archiveLead: async (leadId: number) => {
    return apiRequest<{ id: number; is_archived: boolean }>(`/leads/${leadId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ ...partialAdminBody() }),
    });
  },

  // idempotencyKey (optional): see broadcastToGroup above.
  replyToMessage: async (leadId: number, messageId: number, body: string, idempotencyKey?: string) => {
    return apiRequest<LeadMessage>(`/leads/${leadId}/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body, ...partialAdminBody(), ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}) }),
    });
  },

  // NOTE: no idempotencyKey param — this hits /memory-images/comments (a
  // non-lead endpoint with no server-side idempotency support). Double-send
  // protection for this call site is a client-side guard only (see
  // LeadDetailDrawer.handleCommentReplySubmit).
  replyToComment: async (imageId: number, comment: string, parentId: number) => {
    return apiRequest('/memory-images/comments', {
      method: 'POST',
      body: JSON.stringify({ image_id: imageId, comment, parent_id: parentId, ...partialAdminBody() }),
    });
  },
};
