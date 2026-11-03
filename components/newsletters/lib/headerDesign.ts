import type { LogoSize, NewsletterHeader } from '../../../services/newslettersAPI.ts';
import { contrastInk } from './colors.ts';
import { httpsUrl } from './urls.ts';

// Chris (3 Nov): a picture behind the header's logo and name, and the logo's size. Same keys and numbers as the
// API (NewsletterContent::LOGO_HEIGHTS, emails/newsletter/header.blade.php). Small is the 48 px every logo had
// before: it is not stored, so a header that never used these is exactly what it was.

export const LOGO_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const satisfies ReadonlyArray<{ value: LogoSize; label: string }>;

export const LOGO_HEIGHTS: Record<LogoSize, number> = { small: 48, medium: 80, large: 120 };

/** The dark layer over a background picture, so the white name reads on any photo. */
export const BACKGROUND_SHADE = 'rgba(17,24,39,0.45)';

const RATIO_MIN = 0.1;
const RATIO_MAX = 20;

export function logoSizeOf(header: NewsletterHeader): LogoSize {
  const size = header.logo_size;
  return size === 'medium' || size === 'large' ? size : 'small';
}

export function logoHeight(header: NewsletterHeader): number {
  return LOGO_HEIGHTS[logoSizeOf(header)];
}

/** The logo's width ÷ height (2 places), which the email needs to size a bigger logo; null for a broken image. */
export function logoRatioFrom(width: number, height: number): number | null {
  if (!(width > 0) || !(height > 0)) return null;
  const ratio = Math.round((width / height) * 100) / 100;
  return ratio >= RATIO_MIN && ratio <= RATIO_MAX ? ratio : null;
}

function without<K extends keyof NewsletterHeader>(header: NewsletterHeader, ...keys: K[]): NewsletterHeader {
  const out = { ...header };
  for (const key of keys) delete out[key];
  return out;
}

export function withLogoSize(header: NewsletterHeader, size: LogoSize, ratio: number | null): NewsletterHeader {
  const rest = without(header, 'logo_size', 'logo_ratio');
  if (size === 'small') return rest;
  return ratio === null ? { ...rest, logo_size: size } : { ...rest, logo_size: size, logo_ratio: ratio };
}

/** A bigger logo whose shape is not saved yet (or was another logo's): record it when the logo has loaded. */
export function needsLogoRatio(header: NewsletterHeader, ratio: number | null): boolean {
  return ratio !== null && logoSizeOf(header) !== 'small' && header.logo_ratio !== ratio;
}

/** A new (or no) logo: the old one's shape no longer applies; the chosen size stays. */
export function withLogo(header: NewsletterHeader, url: string | null): NewsletterHeader {
  const rest = without(header, 'logo_ratio');
  return url === null ? without({ ...rest, logo_url: null }, 'logo_size') : { ...rest, logo_url: url };
}

export function withBackgroundImage(header: NewsletterHeader, url: string | null): NewsletterHeader {
  const rest = without(header, 'background_image_url');
  return url === null ? rest : { ...rest, background_image_url: url };
}

/** The name's colour: white on a picture (under the dark layer), else whatever reads on the header colour. */
export function headerInk(color: string, hasPicture: boolean): '#1F2937' | '#FFFFFF' {
  return hasPicture ? '#FFFFFF' : contrastInk(color);
}

// One switch for the header background (3 Nov): Colour, or Image (a picture behind the logo and name, the colour
// kept as the fallback for email apps that hide images). Banners are no longer offered; an old one still draws
// and can be removed.
export type HeaderBackgroundMode = 'color' | 'image';

export const BACKGROUND_MODES = [
  { value: 'color', label: 'Colour' },
  { value: 'image', label: 'Image' },
] as const satisfies ReadonlyArray<{ value: HeaderBackgroundMode; label: string }>;

export function backgroundModeOf(header: NewsletterHeader): HeaderBackgroundMode {
  return httpsUrl(header.background_image_url) ? 'image' : 'color';
}

/** Colour takes the picture away; Image leaves the header as it is until a picture is uploaded. */
export function withBackgroundMode(header: NewsletterHeader, mode: HeaderBackgroundMode): NewsletterHeader {
  return mode === 'color' && 'background_image_url' in header ? withBackgroundImage(header, null) : header;
}

export function withoutBanner(header: NewsletterHeader): NewsletterHeader {
  return { ...header, banner_url: null };
}
