import { useEffect } from 'react';
import { isKeyboardEditable, keyboardClosedResize } from '../utils/visualViewport';

/**
 * Chris, 9 Nov 2026 (point 2, "still"): on iPhone the fixed bottom bar can be drawn half-way up the screen while
 * scrolling. The likely cause is iOS keeping the viewport sized as if the keyboard were still open after it closes
 * (home-screen app; the gap in his screenshot is about a keyboard high) — `bottom: 0` then sits a keyboard too high.
 * When the keyboard closes (a text field loses focus, or the visual viewport grows by a keyboard), nudge the page
 * 1px and back so iOS recomputes where fixed elements go. Phones only; the page ends where it was.
 */
export function useIosFixedBarRecovery() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const vv = window.visualViewport;
    let timer = 0;
    let lastHeight = vv?.height ?? 0;

    const nudge = () => {
      timer = 0;
      if (window.innerWidth >= 768) return;
      if (isKeyboardEditable(document.activeElement)) return; // focus moved to another field: keyboard still up
      const x = window.scrollX;
      const y = window.scrollY;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(x, y >= max ? Math.max(0, y - 1) : y + 1);
      window.scrollTo(x, y);
    };
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(nudge, 350); // after the keyboard's closing animation
    };
    const onFocusOut = (e: FocusEvent) => { if (isKeyboardEditable(e.target as Element | null)) schedule(); };
    const onResize = () => {
      const h = vv?.height ?? 0;
      if (keyboardClosedResize(lastHeight, h)) schedule();
      lastHeight = h;
    };

    document.addEventListener('focusout', onFocusOut, true);
    vv?.addEventListener('resize', onResize);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener('focusout', onFocusOut, true);
      vv?.removeEventListener('resize', onResize);
    };
  }, []);
}
