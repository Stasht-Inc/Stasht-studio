import { useEffect, type RefObject } from 'react';
import { keyboardSheetBox, isKeyboardEditable, keyboardUp } from '../utils/visualViewport';

/**
 * Keeps a full-screen fixed sheet inside the visual viewport on phones WHILE THE KEYBOARD IS UP, so content pinned
 * to its bottom (e.g. Cancel / Save / Publish) stays above the iOS on-screen keyboard. Writes `--vv-top` /
 * `--vv-height` (and `--vv-min-height: 0px`) onto the element only while a text field is focused; style it with e.g.
 * `top-[var(--vv-top,0px)] h-[var(--vv-height,100%)] min-h-[var(--vv-min-height,100dvh)]`.
 * The rest of the time the variables are absent, so the sheet fills the screen: iOS can leave `visualViewport`
 * short after the keyboard closes (home-screen app, iOS 26), and a sheet sized from that stale reading stopped
 * part-way down with the page showing below it (Chris, 9 Nov 2026, point 7).
 * "Keyboard up" = a text field is focused AND the visual viewport has since dropped ~120px below its height when the
 * field got focus (review I3): the title auto-focuses without the keyboard, and with a stale viewport that alone
 * used to size the sheet short. A real keyboard shrinks the viewport, so the sheet still follows it.
 * Variables are also removed on wide screens and when `active` goes false or the component unmounts.
 */
export function useVisualViewportSheet(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const el = ref.current;
    if (!el) return;
    const vv = window.visualViewport;
    let frame = 0;
    // The visual viewport's height when a text field got focus (0 = none focused).
    let heightAtFocus = 0;

    const clear = () => {
      el.style.removeProperty('--vv-top');
      el.style.removeProperty('--vv-height');
      el.style.removeProperty('--vv-min-height');
    };
    const apply = () => {
      frame = 0;
      const editing = isKeyboardEditable(document.activeElement);
      if (!editing) heightAtFocus = 0; // focus left the fields (focusout, coalesced with any focusin in this frame)
      const box = keyboardSheetBox(vv, window.innerWidth, editing && keyboardUp(heightAtFocus, vv?.height ?? 0));
      if (!box) { clear(); return; }
      el.style.setProperty('--vv-top', `${box.top}px`);
      el.style.setProperty('--vv-height', `${box.height}px`);
      el.style.setProperty('--vv-min-height', '0px');
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    const onFocusIn = (e: FocusEvent) => {
      // Moving between fields with the keyboard up keeps the first baseline.
      if (isKeyboardEditable(e.target as Element | null) && !heightAtFocus) heightAtFocus = vv?.height ?? 0;
      schedule();
    };

    if (isKeyboardEditable(document.activeElement)) heightAtFocus = vv?.height ?? 0;
    apply();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', schedule);
      clear();
    };
  }, [ref, active]);
}
