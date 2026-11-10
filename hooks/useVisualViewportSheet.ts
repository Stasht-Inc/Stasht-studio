import { useEffect, type RefObject } from 'react';
import { keyboardSheetBox, isKeyboardEditable } from '../utils/visualViewport';

/**
 * Keeps a full-screen fixed sheet inside the visual viewport on phones WHILE THE KEYBOARD IS UP, so content pinned
 * to its bottom (e.g. Cancel / Save / Publish) stays above the iOS on-screen keyboard. Writes `--vv-top` /
 * `--vv-height` (and `--vv-min-height: 0px`) onto the element only while a text field is focused; style it with e.g.
 * `top-[var(--vv-top,0px)] h-[var(--vv-height,100%)] min-h-[var(--vv-min-height,100dvh)]`.
 * The rest of the time the variables are absent, so the sheet fills the screen: iOS can leave `visualViewport`
 * short after the keyboard closes (home-screen app, iOS 26), and a sheet sized from that stale reading stopped
 * part-way down with the page showing below it (Chris, 9 Nov 2026, point 7).
 * Variables are also removed on wide screens and when `active` goes false or the component unmounts.
 */
export function useVisualViewportSheet(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const el = ref.current;
    if (!el) return;
    const vv = window.visualViewport;
    let frame = 0;

    const clear = () => {
      el.style.removeProperty('--vv-top');
      el.style.removeProperty('--vv-height');
      el.style.removeProperty('--vv-min-height');
    };
    const apply = () => {
      frame = 0;
      const editing = isKeyboardEditable(document.activeElement);
      const box = keyboardSheetBox(vv, window.innerWidth, editing);
      if (!box) { clear(); return; }
      el.style.setProperty('--vv-top', `${box.top}px`);
      el.style.setProperty('--vv-height', `${box.height}px`);
      el.style.setProperty('--vv-min-height', '0px');
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      clear();
    };
  }, [ref, active]);
}
