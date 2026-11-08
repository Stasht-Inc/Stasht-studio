import React from 'react';
import { ArrowRight, Calendar, Download, Edit, ExternalLink, Gift, Heart, Link, Mail, MapPin, MoreVertical, Phone, Play, Send, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { dashboardAPI } from '../utils/authUtils';

/**
 * Chris, 8 Nov 2026 (point 3): a product moment's "View on website" button, drawn INSIDE the moment card under the
 * product details (no second card, no repeated title). It is the product's own CTA widget (utils/productCardButton),
 * so it keeps that widget's link, words and colours (an owner's edits still show) and its click count.
 */

// The CTA icon set (MemoryDetailsPage's CTA_ICONS, without the request-moment Upload icon).
const ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties; className?: string }>> = {
  ArrowRight, ExternalLink, Link, ShoppingCart, Phone, Mail, Calendar, Download, Play, Heart, Star, Gift, MapPin, Send,
};

export interface ProductCardButtonData {
  id: string | number;
  buttonText?: string | null;
  buttonLink?: string | null;
  buttonColor?: string | null;
  /** 0 / empty = full width; otherwise the owner's width in px (never wider than the card). */
  buttonWidth?: number | null;
  textColor?: string | null;
  icon?: string | null;
  iconSize?: number | null;
  fontSize?: number | null;
  borderRadius?: number | null;
}

/** A raw API widget ({ id, widget_data }) as the button's data. */
export function productButtonData(w: { id: string | number; widget_data?: Record<string, any> | null }): ProductCardButtonData {
  const d = w.widget_data || {};
  return { id: w.id, buttonText: d.buttonText, buttonLink: d.buttonLink, buttonColor: d.buttonColor, buttonWidth: d.buttonWidth, textColor: d.textColor, icon: d.icon, iconSize: d.iconSize, fontSize: d.fontSize, borderRadius: d.borderRadius };
}

/** http(s) only, scheme added when missing (as the CTA card does); '' when there is no usable link. */
function href(link: string | null | undefined): string {
  const u = (link || '').trim();
  if (!u) return '';
  const full = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const parsed = new URL(full);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? full : '';
  } catch {
    return '';
  }
}

export default function ProductCardButton({ button, memoryId, onClick, onEdit, onDelete, anchorRef, isActive = false, className = '' }: {
  button: ProductCardButtonData;
  /** For the widget's click count (the same call the CTA card makes). */
  memoryId?: string | number | null;
  /** Extra click handler (the published page's Storeel beacon). */
  onClick?: () => void;
  /** Owner views that offered Edit / Delete on the button's card (the phone timeline) keep them here. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** So the timeline's nav entry for this button can still scroll to it. */
  anchorRef?: (el: HTMLDivElement | null) => void;
  /** Its sidebar entry is the selected one: the purple outline the separate card had. */
  isActive?: boolean;
  className?: string;
}) {
  const link = href(button.buttonLink);
  // As the CTA card: the owner's icon, or none when they chose none.
  const Icon = button.icon ? ICONS[button.icon] : undefined;
  const width = button.buttonWidth ? `${button.buttonWidth}px` : undefined;
  const size = button.iconSize || 18;
  const style: React.CSSProperties = {
    backgroundColor: button.buttonColor || '#6C60FF',
    color: button.textColor || '#FFFFFF',
    fontSize: button.fontSize || 16,
    borderRadius: `${button.borderRadius ?? 12}px`,
    ...(width ? { width, maxWidth: '100%' } : {}),
  };
  const track = () => {
    onClick?.();
    if (!memoryId || !button.id) return;
    try { dashboardAPI.trackWidgetClick(String(memoryId), String(button.id)).catch(() => {}); } catch { /* ignore */ }
  };
  const hasMenu = !!(onEdit || onDelete);
  return (
    <div
      ref={anchorRef}
      data-product-card-button={String(button.id)}
      data-active={isActive ? 'true' : undefined}
      className={`flex items-center gap-2 rounded-xl ${width ? 'justify-center' : ''} ${isActive ? 'ring-2 ring-[#6C60FF] ring-offset-2' : ''} ${className}`}
    >
      <a
        href={link || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.stopPropagation(); if (!link) e.preventDefault(); track(); }}
        className={`flex min-w-0 items-center justify-center gap-2 px-6 py-3 font-semibold no-underline transition-opacity hover:opacity-90 ${width ? '' : 'flex-1'}`}
        style={style}
      >
        {Icon && <Icon style={{ width: size, height: size }} className="flex-shrink-0" />}
        <span className="truncate">{button.buttonText || 'View on website'}</span>
      </a>
      {hasMenu && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Button actions" className="flex h-11 w-9 flex-shrink-0 items-center justify-center rounded-md hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-5 w-5 text-[#6C60FF]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-44 rounded-lg border border-gray-200 bg-white p-1 shadow-lg" sideOffset={4}>
            {onEdit && (
              <div className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="h-4 w-4 text-[#6C60FF]" /><span className="text-sm text-gray-700">Edit</span>
              </div>
            )}
            {onDelete && (
              <div className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
                <Trash2 className="h-4 w-4 text-red-500" /><span className="text-sm text-red-500">Delete</span>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
