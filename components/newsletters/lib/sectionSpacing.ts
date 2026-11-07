// Chris (7 Nov, point 2): "Add spacing so we can make gaps smaller between rows. Add padding so we can decrease padding
// on top and bottom." A section's line spacing (Title, Text) and the room above and below it (Title, Text, Button,
// Divider, Campaigns). Two optional block data keys, stored only when not Normal, so an older section stays exactly as
// it was. The same keys, rules and numbers as the API (NewsletterSpacing), so the editor draws what the email shows.
// Pure.
import type { CSSProperties } from 'react';
import type { LineSpacing, SectionPadding, SectionSpacing } from '../../../services/newslettersAPI.ts';

export const LINE_SPACING_OPTIONS = [
  { value: 'tight', label: 'Tight' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Relaxed' },
] as const satisfies ReadonlyArray<{ value: LineSpacing; label: string }>;

export const PADDING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
] as const satisfies ReadonlyArray<{ value: SectionPadding; label: string }>;

const LINE_SPACINGS: readonly string[] = LINE_SPACING_OPTIONS.map((o) => o.value);
const PADDINGS: readonly string[] = PADDING_OPTIONS.map((o) => o.value);

/** The keys worth keeping (API NewsletterSpacing::of). lines: the section has words (Title, Text). */
export function spacingOf(data: Record<string, unknown>, lines: boolean): SectionSpacing {
  const out: SectionSpacing = {};
  const spacing = data.line_spacing;
  if (lines && typeof spacing === 'string' && LINE_SPACINGS.includes(spacing) && spacing !== 'normal') out.line_spacing = spacing as LineSpacing;
  const padding = data.padding;
  if (typeof padding === 'string' && PADDINGS.includes(padding) && padding !== 'normal') out.padding = padding as SectionPadding;
  return out;
}

/** A change as an editor patch (onChange merges it): Normal is undefined, which JSON leaves out. */
export function spacingPatch(patch: { line_spacing?: LineSpacing; padding?: SectionPadding }): Partial<SectionSpacing> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) out[key] = value === 'normal' ? undefined : value;
  return out as Partial<SectionSpacing>;
}

/** Room above and below, px, by the section's usual room (12 plain, 24 on a band, 40 on a picture). */
const PAD: Record<number, Record<string, number>> = {
  12: { none: 0, small: 6, large: 24 },
  24: { none: 0, small: 12, large: 40 },
  40: { none: 0, small: 20, large: 64 },
};
export function paddingPx(usual: number, padding: SectionPadding | null | undefined): number {
  return (padding ? PAD[usual]?.[padding] : undefined) ?? usual;
}

/** Tight: a quarter of the size off (never under 1.2 x the size); relaxed: 3/8 of it more (NewsletterSpacing::lineHeight). */
const K: Record<string, number> = { tight: -0.25, relaxed: 0.375 };
const MIN: Record<string, number> = { tight: 1.2, relaxed: 0 };
export function lineHeight(px: number, usual: number, spacing: LineSpacing | null | undefined): number {
  const k = spacing ? K[spacing] : undefined;
  if (k === undefined) return usual;
  return Math.round(Math.max(usual + k * px, (MIN[spacing as string] ?? 0) * px) * 100) / 100;
}

/**
 * Gaps after a paragraph or list, and after a list row, as parts of the section's Normal text size (type scale, Chris
 * 7 Nov): 8 / 2 px tight and 24 / 12 px relaxed at the usual 16 px. Normal keeps 16 and 6 (TEXT_CLASS).
 */
const GAP_K: Record<string, [number, number]> = { tight: [0.5, 0.125], relaxed: [1.5, 0.75] };
const NORMAL_GAPS: [number, number] = [16, 6];

/** NewsletterSpacing::gaps: tight never opens them wider than Normal's 16 / 6, relaxed never closes them tighter. */
export function spacingGaps(spacing: LineSpacing | null | undefined, normalPx = 16): [number, number] | null {
  const k = spacing ? GAP_K[spacing] : undefined;
  if (!k) return null;
  const pick = spacing === 'tight' ? Math.min : Math.max;
  return [pick(Math.round(normalPx * k[0]), NORMAL_GAPS[0]), pick(Math.round(normalPx * k[1]), NORMAL_GAPS[1])];
}

/**
 * A text section's spacing in the editor: its line height and the variables its sized words and gaps read
 * (spanLineHeight, SPACED_TEXT_CLASS), from the section's Normal size and line height in the newsletter's type scale
 * (16 / 26 with the usual one). Empty for Normal, so an older section is drawn as before.
 */
export function textSpacingStyle(spacing: LineSpacing | null | undefined, normalPx = 16, normalLineHeight = 26): CSSProperties {
  const gaps = spacingGaps(spacing, normalPx);
  if (!spacing || !gaps) return {};
  return {
    lineHeight: `${lineHeight(normalPx, normalLineHeight, spacing)}px`,
    '--nl-lh-k': String(K[spacing]),
    '--nl-lh-min': String(MIN[spacing]),
    '--nl-gap': `${gaps[0]}px`,
    '--nl-row': `${gaps[1]}px`,
  } as CSSProperties;
}

const cssLength = (v: number | string) => (typeof v === 'number' ? `${v}px` : v);

/**
 * Sized words' line height in the editor: their usual one, moved by the section's spacing variables (lineHeight()).
 * px / usual: numbers (px) or CSS lengths, such as the type scale's variables (lib/typeScale.ts sizeVar, lineHeightVar).
 */
export function spanLineHeight(px: number | string, usual: number | string): string {
  const size = cssLength(px);
  return `max(calc(${cssLength(usual)} + var(--nl-lh-k, 0) * ${size}), calc(var(--nl-lh-min, 0) * ${size}))`;
}

/**
 * While a section is being edited, its style toolbar sits this far below the section's top edge, so it clears the
 * section's move / delete buttons (which reach 18 px into it) even with little or no padding: 8 px as before.
 */
export function toolbarGap(padY: number): number {
  return Math.max(8, 20 - padY);
}

/** A spaced text section's gaps (the variables above) over TEXT_CLASS's usual ones. */
export const SPACED_TEXT_CLASS = '[&_div]:!mb-[var(--nl-gap)] [&_li]:!mb-[var(--nl-row)] [&_ol]:!mb-[var(--nl-gap)] [&_p]:!mb-[var(--nl-gap)] [&_ul]:!mb-[var(--nl-gap)]';
/** A styled text section ends on its last paragraph or list, as the email draws it (no gap above the bottom edge). */
export const FLUSH_END_CLASS = '[&>*:last-child]:!mb-0';
