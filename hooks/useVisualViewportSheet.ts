import { useEffect, type RefObject } from 'react';
import { sheetBoxForVisualViewport } from '../utils/visualViewport';

/**
 * Keeps a full-screen fixed sheet inside the visual viewport on phones, so
 * content pinned to its bottom (e.g. Cancel / Save / Publish) stays above the
 * iOS on-screen keyboard. Writes `--vv-top` / `--vv-height` onto the element;
 * style it with e.g. `top-[var(--vv-top,0px)] h-[var(--vv-height,100%)]`.
 * Variables are removed on wide screens and when `active` goes false or the
 * component unmounts, so the CSS fallbacks apply.
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
    };
    const apply = () => {
      frame = 0;
      const box = sheetBoxForVisualViewport(vv, window.innerWidth);
      if (!box) { clear(); return; }
      el.style.setProperty('--vv-top', `${box.top}px`);
      el.style.setProperty('--vv-height', `${box.height}px`);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      clear();
    };
  }, [ref, active]);
}
