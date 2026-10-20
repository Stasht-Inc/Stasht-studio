import { httpsUrl } from './urls.ts';

/** The sender's e-card, as the newsletter footer shows it (same fields as the Storeel e-card). */
export interface SenderProfile {
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  /** The account's avatar colour (stored auth user's profile_color), for the initials circle. */
  color: string | null;
  website: { text: string; href: string | null } | null;
  socials: Array<{ key: string; url: string; icon: string; label: string }>;
}

const SOCIALS = [
  { key: 'instagram', field: 'instagram_url', icon: '/social-instagram.png', label: 'Instagram' },
  { key: 'linkedin', field: 'linkedin_url', icon: '/social-linkedin.png', label: 'LinkedIn' },
  { key: 'tiktok', field: 'tiktok_url', icon: '/social-tiktok.png', label: 'TikTok' },
  { key: 'facebook', field: 'facebook_url', icon: '/social-facebook.png', label: 'Facebook' },
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const isFilled = (value: unknown): boolean =>
  value !== null && value !== undefined && !(typeof value === 'string' && value.trim() === '');

/**
 * The stored auth user (localStorage stasht_user: avatar/profile_image, phone_number, profile_color) with
 * GET /user/profile's user laid over it. Empty API values never hide a stored one.
 */
export function mergeProfileSources(stored: unknown, api: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (stored && typeof stored === 'object') Object.assign(out, stored as Record<string, unknown>);
  if (api && typeof api === 'object') {
    for (const [key, value] of Object.entries(api as Record<string, unknown>)) {
      if (isFilled(value)) out[key] = value;
    }
  }
  return out;
}

/** From GET /user/profile's user (`phone`, `avatar`) or the stored auth user (`phone_number`, `profile_image`). */
export function profileFromApi(raw: unknown): SenderProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (key: string): string | null => {
    const value = r[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const site = str('website');
  const color = str('profile_color');
  return {
    name: str('name') ?? '',
    email: str('email'),
    phone: str('phone') ?? str('phone_number'),
    photoUrl: httpsUrl(str('avatar') ?? str('profile_image')),
    color: color && HEX.test(color) ? color : null,
    website: site
      ? { text: site.replace(/^https?:\/\//i, '').replace(/\/$/, ''), href: httpsUrl(/^[a-z][a-z0-9+.-]*:/i.test(site) ? site : `https://${site}`) }
      : null,
    socials: SOCIALS.flatMap((s) => {
      const url = httpsUrl(str(s.field));
      return url ? [{ key: s.key, url, icon: s.icon, label: s.label }] : [];
    }),
  };
}

export function initialsFrom(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
