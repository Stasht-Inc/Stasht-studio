// Chris (5 Nov, points 2 and 3): the Title and Text sections' style toolbar. Title: one size dropdown, alignment, text
// colour, section background colour or picture. Text: font size on the words, alignment, text colour, section
// background colour. The same keys, rules and numbers as the API (NewsletterContent::sectionStyle,
// NewsletterRenderer::section, NewsletterHtmlSanitizer::FONT_SIZES), so the editor draws what the email shows. Pure.
import type { SectionAlign, SectionStyle, TitleSize } from '../../../services/newslettersAPI.ts';
import { safeHexColor } from './colors.ts';
import { httpsUrl } from './urls.ts';
import { paddingPx, spacingOf } from './sectionSpacing.ts';

export const TITLE_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const satisfies ReadonlyArray<{ value: TitleSize; label: string }>;

export const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
] as const satisfies ReadonlyArray<{ value: SectionAlign; label: string }>;

export type TextSize = 'small' | 'normal' | 'large' | 'xlarge';
/** The Text toolbar's font sizes and the line height the email gives each (NewsletterHtmlSanitizer::FONT_SIZES). */
export const TEXT_SIZES = [
  { value: 'small', label: 'Small', px: 14, lineHeight: 22 },
  { value: 'normal', label: 'Normal', px: 16, lineHeight: 26 },
  { value: 'large', label: 'Large', px: 20, lineHeight: 30 },
  { value: 'xlarge', label: 'X-Large', px: 24, lineHeight: 34 },
] as const satisfies ReadonlyArray<{ value: TextSize; label: string; px: number; lineHeight: number }>;

export function textSizeOf(px: number): (typeof TEXT_SIZES)[number] | null {
  return TEXT_SIZES.find((s) => s.px === px) ?? null;
}

/** Section backgrounds: three soft tints first (what newsletters mostly use behind words), then the usual six. */
export const BACKGROUND_SWATCHES: ReadonlyArray<{ value: string; name: string }> = [
  { value: '#F3F4F6', name: 'Light grey' },
  { value: '#EEEDFF', name: 'Light purple' },
  { value: '#FEF3C7', name: 'Cream' },
  { value: '#6C60FF', name: 'Purple' },
  { value: '#111827', name: 'Black' },
  { value: '#2563EB', name: 'Blue' },
  { value: '#059669', name: 'Green' },
  { value: '#DC2626', name: 'Red' },
  { value: '#F59E0B', name: 'Orange' },
];

/** The words' usual colours (title.blade.php / text.blade.php). */
export const TITLE_INK = '#111827';
export const TEXT_INK = '#374151';
/** On a picture: the header's dark layer and soft shadow (NewsletterRenderer::IMAGE_SHADE / IMAGE_SHADOW). */
export const IMAGE_SHADE = 'rgba(17,24,39,0.55)';
export const IMAGE_SHADOW = '0 1px 3px rgba(0,0,0,0.5)';
/** A picture's fallback colour when none is picked (NewsletterRenderer::IMAGE_FALLBACK). */
export const IMAGE_FALLBACK = '#111827';
const LINK = '#6C60FF';

const ALIGNS: readonly SectionAlign[] = ['left', 'center', 'right'];
const hex = (v: unknown): string | null => {
  const c = safeHexColor(v, '');
  return c ? c.toUpperCase() : null;
};

/** The style keys worth keeping: valid, tidied, never left / blank (API NewsletterContent::sectionStyle). */
export function sectionStyleOf(data: Record<string, unknown>, allowImage: boolean): SectionStyle {
  const out: SectionStyle = {};
  const align = data.align;
  if (typeof align === 'string' && ALIGNS.includes(align as SectionAlign) && align !== 'left') out.align = align as SectionAlign;
  const color = hex(data.color);
  if (color) out.color = color;
  const bg = hex(data.background_color);
  if (bg) out.background_color = bg;
  const picture = allowImage ? httpsUrl(data.background_image_url) : null;
  if (picture) out.background_image_url = picture;
  return out;
}

/** A change to the style: a value sets its key, left / null takes it away, so an unstyled block looks like an old one. */
export function withSectionStyle<D extends Record<string, unknown>>(data: D, patch: { align?: SectionAlign; color?: string | null; background_color?: string | null; background_image_url?: string | null }): D {
  const out: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(patch)) {
    const keep = key === 'align' ? (value !== 'left' && ALIGNS.includes(value as SectionAlign) ? value : null)
      : key === 'background_image_url' ? httpsUrl(value)
        : hex(value);
    if (keep === null || keep === undefined) delete out[key];
    else out[key] = keep;
  }
  return out as D;
}

/** The same change as an editor patch (onChange merges it): a removed key is undefined, which JSON leaves out. */
export function stylePatch(patch: { align?: SectionAlign; color?: string | null; background_color?: string | null; background_image_url?: string | null }): Partial<SectionStyle> {
  const out: Record<string, unknown> = {};
  const kept = withSectionStyle({}, patch) as Record<string, unknown>;
  for (const key of Object.keys(patch)) out[key] = kept[key];
  return out as Partial<SectionStyle>;
}

export type TitleBackgroundMode = 'color' | 'image';
export const TITLE_BACKGROUND_MODES = [
  { value: 'color', label: 'Colour' },
  { value: 'image', label: 'Image' },
] as const satisfies ReadonlyArray<{ value: TitleBackgroundMode; label: string }>;

export function titleBackgroundModeOf(data: Record<string, unknown>): TitleBackgroundMode {
  return httpsUrl(data.background_image_url) ? 'image' : 'color';
}

/** Colour takes the picture away; Image leaves the section as it is until a picture is uploaded (as the header). */
export function withTitleBackgroundMode<D extends Record<string, unknown>>(data: D, mode: TitleBackgroundMode): D {
  return mode === 'color' && 'background_image_url' in data ? withSectionStyle(data, { background_image_url: null }) : data;
}

export interface SectionLook {
  /** Any style key: the email draws it with section.blade.php. */
  styled: boolean;
  align: SectionAlign;
  /** The band's colour (none when there is a picture: that colour is its fallback then). */
  bg: string | null;
  image: string | null;
  fallback: string | null;
  /** The words' colour: the one picked, else white on a picture or a dark band, else the usual. */
  ink: string;
  /** Room above and below, px: 12 as before, 24 on a band, 40 on a picture; less or more with padding (Chris, 7 Nov). */
  padY: number;
  /** Links: purple, or the words' colour on a band that needs other words' colour. */
  link: string;
}

/** WCAG contrast ratio of two #RRGGBB colours, 1 to 21 (NewsletterRenderer::contrastRatio). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hexColor: string) => {
    const n = parseInt(hexColor.replace('#', ''), 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Automatic words on a band: the usual colour, else white, else near-black, the first at 4.5:1; else the most contrast. */
export function readableInk(bg: string, defaultInk: string): string {
  const candidates = [...new Set([defaultInk, '#FFFFFF', '#111827'])];
  return candidates.find((ink) => contrastRatio(bg, ink) >= 4.5)
    ?? [...candidates].sort((x, y) => contrastRatio(bg, y) - contrastRatio(bg, x))[0];
}

/** A picked text colour that is hard to read on the band (under 4.5:1): the panels say so. */
export function poorContrast(color: string | null | undefined, bg: string | null | undefined): boolean {
  const c = hex(color);
  const b = hex(bg);
  return !!c && !!b && contrastRatio(c, b) < 4.5;
}

/** How the section looks (NewsletterRenderer::section). */
export function sectionLook(data: Record<string, unknown>, allowImage: boolean, defaultInk: string): SectionLook {
  const style = sectionStyleOf(data, allowImage);
  // Chris (7 Nov): line spacing and padding make a section styled too (the email's section.blade.php draws it).
  const spacing = spacingOf(data, true);
  const image = style.background_image_url ?? null;
  const bg = style.background_color ?? null;
  const auto = image ? '#FFFFFF' : bg ? readableInk(bg, defaultInk) : defaultInk;
  const ink = style.color ?? auto;
  return {
    link: !image && bg && auto !== defaultInk ? ink : LINK,
    styled: Object.keys(style).length > 0 || Object.keys(spacing).length > 0,
    align: style.align ?? 'left',
    bg: image ? null : bg,
    image,
    fallback: image ? (bg ?? IMAGE_FALLBACK) : null,
    ink,
    padY: paddingPx(image ? 40 : bg ? 24 : 12, spacing.padding),
  };
}

/** Links in a text section: purple, except on a band that needs other words' colour (NewsletterRenderer::section). */
export function textLinkColor(look: SectionLook): string {
  return look.link;
}
