import type React from 'react';
import { ArrowRight, Calendar, Download, ExternalLink, Gift, Heart, Link, Mail, MapPin, Phone, Play, Send, ShoppingCart, Star, Upload } from 'lucide-react';

// A Call to Action widget's settings, shared by the campaign page (pages/MemoryDetailsPage.tsx: its CTA card and
// editor) and Create Storeel (Deepak 24 Nov 2026, P1: the same editor works there before the campaign exists).
//
// `mode` distinguishes the two things a CTA can be:
//   'link'           — the normal CTA: the button opens buttonLink
//   'request_moment' — "Share Request a Moment": the button opens the photo/caption
//                      submission form on the published page. It has no URL, so the
//                      link field is hidden and its icon is fixed to Upload.
// Stored as widget_type 'cta' either way, so the API needs no new widget type.
export type CtaMode = 'link' | 'request_moment';

// Fixed icon set offered for CTA buttons (key must match the imported lucide component)
export const CTA_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties; className?: string }>> = {
  ArrowRight, ExternalLink, Link, ShoppingCart, Phone, Mail, Calendar, Download, Play, Heart, Star, Gift, MapPin, Send, Upload,
};
// Upload is registered above but kept out of the picker: it is the fixed icon for
// "Share Request a Moment", whose icon is not user-selectable.
export const CTA_ICON_KEYS = Object.keys(CTA_ICONS).filter((k) => k !== 'Upload');
// The icon a "Share Request a Moment" button always uses.
export const CTA_REQUEST_MOMENT_ICON = 'Upload';
export const CTA_DEFAULT_BUTTON_COLOR = '#6C60FF';
export const CTA_DEFAULT_TEXT_COLOR = '#FFFFFF';
export const CTA_DEFAULT_ICON_SIZE = 18;
export const CTA_DEFAULT_FONT_SIZE = 16;
export const CTA_DEFAULT_BUTTON_WIDTH = 0; // 0 = full width (fills card); otherwise fixed width in px
export const CTA_DEFAULT_BORDER_RADIUS = 12; // button corner radius in px (rounded by default)

// Heading for the CTA modal, which serves both CTA kinds.
export function ctaModalNoun(isRequestMoment: boolean, isEditing: boolean): string {
  const noun = isRequestMoment ? 'Share Request a Moment' : 'Call to Action';
  return `${isEditing ? 'Edit' : 'Add'} ${noun}`;
}

// Ensure the URL has a scheme so the anchor navigates to an absolute address
export function ctaNormalizeUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
// Valid only if it parses as an http(s) URL (scheme optional in input; we prepend https://)
export function ctaIsValidUrl(url: string): boolean {
  const u = (url || '').trim();
  if (!u) return false;
  try {
    const parsed = new URL(ctaNormalizeUrl(u));
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/** The CTA editor's fields (the campaign page keeps each in its own state; Create Storeel keeps one object). */
export interface CtaForm {
  title: string;
  buttonText: string;
  buttonLink: string;
  buttonColor: string;
  textColor: string;
  icon: string;
  iconSize: number;
  fontSize: number;
  buttonWidth: number;
  borderRadius: number;
  pinToBottom: boolean;
}

export const emptyCtaForm = (): CtaForm => ({
  title: '', buttonText: '', buttonLink: '', buttonColor: CTA_DEFAULT_BUTTON_COLOR, textColor: CTA_DEFAULT_TEXT_COLOR, icon: '',
  iconSize: CTA_DEFAULT_ICON_SIZE, fontSize: CTA_DEFAULT_FONT_SIZE, buttonWidth: CTA_DEFAULT_BUTTON_WIDTH, borderRadius: CTA_DEFAULT_BORDER_RADIUS, pinToBottom: false,
});

/** "Share Request a Moment" opens the editor with its fixed icon and words (the campaign page's openAddRequestMomentCta). */
export const requestMomentCtaForm = (): CtaForm => ({ ...emptyCtaForm(), icon: CTA_REQUEST_MOMENT_ICON, buttonText: 'Share a Moment' });

/** The widget_data the campaign page sends for a CTA (its editor's Save). */
export function ctaWidgetData(form: CtaForm, mode: CtaMode) {
  const isRequestMoment = mode === 'request_moment';
  return {
    title: form.title,
    buttonText: form.buttonText,
    // A request-moment button has no destination.
    buttonLink: isRequestMoment ? '' : ctaNormalizeUrl(form.buttonLink),
    mode,
    buttonColor: form.buttonColor,
    textColor: form.textColor,
    icon: form.icon,
    iconSize: form.iconSize,
    buttonWidth: form.buttonWidth,
    fontSize: form.fontSize,
    borderRadius: form.borderRadius,
    // Only meaningful for the request-moment mode, but harmless to include either way.
    pinToBottom: form.pinToBottom,
  };
}

/** A YouTube link's video id (watch, youtu.be, embed, shorts), else null — as the campaign page's editor reads it. */
export function youtubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
