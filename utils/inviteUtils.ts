// Utility functions for handling collaborator invite links

export interface InviteParams {
  invite: string;
  memory_id: string;
  title: string;
  image_link: string;
  user_name: string;
  profile_image: string;
  email: string;
  collaborator: string;
  login: string;
}

// QR Code invite params (no specific collaborator - anyone can join)
export interface QrInviteParams {
  invite: string;
  memory_id: string;
  role: 'view' | 'edit' | 'admin';
}

// Get base URL for invite links (environment-aware)
export const getBaseUrl = (): string => {
  // Use environment variable if set
  if (import.meta.env.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL;
  }
  
  // Development: use localhost with current port
  if (import.meta.env.DEV) {
    return `http://localhost:${window.location.port || '5176'}`;
  }
  
  // Production: use current origin
  return window.location.origin;
};

// Parse query parameters from URL
export const parseUrlParams = (): URLSearchParams => {
  return new URLSearchParams(window.location.search);
};

// Check if current URL is an invite link
export const isInviteLink = (): boolean => {
  const params = parseUrlParams();
  return params.get('invite') === '1';
};

// Extract invite parameters from URL
export const getInviteParams = (): Partial<InviteParams> | null => {
  const params = parseUrlParams();
  
  if (!isInviteLink()) {
    return null;
  }
  
  return {
    invite: params.get('invite') || '',
    memory_id: params.get('memory_id') || '',
    title: params.get('title') || '',
    image_link: params.get('image_link') || '',
    user_name: params.get('user_name') || '',
    profile_image: params.get('profile_image') || '',
    email: params.get('email') || '',
    collaborator: params.get('collaborator') || '',
    login: params.get('login') || ''
  };
};

// Generate invite link
export const generateInviteLink = (params: InviteParams): string => {
  const baseUrl = getBaseUrl();
  const urlParams = new URLSearchParams({
    invite: '1',
    memory_id: params.memory_id,
    title: params.title,
    image_link: params.image_link,
    user_name: params.user_name,
    profile_image: params.profile_image,
    email: params.email,
    collaborator: params.collaborator,
    login: '1'
  });
  
  return `${baseUrl}/login?${urlParams.toString()}`;
};

// Clear invite parameters from URL
export const clearInviteParams = (): void => {
  const url = new URL(window.location.href);
  const inviteParamKeys = [
    'invite',
    'memory_id', 
    'title',
    'image_link',
    'user_name',
    'profile_image', 
    'email',
    'collaborator',
    'login'
  ];
  
  inviteParamKeys.forEach(key => url.searchParams.delete(key));
  
  // Update URL without page reload
  window.history.replaceState({}, '', url.toString());
};

// Check if user email matches collaborator email
export const isCorrectCollaborator = (userEmail: string, collaboratorEmail: string): boolean => {
  // Handle null/undefined/empty values
  if (!userEmail || !collaboratorEmail) {
    console.log('🔍 [isCorrectCollaborator] Empty value detected:', { userEmail, collaboratorEmail });
    return false;
  }

  // Normalize both emails: decode URI, trim whitespace, lowercase
  const normalizeEmail = (email: string): string => {
    try {
      // Decode URI component (handles %40 -> @, etc.)
      const decoded = decodeURIComponent(email);
      // Trim whitespace and convert to lowercase
      return decoded.trim().toLowerCase();
    } catch (e) {
      console.error('🔍 [isCorrectCollaborator] Error decoding email:', email, e);
      // Fallback: just trim and lowercase
      return email.trim().toLowerCase();
    }
  };

  const normalizedUser = normalizeEmail(userEmail);
  const normalizedCollaborator = normalizeEmail(collaboratorEmail);

  console.log('🔍 [isCorrectCollaborator] Comparing:', {
    original: { userEmail, collaboratorEmail },
    normalized: { normalizedUser, normalizedCollaborator },
    match: normalizedUser === normalizedCollaborator
  });

  return normalizedUser === normalizedCollaborator;
};

// Check if a string is an email or phone number
export const isEmail = (value: string): boolean => {
  return value.includes('@');
};

export const isPhoneNumber = (value: string): boolean => {
  return !value.includes('@') && /^\+?[\d\s-()]+$/.test(value);
};

// QR Code invite utilities

// Check if current URL is a QR invite link (has invite=1 and role but NO collaborator field)
export const isQrInviteLink = (): boolean => {
  const params = parseUrlParams();
  return params.get('invite') === '1' && params.has('role') && !params.has('collaborator');
};

// Extract QR invite parameters from URL
export const getQrInviteParams = (): Partial<QrInviteParams> | null => {
  const params = parseUrlParams();

  if (!isQrInviteLink()) {
    return null;
  }

  return {
    invite: params.get('invite') || '',
    memory_id: params.get('memory_id') || '',
    role: (params.get('role') as 'view' | 'edit' | 'admin') || 'view'
  };
};

// Generate QR invite link (for anyone to scan and join)
export const generateQrInviteLink = (memoryId: string, role: 'view' | 'edit' | 'admin'): string => {
  const baseUrl = getBaseUrl();
  const urlParams = new URLSearchParams({
    invite: '1',
    memory_id: memoryId,
    role: role
  });

  return `${baseUrl}/memory?${urlParams.toString()}`;
};

// Clear QR invite parameters from URL
export const clearQrInviteParams = (): void => {
  const url = new URL(window.location.href);
  const qrInviteParamKeys = ['invite', 'memory_id', 'role'];

  qrInviteParamKeys.forEach(key => url.searchParams.delete(key));

  // Update URL without page reload
  window.history.replaceState({}, '', url.toString());
};