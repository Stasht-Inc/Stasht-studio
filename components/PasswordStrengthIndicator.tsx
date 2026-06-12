import React from 'react';
import { calculatePasswordStrength, PasswordStrength } from '../utils/passwordStrength';

interface PasswordStrengthIndicatorProps {
  password: string;
  showFeedback?: boolean;
  className?: string;
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showFeedback = true,
  className = ''
}) => {
  const strength = calculatePasswordStrength(password);

  if (!password) {
    return null;
  }

  const getStrengthColor = (level: PasswordStrength['level']) => {
    switch (level) {
      case 'weak':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-orange-600 bg-orange-100';
      case 'strong':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressColor = (level: PasswordStrength['level']) => {
    switch (level) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-orange-500';
      case 'strong':
        return 'bg-green-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStrengthText = (level: PasswordStrength['level']) => {
    switch (level) {
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
      default:
        return '';
    }
  };

  return (
    <div className={`mt-2 ${className}`}>
      {/* Progress Bar */}
      <div className="flex gap-1 mb-2">
        {[1, 2, 3, 4].map((segment) => {
          const isActive = strength.score >= (segment * 25);
          return (
            <div
              key={segment}
              className={`h-2 flex-1 rounded-full transition-colors duration-200 ${
                isActive 
                  ? getProgressColor(strength.level)
                  : 'bg-gray-200'
              }`}
            />
          );
        })}
      </div>

      {/* Strength Level Badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStrengthColor(strength.level)}`}>
          {getStrengthText(strength.level)}
        </span>
        <span className="text-xs text-gray-500">
          {strength.score}/100
        </span>
      </div>

      {/* Feedback Messages */}
      {showFeedback && strength.feedback.length > 0 && (
        <div className="mt-2">
          <ul className="text-xs text-gray-600 space-y-1">
            {strength.feedback.slice(0, 3).map((message, index) => (
              <li key={index} className="flex items-start">
                <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 mr-2 flex-shrink-0 ${
                  strength.level === 'strong' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;