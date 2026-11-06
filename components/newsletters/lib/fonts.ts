// Chris (6 Nov, point 3b): "We are missing font types." The Title and Text toolbars' font family: email-safe fonts, each
// with web-safe fallbacks. The same keys, labels and stacks as the API (NewsletterFonts::FONTS), so the editor draws
// what the email shows. Title: data.font (and data.bold false for normal weight). Text: a span in the html
// (lib/textHtml.ts). No key / no span: the email's usual font (DEFAULT_FONT_STACK). Pure.
import type { FontKey } from '../../../services/newslettersAPI.ts';

export const FONTS = [
  { value: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { value: 'helvetica', label: 'Helvetica', stack: 'Helvetica, Arial, sans-serif' },
  { value: 'georgia', label: 'Georgia', stack: "Georgia, 'Times New Roman', Times, serif" },
  { value: 'times', label: 'Times New Roman', stack: "'Times New Roman', Times, serif" },
  { value: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { value: 'trebuchet', label: 'Trebuchet MS', stack: "'Trebuchet MS', Helvetica, Arial, sans-serif" },
  { value: 'tahoma', label: 'Tahoma', stack: 'Tahoma, Verdana, Geneva, sans-serif' },
  { value: 'courier', label: 'Courier New', stack: "'Courier New', Courier, monospace" },
] as const satisfies ReadonlyArray<{ value: FontKey; label: string; stack: string }>;

/** The email's usual font (the section cells in body.blade.php): what "Default" means. */
export const DEFAULT_FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const DEFAULT_FONT_LABEL = 'Default';

export function isFontKey(value: unknown): value is FontKey {
  return typeof value === 'string' && FONTS.some((f) => f.value === value);
}

export function fontStack(key: FontKey | null | undefined): string {
  return FONTS.find((f) => f.value === key)?.stack ?? DEFAULT_FONT_STACK;
}

export function fontLabel(key: FontKey | null | undefined): string {
  return FONTS.find((f) => f.value === key)?.label ?? DEFAULT_FONT_LABEL;
}

/** The font whose label is this name (any case, spaces collapsed), else null. */
export function fontOfLabel(name: string): FontKey | null {
  const n = name.replace(/\s+/g, ' ').trim().toLowerCase();
  return FONTS.find((f) => f.label.toLowerCase() === n)?.value ?? null;
}

/**
 * A style attribute's font family, when its first family is one of FONTS (by label, any case, quoted or not), else
 * null (NewsletterFonts::fromStyle). Only that declaration is read; the span is rebuilt from the key.
 */
export function styleFontFamily(style: string | null | undefined): FontKey | null {
  for (const declaration of String(style ?? '').split(';')) {
    const m = /^\s*font-family\s*:([\s\S]*)$/i.exec(declaration);
    if (!m) continue;
    let first = m[1].split(',')[0].trim();
    const quoted = /^(['"])([\s\S]*)\1$/.exec(first);
    if (quoted) first = quoted[2].trim();
    const name = first.replace(/\s+/g, ' ').toLowerCase();
    return /^[a-z ]+$/.test(name) ? fontOfLabel(name) : null;
  }
  return null;
}

/** A title's font and weight keys worth keeping (NewsletterContent::titleType): font when offered, bold only when off. */
export function titleTypeOf(data: Record<string, unknown>): { font?: FontKey; bold?: false } {
  const out: { font?: FontKey; bold?: false } = {};
  if (isFontKey(data.font)) out.font = data.font;
  if (data.bold === false) out.bold = false;
  return out;
}

/** A change to a title's font / weight: Default (null) and bold on (true) take the key away, as an older title. */
export function withTitleType<D extends Record<string, unknown>>(data: D, patch: { font?: FontKey | null; bold?: boolean }): D {
  const out: Record<string, unknown> = { ...data };
  if ('font' in patch) {
    if (isFontKey(patch.font)) out.font = patch.font;
    else delete out.font;
  }
  if ('bold' in patch) {
    if (patch.bold === false) out.bold = false;
    else delete out.bold;
  }
  return out as D;
}

/** The same change as an editor patch (onChange merges it): a removed key is undefined, which JSON leaves out. */
export function titleTypePatch(patch: { font?: FontKey | null; bold?: boolean }): { font?: FontKey; bold?: false } {
  const kept = withTitleType({}, patch) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) out[key] = kept[key];
  return out as { font?: FontKey; bold?: false };
}
