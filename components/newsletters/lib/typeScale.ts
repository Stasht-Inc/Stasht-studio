// Chris (7 Nov, point 4): "WE should be able to edit small, normal, large, x-large and make it whatever size we want, and
// it affects the entire H-class". One scale of text size styles per newsletter (Small / Normal / Large / X-Large), the
// same numbers and rounding as the API (NewsletterTypeScale):
//  - Text: unstyled words are Normal; sized words name their style (<span data-size="large">, lib/textHtml.ts); an older
//    px span (14 / 16 / 20 / 24) counts as the style it was.
//  - Title: Small follows Large, Medium and Large follow X-Large, in the proportions they always had (18 / 22 / 28 px with
//    the usual scale).
// The editor draws them through CSS variables (scaleVars) set once around the email, so a change shows everywhere at once
// without redrawing the words being edited. Pure.
import type { TitleSize, TypeScale } from '../../../services/newslettersAPI.ts';
import type { TextSize } from './sectionStyle.ts';

export const TYPE_SCALE_MIN = 10;
export const TYPE_SCALE_MAX = 72;
export const TYPE_STYLES: readonly TextSize[] = ['small', 'normal', 'large', 'xlarge'];
export const USUAL_SCALE: TypeScale = { small: 14, normal: 16, large: 20, xlarge: 24 };
const USUAL_LINE_HEIGHT: TypeScale = { small: 22, normal: 26, large: 30, xlarge: 34 };
/** Title size → [the style it follows, its px with the usual scale]. */
const TITLE_STYLE: Record<TitleSize, [TextSize, number]> = { small: ['large', 18], medium: ['xlarge', 22], large: ['xlarge', 28] };
const TITLE_SIZES: readonly TitleSize[] = ['small', 'medium', 'large'];

const inRange = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= TYPE_SCALE_MIN && v <= TYPE_SCALE_MAX;

/** Every style's px: what raw says where it is a whole number in range, else the usual size. */
export function scaleOf(raw: unknown): TypeScale {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...USUAL_SCALE };
  for (const s of TYPE_STYLES) if (inRange(r[s])) out[s] = r[s] as number;
  return out;
}

export function sameScale(a: TypeScale, b: TypeScale): boolean {
  return TYPE_STYLES.every((s) => a[s] === b[s]);
}

/** As it is kept: the full scale, or null for the usual sizes (nothing kept). */
export function storedScale(raw: unknown): TypeScale | null {
  if (!raw || typeof raw !== 'object') return null;
  const scale = scaleOf(raw);
  return sameScale(scale, USUAL_SCALE) ? null : scale;
}

/** A style's line height at px: the usual proportion (16 → 26), rounded as PHP does for these (halves up). */
export function styleLineHeight(style: TextSize, px: number): number {
  return Math.round((px * USUAL_LINE_HEIGHT[style]) / USUAL_SCALE[style]);
}

export function titlePx(scale: TypeScale, size: TitleSize): number {
  const [style, usual] = TITLE_STYLE[size] ?? TITLE_STYLE.medium;
  return Math.max(TYPE_SCALE_MIN, Math.round((scale[style] * usual) / USUAL_SCALE[style]));
}

/** title.blade.php: px + 8. */
export function titleLineHeight(px: number): number {
  return px + 8;
}

/** The style an older px span was (lib/textHtml.ts keeps the style's usual px as its identity), else null. */
export function styleOfPx(px: number | null | undefined): TextSize | null {
  return TYPE_STYLES.find((s) => USUAL_SCALE[s] === px) ?? null;
}

/** The CSS variables the editor draws every style with (set around the email). */
export function scaleVars(scale: TypeScale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of TYPE_STYLES) {
    out[`--nl-size-${s}`] = `${scale[s]}px`;
    out[`--nl-lh-${s}`] = `${styleLineHeight(s, scale[s])}px`;
  }
  for (const t of TITLE_SIZES) {
    const px = titlePx(scale, t);
    out[`--nl-title-${t}`] = `${px}px`;
    out[`--nl-title-lh-${t}`] = `${titleLineHeight(px)}px`;
  }
  return out;
}

// Each with the usual size as its fallback, so a part drawn outside the editor looks as it always did.
export const sizeVar = (s: TextSize) => `var(--nl-size-${s}, ${USUAL_SCALE[s]}px)`;
export const lineHeightVar = (s: TextSize) => `var(--nl-lh-${s}, ${USUAL_LINE_HEIGHT[s]}px)`;
export const titleSizeVar = (t: TitleSize) => `var(--nl-title-${t}, ${TITLE_STYLE[t][1]}px)`;
export const titleLineHeightVar = (t: TitleSize) => `var(--nl-title-lh-${t}, ${titleLineHeight(TITLE_STYLE[t][1])}px)`;

/** The px field: a whole number in range (spaces and "px" allowed), else null. */
export function parsePxInput(text: string): number | null {
  const m = /^\s*(\d{1,3})\s*(px)?\s*$/i.exec(text);
  const v = m ? Number(m[1]) : NaN;
  return inRange(v) ? v : null;
}

/** One step of the − / + buttons, kept in range. */
export function stepPx(px: number, delta: number): number {
  return Math.min(TYPE_SCALE_MAX, Math.max(TYPE_SCALE_MIN, px + delta));
}
