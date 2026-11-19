// utils/photoCounter.ts
// Chris, 19 Nov 2026 (point 19): a photo counter ("1 / 1", "Image 1 of 1") on a moment with ONE photo says nothing —
// it shows only when the moment has 2 or more. Same rule as the app's moment card.

/** "Image N of M" for the full-screen viewer's filmstrip, or null (hide it) when there is only one photo. */
export function photoCounterLabel(current: number, total: number, prefix = 'Image '): string | null {
  if (!Number.isFinite(total) || total < 2) return null;
  const n = Math.min(Math.max(1, Math.floor(current)), total);
  return `${prefix}${n} of ${total}`;
}
