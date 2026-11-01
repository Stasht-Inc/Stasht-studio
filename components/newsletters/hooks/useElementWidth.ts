import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The element's current width in px (0 until it is measured). Measured before the first paint and again whenever
 * it changes (a sidebar opening or closing, the window resizing), so a layout chosen from it never flashes.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
