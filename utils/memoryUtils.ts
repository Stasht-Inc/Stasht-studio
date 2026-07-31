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

// AI Creator widget text comes back from the LLM as HTML (e.g. a <span style="font-size:26px;">
// wrapper for emphasis). The prompt driving that generation is user-controlled, so it's sanitized
// to an inline-formatting allowlist before ever reaching dangerouslySetInnerHTML — only font-size/
// color/font-weight survive on the style attribute, everything else (script, event handlers, src/href) is stripped.
const AI_CREATOR_ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'span', 'p']);
const AI_CREATOR_SAFE_STYLE_DECL = /^(?:font-size:\s*\d{1,3}(?:px|em|rem|%)|color:\s*(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})|font-weight:\s*(?:bold|normal|\d{3}))$/;

export function sanitizeAiCreatorText(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z-]+(?:="[^"]*")?)*)\s*\/?>/g, (_match, closing, tagRaw, attrs) => {
    const tag = tagRaw.toLowerCase();
    if (!AI_CREATOR_ALLOWED_TAGS.has(tag)) return '';
    if (closing) return `</${tag}>`;
    if (tag === 'span' || tag === 'p') {
      const styleMatch = /\sstyle="([^"]*)"/i.exec(attrs);
      if (styleMatch) {
        const safeDecls = styleMatch[1]
          .split(';')
          .map(d => d.trim())
          .filter(d => d && AI_CREATOR_SAFE_STYLE_DECL.test(d));
        if (safeDecls.length) return `<${tag} style="${safeDecls.join('; ')}">`;
      }
      return `<${tag}>`;
    }
    return `<${tag}>`;
  });
}