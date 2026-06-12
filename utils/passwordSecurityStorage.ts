import { calculatePasswordStrength } from './passwordStrength';

interface PasswordSecurityData {
  strength: 'weak' | 'medium' | 'strong';
  lastChanged: string;
  timestamp: number;
}

const STORAGE_KEY = 'password_security_data';
const ACCOUNT_CREATED_KEY = 'account_created_timestamp';

// Initialize account creation timestamp (called when user first logs in)
export const initializeAccountCreation = (): void => {
  if (!localStorage.getItem(ACCOUNT_CREATED_KEY)) {
    localStorage.setItem(ACCOUNT_CREATED_KEY, Date.now().toString());
  }
};

// Get account creation timestamp
const getAccountCreatedTimestamp = (): number => {
  const stored = localStorage.getItem(ACCOUNT_CREATED_KEY);
  return stored ? parseInt(stored) : Date.now();
};

export const savePasswordSecurity = (password: string): void => {
  const strength = calculatePasswordStrength(password);
  const now = new Date();
  
  const data: PasswordSecurityData = {
    strength: strength.level,
    lastChanged: 'Just now',
    timestamp: now.getTime()
  };
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getPasswordSecurity = (): PasswordSecurityData => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // For new accounts, use account creation timestamp as password creation time
      const accountCreatedTimestamp = getAccountCreatedTimestamp();
      
      const newAccountData: PasswordSecurityData = {
        strength: 'weak',
        lastChanged: 'Just now', // Will be recalculated below
        timestamp: accountCreatedTimestamp
      };
      
      // Store this initial data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccountData));
      
      // Calculate time since account creation for display
      const now = Date.now();
      const timeDiff = now - accountCreatedTimestamp;
      const minutes = Math.floor(timeDiff / (1000 * 60));
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const weeks = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7));
      const months = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 30));
      
      let lastChanged: string;
      if (minutes < 1) {
        lastChanged = 'Just now';
      } else if (minutes < 60) {
        lastChanged = `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      } else if (hours < 24) {
        lastChanged = `${hours} hour${hours === 1 ? '' : 's'} ago`;
      } else if (days < 7) {
        lastChanged = `${days} day${days === 1 ? '' : 's'} ago`;
      } else if (weeks < 4) {
        lastChanged = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
      } else {
        lastChanged = `${months} month${months === 1 ? '' : 's'} ago`;
      }
      
      return {
        ...newAccountData,
        lastChanged
      };
    }
    
    const data: PasswordSecurityData = JSON.parse(stored);
    
    // Calculate time since last change
    const now = Date.now();
    const timeDiff = now - data.timestamp;
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7));
    const months = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 30));
    
    let lastChanged: string;
    if (minutes < 1) {
      lastChanged = 'Just now';
    } else if (minutes < 60) {
      lastChanged = `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else if (hours < 24) {
      lastChanged = `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (days < 7) {
      lastChanged = `${days} day${days === 1 ? '' : 's'} ago`;
    } else if (weeks < 4) {
      lastChanged = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    } else {
      lastChanged = `${months} month${months === 1 ? '' : 's'} ago`;
    }
    
    return {
      ...data,
      lastChanged
    };
  } catch (error) {
    console.error('Error reading password security data:', error);
    return {
      strength: 'weak',
      lastChanged: 'Just now',
      timestamp: Date.now()
    };
  }
};

export const clearPasswordSecurity = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};