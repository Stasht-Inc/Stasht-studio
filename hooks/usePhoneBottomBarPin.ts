import { useEffect } from 'react';
import { isKeyboardEditable, phoneBarShift } from '../utils/visualViewport';

/**
 * Chris, 14 Nov 2026 (point 2, "Bottom bar is still scrolling to middle"): keeps every phone bottom bar
 * (`.phone-bottom-bar-pin`: the app's bottom nav + "+" button, the campaign page's bar, and the "+" popover) on the
 * real bottom edge of the screen. iOS 26 can draw `position: fixed` against a stale viewport (WebKit bug 297779):
 * the bar then floats up by about a keyboard's height while the page scrolls fully beneath it. After every scroll,
 * resize, visual-viewport change, keyboard close and page-height change, the bar is measured and shifted down by the
 * gap (CSS variable --phone-bar-shift, used by the `translate` property in styles/globals.css). Zero — no change —
 * whenever the bar is already where it belongs, which is always the case outside that iOS state.
 */
export function usePhoneBottomBarPin() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const root = document.documentElement;
    const vv = window.visualViewport;
    let frame = 0;
    let shift = 0;
    let lateTimer = 0;

    const apply = () => {
      frame = 0;
      const bar = Array.from(document.querySelectorAll<HTMLElement>('.phone-bottom-bar-pin'))
        .find((el) => el.getClientRects().length > 0);
      const next = bar
        ? phoneBarShift({
          barBottom: bar.getBoundingClientRect().bottom,
          currentShift: shift,
          innerHeight: window.innerHeight,
          vv,
          layoutWidth: window.innerWidth,
          editing: isKeyboardEditable(document.activeElement),
        })
        : 0;
      if (next !== shift) {
        shift = next;
        if (next) root.style.setProperty('--phone-bar-shift', `${next}px`);
        else root.style.removeProperty('--phone-bar-shift');
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(apply); };
    // After the keyboard's closing animation, measure again (iOS settles the viewport late).
    const scheduleLate = () => {
      schedule();
      if (lateTimer) window.clearTimeout(lateTimer);
      lateTimer = window.setTimeout(schedule, 400);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', scheduleLate);
    window.addEventListener('orientationchange', scheduleLate);
    window.addEventListener('pageshow', scheduleLate);
    document.addEventListener('focusout', scheduleLate, true);
    document.addEventListener('focusin', schedule, true);
    vv?.addEventListener('resize', scheduleLate);
    vv?.addEventListener('scroll', schedule);
    // The page getting longer/shorter (the Leads list refreshing every 10 s, a page switch) can re-place fixed bars.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(document.body);
    schedule();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (lateTimer) window.clearTimeout(lateTimer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', scheduleLate);
      window.removeEventListener('orientationchange', scheduleLate);
      window.removeEventListener('pageshow', scheduleLate);
      document.removeEventListener('focusout', scheduleLate, true);
      document.removeEventListener('focusin', schedule, true);
      vv?.removeEventListener('resize', scheduleLate);
      vv?.removeEventListener('scroll', schedule);
      observer?.disconnect();
      root.style.removeProperty('--phone-bar-shift');
    };
  }, []);
}
