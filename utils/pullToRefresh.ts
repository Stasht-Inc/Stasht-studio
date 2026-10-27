// Pull-to-refresh maths, shared by hooks/usePullToRefresh. Same numbers as the
// campaign details page (pages/MemoryDetailsPage.tsx): an 80px pull triggers a
// refresh, the drag is capped at 1.5x that, and the indicator travels at most 60px.

export const PULL_THRESHOLD = 80;
const MAX_INDICATOR_OFFSET = 60;

// How far the user has pulled down; 0 when not tracking or dragging upwards.
export function pullDistanceFor(startY: number | null, currentY: number, threshold = PULL_THRESHOLD): number {
  if (startY === null || !Number.isFinite(currentY)) return 0;
  const distance = currentY - startY;
  if (distance <= 0) return 0;
  return Math.min(distance, threshold * 1.5);
}

export function shouldTriggerRefresh(distance: number, threshold = PULL_THRESHOLD): boolean {
  return distance >= threshold;
}

// Position / fade / spin of the floating spinner pill.
export function pullIndicatorStyle(
  distance: number,
  isPulling: boolean,
  isRefreshing: boolean,
  threshold = PULL_THRESHOLD,
): { translateY: number; opacity: number; rotate: number | null } {
  if (!isPulling) return { translateY: 0, opacity: 1, rotate: null };
  return {
    translateY: Math.min(distance, MAX_INDICATOR_OFFSET),
    opacity: Math.min(distance / threshold, 1),
    rotate: isRefreshing ? null : distance * 2,
  };
}
