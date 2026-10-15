/**
 * Where a full-screen `position: fixed` sheet should sit so it stays inside
 * what the user can actually see.
 *
 * iOS Safari doesn't shrink the layout viewport when the on-screen keyboard
 * opens — a `fixed; inset: 0` sheet keeps its full height and its bottom
 * (the action bar) ends up hidden behind the keyboard. The visual viewport
 * does shrink, so the sheet follows it instead: top = how far the visual
 * viewport is scrolled into the layout viewport, height = its height.
 *
 * Returns null when nothing should be overridden: no visualViewport, a wide
 * (desktop/tablet) layout at or above `maxWidth`, or a zero-height reading.
 */
export interface VisualViewportLike {
  height: number;
  offsetTop: number;
}

export function sheetBoxForVisualViewport(
  vv: VisualViewportLike | null | undefined,
  layoutWidth: number,
  maxWidth = 768,
): { top: number; height: number } | null {
  if (!vv || layoutWidth >= maxWidth) return null;
  const height = Math.round(vv.height);
  if (!(height > 0)) return null;
  return { top: Math.max(0, Math.round(vv.offsetTop)), height };
}
