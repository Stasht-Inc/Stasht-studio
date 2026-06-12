import { Lock, FileText, Users, Globe } from "lucide-react";

export const getCategoryColor = (category: string) => {
  const categoryColorMap: { [key: string]: { bg: string; text: string; border: string } } = {
    'Personal': {
      bg: 'bg-[#6C60FF]/10',
      text: 'text-[#6C60FF]',
      border: 'border-[#6C60FF]/20'
    },
    'Shared With': {
      bg: 'bg-[#3B82F6]/10',
      text: 'text-[#3B82F6]',
      border: 'border-[#3B82F6]/20'
    },
    'Published': {
      bg: 'bg-[#EC4899]/10',
      text: 'text-[#EC4899]',
      border: 'border-[#EC4899]/20'
    },
  };
  
  return categoryColorMap[category] || {
    bg: 'bg-[#6C60FF]/10',
    text: 'text-[#6C60FF]',
    border: 'border-[#6C60FF]/20'
  };
};

// Legacy function for backward compatibility (returns hex colors)
export const getCategoryColorHex = (category: string): string => {
  const categoryColorMap: { [key: string]: string } = {
    'Personal': '#6C60FF',     // Purple (brand color)
    'Shared With': '#3B82F6',  // Blue
    'Published': '#EC4899',    // Pink
  };
  
  return categoryColorMap[category] || '#6C60FF';
};

export const getCategoryIcon = (category: string) => {
  const iconMap: { [key: string]: any } = {
    'Personal': Lock,
    'Shared With': Users,
    'Published': Globe,
  };
  
  return iconMap[category] || FileText;
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};