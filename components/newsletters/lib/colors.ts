// Colours for the header and buttons. Only #RRGGBB ever reaches a style attribute (the API checks the same).
export const DEFAULT_BUTTON_COLOR = '#6C60FF';

export const COLOR_SWATCHES: ReadonlyArray<{ value: string; name: string }> = [
  { value: '#6C60FF', name: 'Purple' },
  { value: '#111827', name: 'Black' },
  { value: '#2563EB', name: 'Blue' },
  { value: '#059669', name: 'Green' },
  { value: '#DC2626', name: 'Red' },
  { value: '#F59E0B', name: 'Orange' },
];

/** #RRGGBB or the fallback: nothing else may reach a style attribute. */
export function safeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/** Dark text on light colours, white on dark ones: the email renderer's rule (NewsletterRenderer::contrast). */
export function contrastInk(hex: string): '#1F2937' | '#FFFFFF' {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const luminance = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return luminance > 0.6 ? '#1F2937' : '#FFFFFF';
}
