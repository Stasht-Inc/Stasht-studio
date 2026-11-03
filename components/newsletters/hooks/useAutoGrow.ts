import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/**
 * A textarea that grows with its text (review, 3 Nov: the Message box takes up to 2,000 characters): from minRows
 * lines up to maxRows, then it scrolls. Measured from the box's own line height, padding and border, again whenever
 * the text or the window width changes.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, minRows = 2, maxRows = 10): void {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = window.getComputedStyle(el);
    const px = (v: string) => parseFloat(v) || 0;
    const line = px(s.lineHeight) || px(s.fontSize) * 1.5 || 20;
    const border = px(s.borderTopWidth) + px(s.borderBottomWidth);
    const box = px(s.paddingTop) + px(s.paddingBottom) + border;
    const min = line * minRows + box;
    const max = line * maxRows + box;
    el.style.height = 'auto';
    const wanted = el.scrollHeight + border; // scrollHeight has the padding, not the border (box-sizing: border-box)
    el.style.height = `${Math.round(Math.min(max, Math.max(min, wanted)))}px`;
    el.style.overflowY = wanted > max + 1 ? 'auto' : 'hidden';
  }, [ref, value, minRows, maxRows, width]);
}
