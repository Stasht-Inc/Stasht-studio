// Session validation utilities to prevent data leakage between users

interface SessionData {
  userId: string;
  identifier: string; // Can be email OR phone_number
  timestamp: number;
  tokenHash: string;
}

class SessionValidator {
  private static SESSION_KEY = 'stasht_session_validator';
  private static SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  // Generate a simple hash of the token for validation
  private static hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Initialize a new session
  // identifier can be email OR phone_number
  static initSession(userId: string, identifier: string, token: string): void {
    console.log('🟡 SessionValidator.initSession called with:', {
      userId,
      identifier,
      tokenLength: token.length
    });

    const sessionData: SessionData = {
      userId,
      identifier, // Can be email or phone_number
      timestamp: Date.now(),
      tokenHash: this.hashToken(token)
    };

    // Store in sessionStorage (cleared when browser closes)
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    console.log('🟡 Saved to sessionStorage');

    // Also store a backup in localStorage for validation
    localStorage.setItem(`${this.SESSION_KEY}_backup`, JSON.stringify(sessionData));
    console.log('🟡 Saved to localStorage backup');
  }

  // Validate current session against stored credentials
  // identifier can be email OR phone_number
  static validateSession(userId: string, identifier: string, token: string): boolean {
    console.log('🟡🟡🟡 ===== SessionValidator.validateSession STARTED =====');
    console.log('🟡 Input params:', { userId, identifier, tokenLength: token.length });

    try {
      // Check sessionStorage first
      const sessionStr = sessionStorage.getItem(this.SESSION_KEY);
      const backupStr = localStorage.getItem(`${this.SESSION_KEY}_backup`);

      console.log('🟡 Storage check:');
      console.log('  - sessionStorage exists:', !!sessionStr);
      console.log('  - localStorage backup exists:', !!backupStr);
      console.log('  - sessionStorage value:', sessionStr);
      console.log('  - localStorage backup value:', backupStr);

      if (!sessionStr && !backupStr) {
        console.log('❌ VALIDATION FAILED: No session data found in either storage');
        return false;
      }

      const dataSource = sessionStr ? 'sessionStorage' : 'localStorage backup';
      console.log('🟡 Using data from:', dataSource);

      const sessionData: SessionData = JSON.parse(sessionStr || backupStr || '{}');
      console.log('🟡 Parsed session data:', {
        userId: sessionData.userId,
        identifier: sessionData.identifier,
        timestamp: sessionData.timestamp,
        tokenHash: sessionData.tokenHash
      });

      // Check if session matches current user
      console.log('🟡 Checking user match...');
      console.log('  - Stored userId:', sessionData.userId, '| Current userId:', userId);
      console.log('  - Match?', sessionData.userId === userId);
      console.log('  - Stored identifier:', sessionData.identifier, '| Current identifier:', identifier);
      console.log('  - Match?', sessionData.identifier === identifier);

      if (sessionData.userId !== userId || sessionData.identifier !== identifier) {
        console.log('❌ VALIDATION FAILED: Session user mismatch detected!', {
          stored: { userId: sessionData.userId, identifier: sessionData.identifier },
          current: { userId, identifier }
        });
        return false;
      }

      console.log('✅ User data matches');

      // Check token hash
      console.log('🟡 Checking token hash...');
      const currentTokenHash = this.hashToken(token);
      console.log('  - Stored token hash:', sessionData.tokenHash);
      console.log('  - Current token hash:', currentTokenHash);
      console.log('  - Match?', sessionData.tokenHash === currentTokenHash);

      if (sessionData.tokenHash !== currentTokenHash) {
        console.log('❌ VALIDATION FAILED: Token mismatch detected!');
        return false;
      }

      console.log('✅ Token hash matches');

      // Check session timeout
      console.log('🟡 Checking session timeout...');
      const sessionAge = Date.now() - sessionData.timestamp;
      const timeoutMinutes = this.SESSION_TIMEOUT / (60 * 1000);
      console.log('  - Session age (ms):', sessionAge);
      console.log('  - Session age (minutes):', (sessionAge / (60 * 1000)).toFixed(2));
      console.log('  - Timeout limit (minutes):', timeoutMinutes);
      console.log('  - Expired?', sessionAge > this.SESSION_TIMEOUT);

      if (sessionAge > this.SESSION_TIMEOUT) {
        console.log('❌ VALIDATION FAILED: Session timeout exceeded');
        return false;
      }

      console.log('✅ Session not timed out');

      // Update timestamp for activity
      console.log('🟡 Updating session timestamp...');
      sessionData.timestamp = Date.now();
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
      localStorage.setItem(`${this.SESSION_KEY}_backup`, JSON.stringify(sessionData));
      console.log('✅ Session timestamp updated');

      console.log('✅✅✅ VALIDATION PASSED - All checks successful');
      console.log('🟡🟡🟡 ===== SessionValidator.validateSession COMPLETED =====');
      return true;
    } catch (error) {
      console.error('❌❌❌ VALIDATION FAILED: Session validation exception:', error);
      console.error('❌ Error details:', error);
      return false;
    }
  }

  // Clear all session data
  static clearSession(): void {
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(`${this.SESSION_KEY}_backup`);

    // Clear all app-related sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('stasht_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  }

  // Check if there's an active session
  static hasActiveSession(): boolean {
    const sessionStr = sessionStorage.getItem(this.SESSION_KEY);
    const backupStr = localStorage.getItem(`${this.SESSION_KEY}_backup`);

    if (!sessionStr && !backupStr) {
      return false;
    }

    try {
      const sessionData: SessionData = JSON.parse(sessionStr || backupStr || '{}');
      const sessionAge = Date.now() - sessionData.timestamp;
      return sessionAge <= this.SESSION_TIMEOUT;
    } catch {
      return false;
    }
  }

  // Get current session user info
  static getCurrentSessionUser(): { userId: string; identifier: string } | null {
    try {
      const sessionStr = sessionStorage.getItem(this.SESSION_KEY);
      const backupStr = localStorage.getItem(`${this.SESSION_KEY}_backup`);

      if (!sessionStr && !backupStr) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionStr || backupStr || '{}');
      return {
        userId: sessionData.userId,
        identifier: sessionData.identifier // Can be email or phone_number
      };
    } catch {
      return null;
    }
  }
}

export default SessionValidator;