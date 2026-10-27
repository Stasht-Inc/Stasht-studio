import { PULL_THRESHOLD, pullIndicatorStyle } from '../utils/pullToRefresh';

// The floating spinner pill shown while pulling to refresh — same look as the
// campaign details page's (pages/MemoryDetailsPage.tsx), just under the 5rem header.

interface Props {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  threshold?: number;
  className?: string;
}

export default function PullToRefreshIndicator({ isPulling, isRefreshing, pullDistance, threshold = PULL_THRESHOLD, className = '' }: Props) {
  if (!isPulling && !isRefreshing) return null;
  const { translateY, opacity, rotate } = pullIndicatorStyle(pullDistance, isPulling, isRefreshing, threshold);
  return (
    <div
      className={`fixed top-20 left-0 right-0 flex justify-center items-center transition-all duration-200 z-[60] pointer-events-none ${className}`}
      style={{ transform: `translateY(${translateY}px)`, opacity }}
      role="status"
      aria-live="polite"
    >
      <div className="bg-white rounded-full p-3 shadow-lg flex items-center gap-2">
        <svg
          className={`w-5 h-5 text-[#6C60FF] ${isRefreshing ? 'animate-spin' : ''}`}
          style={{ transform: rotate !== null ? `rotate(${rotate}deg)` : undefined }}
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {isRefreshing && <span className="text-sm text-gray-700">Refreshing...</span>}
        {isPulling && !isRefreshing && pullDistance >= threshold && <span className="text-sm text-gray-700">Release to refresh</span>}
        {!isRefreshing && !(isPulling && pullDistance >= threshold) && <span className="sr-only">Pull to refresh</span>}
      </div>
    </div>
  );
}
