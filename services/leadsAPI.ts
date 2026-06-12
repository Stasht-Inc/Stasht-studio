import { apiRequest } from '../utils/authUtils';

export interface LeadUser {
  id: number;
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
}

export interface Lead {
  id: number;
  user: LeadUser;
  story: LeadStory;
  status: 'hot' | 'warm' | 'cold' | null;
  engagement: number;
  comments: LeadComment[];
  messages_count?: number;
  sent_count?: number;
  unread_count?: number;
  comment_unread_count?: number;
  last_engaged_at: string;
  first_seen_at: string;
}

export interface LeadsResponse {
  total: number;
  leads: Lead[];
}

export const leadsAPI = {
  getLeads: async (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.search?.trim()) query.append('search', params.search.trim());
    if (params?.status === 'archived') {
      query.append('archived', '1');
    } else if (params?.status && params.status !== 'all') {
      query.append('status', params.status);
    }
    const url = `/leads${query.toString() ? `?${query.toString()}` : ''}`;
    return apiRequest<LeadsResponse>(url, { method: 'GET' });
  },

  updateLeadStatus: async (leadId: number, status: 'hot' | 'warm' | 'cold' | null) => {
    return apiRequest(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getMessages: async (leadId: number) => {
    return apiRequest<{ messages: LeadMessage[] }>(`/leads/${leadId}/messages`, { method: 'GET' });
  },

  sendSMS: async (leadId: number, body: string) => {
    return apiRequest<LeadMessage>(`/leads/${leadId}/messages/sms`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  sendEmail: async (leadId: number, subject: string, body: string) => {
    return apiRequest<LeadMessage>(`/leads/${leadId}/messages/email`, {
      method: 'POST',
      body: JSON.stringify({ subject, body }),
    });
  },

  markRead: async (leadId: number) => {
    return apiRequest<{ marked_read: number }>(`/leads/${leadId}/messages/mark-read`, { method: 'POST' });
  },

  markCommentsRead: async (leadId: number) => {
    return apiRequest<{ marked_read: number }>(`/leads/${leadId}/comments/mark-read`, { method: 'POST' });
  },

  deleteLead: async (leadId: number) => {
    return apiRequest<{ message: string }>(`/leads/${leadId}`, { method: 'DELETE' });
  },

  archiveLead: async (leadId: number) => {
    return apiRequest<{ id: number; is_archived: boolean }>(`/leads/${leadId}/archive`, { method: 'POST' });
  },

  replyToMessage: async (leadId: number, messageId: number, body: string) => {
    return apiRequest<LeadMessage>(`/leads/${leadId}/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  },

  replyToComment: async (imageId: number, comment: string, parentId: number) => {
    return apiRequest('/memory-images/comments', {
      method: 'POST',
      body: JSON.stringify({ image_id: imageId, comment, parent_id: parentId }),
    });
  },
};
