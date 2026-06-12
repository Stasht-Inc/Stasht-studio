export interface PasswordStrength {
  score: number; // 0-100
  level: 'weak' | 'medium' | 'strong';
  feedback: string[];
  meetsMinRequirements: boolean;
}

export const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return {
      score: 0,
      level: 'weak',
      feedback: ['Password is required'],
      meetsMinRequirements: false
    };
  }

  let score = 0;
  const feedback: string[] = [];
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)
  };

  // Length scoring (0-30 points)
  if (password.length >= 12) {
    score += 30;
  } else if (password.length >= 8) {
    score += 20;
  } else {
    score += Math.max(0, password.length * 2);
    feedback.push('Use at least 8 characters');
  }

  // Character variety scoring (0-40 points)
  if (checks.lowercase) score += 8;
  else feedback.push('Include lowercase letters');

  if (checks.uppercase) score += 8;
  else feedback.push('Include uppercase letters');

  if (checks.numbers) score += 8;
  else feedback.push('Include numbers');

  if (checks.symbols) score += 16;
  else feedback.push('Include special characters (!@#$%^&*)');

  // Pattern analysis (0-30 points)
  const hasRepeatingChars = /(.)\1{2,}/.test(password);
  const hasSequentialChars = /(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password);
  const hasCommonPatterns = /(password|123456|qwerty|admin|login|welcome)/i.test(password);

  if (!hasRepeatingChars) score += 10;
  else feedback.push('Avoid repeating characters');

  if (!hasSequentialChars) score += 10;
  else feedback.push('Avoid sequential characters');

  if (!hasCommonPatterns) score += 10;
  else feedback.push('Avoid common words or patterns');

  // Determine level and final feedback
  let level: 'weak' | 'medium' | 'strong';
  if (score >= 80) {
    level = 'strong';
  } else if (score >= 50) {
    level = 'medium';
  } else {
    level = 'weak';
  }

  // Clean up feedback for strong passwords
  if (level === 'strong' && feedback.length === 0) {
    feedback.push('Strong password!');
  }

  const meetsMinRequirements = checks.length && checks.lowercase && checks.uppercase && checks.numbers;

  return {
    score: Math.min(100, score),
    level,
    feedback,
    meetsMinRequirements
  };
};