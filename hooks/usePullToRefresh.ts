import { useCallback, useEffect, useRef, useState } from 'react';
import { PULL_THRESHOLD, pullDistanceFor, shouldTriggerRefresh } from '../utils/pullToRefresh';

// Touch pull-to-refresh, behaving like the campaign details page's
// (pages/MemoryDetailsPage.tsx): pull down from the top of the page, release past
// 80px and `onRefresh` runs; the spinner stays half a second after it settles.
// Spread `handlers` on the element that wraps the list and render
// <PullToRefreshIndicator {...state} /> somewhere inside it.
//
// Differences from the original, both deliberate: it checks the window's scroll
// position too (this page scrolls the window, not its own element), and it ignores
// touches that start outside the wrapper's DOM (React bubbles portal events, so a
// drag inside a sheet or popover would otherwise count as a pull).

interface Options {
  enabled?: boolean;
  threshold?: number;
}

export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, { enabled = true, threshold = PULL_THRESHOLD }: Options = {}) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const mountedRef = useRef(true);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reset = useCallback(() => {
    startYRef.current = null;
    distanceRef.current = 0;
    setIsPulling(false);
    setPullDistance(0);
  }, []);

  // A pull only starts (and only continues) while the page is scrolled to the top.
  const atTop = (el: HTMLElement) =>
    (window.scrollY || document.documentElement.scrollTop || 0) <= 0 && el.scrollTop <= 0;

  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (!enabled || refreshingRef.current || e.touches.length !== 1) return;
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
    if (!atTop(e.currentTarget)) return;
    startYRef.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (startYRef.current === null || refreshingRef.current) return;
    if (!enabled || !atTop(e.currentTarget)) {
      reset();
      return;
    }
    const distance = pullDistanceFor(startYRef.current, e.touches[0].clientY, threshold);
    distanceRef.current = distance;
    if (distance > 0) {
      setIsPulling(true);
      setPullDistance(distance);
    }
  };

  const onTouchEnd = async () => {
    if (startYRef.current === null || refreshingRef.current) return;
    const distance = distanceRef.current;
    startYRef.current = null;
    distanceRef.current = 0;
    if (!shouldTriggerRefresh(distance, threshold)) {
      reset();
      return;
    }
    refreshingRef.current = true;
    setIsRefreshing(true);
    setIsPulling(false);
    try {
      await onRefreshRef.current();
    } catch {
      // The refresh reports its own errors (toast / inline message).
    } finally {
      setTimeout(() => {
        refreshingRef.current = false;
        if (!mountedRef.current) return;
        setIsRefreshing(false);
        setPullDistance(0);
      }, 500);
    }
  };

  return {
    isPulling,
    pullDistance,
    isRefreshing,
    threshold,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset },
  };
}
