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

/**
 * Chris, 9 Nov 2026 (point 7): iOS can leave `visualViewport` short after the keyboard closes (home-screen app,
 * iOS 26) — a sheet sized from it then stops part-way down the screen with the page showing below. So the sheet
 * follows the visual viewport only while the keyboard is actually up (a text field is focused); otherwise it gets
 * no override and fills the screen.
 */
export function keyboardSheetBox(
  vv: VisualViewportLike | null | undefined,
  layoutWidth: number,
  editing: boolean,
  maxWidth = 768,
): { top: number; height: number } | null {
  if (!editing) return null;
  return sheetBoxForVisualViewport(vv, layoutWidth, maxWidth);
}

interface EditableLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}

const NO_KEYBOARD_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
]);

/** True for an element that brings up the on-screen keyboard when focused (text inputs, textareas, contenteditable). */
export function isKeyboardEditable(el: EditableLike | Element | null | undefined): boolean {
  if (!el) return false;
  const e = el as EditableLike;
  if (e.isContentEditable) return true;
  const tag = (e.tagName || '').toUpperCase();
  if (tag === 'TEXTAREA') return !e.readOnly && !e.disabled;
  if (tag !== 'INPUT') return false;
  if (e.readOnly || e.disabled) return false;
  return !NO_KEYBOARD_INPUT_TYPES.has((e.type || 'text').toLowerCase());
}

/**
 * The visual viewport grew by about a keyboard's height (the keyboard closed). A Safari toolbar collapsing changes it
 * by far less, so that never counts.
 */
export function keyboardClosedResize(previousHeight: number, height: number, minGrowth = 200): boolean {
  if (!(previousHeight > 0) || !(height > 0)) return false;
  return height - previousHeight >= minGrowth;
}

/**
 * Review fix (I3): the keyboard is up only once the visual viewport has dropped `minDrop` px below its height when the
 * field got focus. A focused field alone isn't enough — the title auto-focuses (and is re-focused after the device
 * location) without the iOS keyboard, and with a stale viewport that used to size the sheet short.
 */
export function keyboardUp(heightAtFocus: number, height: number, minDrop = 120): boolean {
  if (!(heightAtFocus > 0) || !(height > 0)) return false;
  return heightAtFocus - height >= minDrop;
}

/**
 * Review fix (M1): the bottom-bar nudge runs on touch screens only, and not if the page has moved since it was
 * scheduled (the user is scrolling — a programmatic scroll would stop a fling).
 */
export function shouldNudge(scheduledScrollY: number, scrollY: number, coarsePointer: boolean): boolean {
  return coarsePointer && Math.abs(scrollY - scheduledScrollY) < 1;
}

/**
 * Re-review R1(a): a rotation (the layout width changes) while a field is focused re-bases the focus-time height on
 * the new layout height, so a keyboard that is up after the rotation still counts as a drop. Other resizes (the
 * keyboard itself) keep the baseline.
 */
export function focusBaselineAfterResize(
  heightAtFocus: number,
  previousWidth: number,
  width: number,
  layoutHeight: number,
  editing: boolean,
): number {
  if (!editing || width === previousWidth) return heightAtFocus;
  return layoutHeight;
}
