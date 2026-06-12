import { dashboardAPI } from '../utils/authUtils';

export interface InviteMemory {
  id: number;
  title: string;
  description: string | null;
  location: string;
  cover_image: string;
  start_date?: string;
  end_date?: string;
  formatted_range?: string;
  image_count?: number;
  collaborator_count?: number;
  dates?: {
    start_date: string;
    end_date: string;
    formatted_range: string;
  };
  counts?: {
    images: number;
    collaborators: number;
  };
  category?: {
    id: number;
    name: string;
    color: string;
    badge_style?: {
      bg: string;
      text: string;
      hex_color: string;
    };
  };
  sub_category?: {
    id: number;
    name: string;
  };
}

export interface InviteCollaborator {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: string;
  profile_image: string | null;
  type: string;
}

export interface InviteSender {
  id: number;
  name: string;
  email: string;
  profile_image: string | null;
}

export interface Invite {
  id: number;
  memory_id: number;
  sender_id: number;
  user_id: number;
  email: string;
  accept_reject: string; // "0" = pending, "1" = accepted, "2" = rejected
  created_at: string;
  updated_at: string;
  
  // Flattened memory properties (optional - for backward compatibility)
  memory_title?: string;
  memory_location?: string;
  image_count?: number;
  
  // Flattened sender properties (optional - for backward compatibility)
  sender_name?: string;
  sender_email?: string;
  sender_profile_image?: string;
  
  // Nested objects matching your API response
  memory: InviteMemory;
  counts?: {
    images: number;
    collaborators: number;
  };
  collaborators: InviteCollaborator[];
  sender: InviteSender;
  owner?: InviteSender;
}

export interface InvitesResponse {
  success: boolean;
  data: {
    authenticated_user: {
      id: number;
      external_user_id: number;
      email: string;
      name: string;
    };
    total_invites: number;
    invites: Invite[];
    grouped_invites: {
      pending: Invite[];
      accepted: Invite[];
      rejected: Invite[];
    };
    counts: {
      pending: number;
      accepted: number;
      rejected: number;
    };
    debug_info?: any;
  };
}

export class InvitesAPI {
  // Fetch all invites
  static async getInvites(): Promise<any> {
    try {
      console.log('🚀 Fetching invites from /invites endpoint...');
      console.log('🔑 Current auth token exists:', !!localStorage.getItem('stasht_token'));
      console.log('🔑 Token length:', localStorage.getItem('stasht_token')?.length || 0);
      console.log('🌐 API Base URL:', window.location.origin + '/api/react');
      console.log('🎯 Full URL:', window.location.origin + '/api/react/invites');
      
      const response = await dashboardAPI.get('/invites');
      
      console.log('📋 Invites API Full Response:', response);
      console.log('📊 Response Data:', response.data);
      console.log('📈 Response Type:', typeof response);
      console.log('📈 Response.data Type:', typeof response.data);
      console.log('📈 Is Array?:', Array.isArray(response));
      console.log('📈 Response.data Is Array?:', Array.isArray(response.data));
      
      // Handle different response structures
      let invitesArray = [];
      if (Array.isArray(response)) {
        console.log('🔍 Response is a direct array');
        invitesArray = response;
      } else if (Array.isArray(response.data)) {
        console.log('🔍 Response.data is an array');
        invitesArray = response.data;
      } else if (response.data?.invites) {
        console.log('🔍 Response has data.invites structure');
        invitesArray = response.data.invites;
      } else if (response.invites) {
        console.log('🔍 Response has direct invites property');
        invitesArray = response.invites;
      } else {
        console.log('🔍 No recognizable invites structure, checking all response properties');
        console.log('Response keys:', Object.keys(response || {}));
        if (response.data) {
          console.log('Response.data keys:', Object.keys(response.data || {}));
        }
      }
      
      console.log('📋 Invites Array Length:', invitesArray.length);
      console.log('📋 First invite sample:', invitesArray[0]);
      
      if (invitesArray.length > 0) {
        invitesArray.forEach((invite, index) => {
          console.log(`📬 Invite ${index + 1}:`, {
            id: invite.id,
            memory_id: invite.memory_id,
            accept_reject: invite.accept_reject,
            memory_title: invite.memory?.title,
            memory_location: invite.memory?.location,
            sender_name: invite.sender?.name,
            counts: invite.counts,
            collaborators_length: invite.collaborators?.length,
            fullStructure: invite
          });
        });
      }
      
      return response;
    } catch (error) {
      console.error('❌ Error fetching invites:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  // Accept an invite
  static async acceptInvite(inviteId: number): Promise<any> {
    try {
      const response = await dashboardAPI.post(`/invites/${inviteId}/accept`);
      console.log('Accept invite response:', response);
      return response;
    } catch (error) {
      console.error('Error accepting invite:', error);
      throw error;
    }
  }

  // Reject an invite
  static async rejectInvite(inviteId: number): Promise<any> {
    try {
      const response = await dashboardAPI.post(`/invites/${inviteId}/reject`);
      console.log('Reject invite response:', response);
      return response;
    } catch (error) {
      console.error('Error rejecting invite:', error);
      throw error;
    }
  }

  // Get pending invites count
  static async getPendingInvitesCount(): Promise<number> {
    try {
      const response = await this.getInvites();
      return response.data?.counts?.pending || 0;
    } catch (error) {
      console.error('Error getting pending invites count:', error);
      return 0;
    }
  }

  // Check if user has pending invites
  static async hasPendingInvites(): Promise<boolean> {
    try {
      const count = await this.getPendingInvitesCount();
      return count > 0;
    } catch (error) {
      console.error('Error checking pending invites:', error);
      return false;
    }
  }
}