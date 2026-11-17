import { useEffect, useRef } from 'react';

// The browser's Back button closes a full-window layer instead of leaving the page. While `active`, one history
// entry (same URL, marked in history.state) sits on top; Back pops it and calls onBack. When onBack answers false
// (the person chose to stay, e.g. unsaved changes), the entry goes back on so the next Back asks again. Closing the
// layer any other way takes its entry off again.
// Layers can stack (Chris 17 Nov 2026: the product page, then its editor on top): each entry is marked with its depth
// (1 = the first layer), so Back closes only the top one. A single layer behaves exactly as before.

const KEY = 'stashtNlLayer';
// React StrictMode mounts, unmounts and mounts again: the second mount takes over the entry the first one left
// instead of stacking another (its history.back() is deferred and cancelled here).
let pendingBack: number | null = null;

/** How many layer entries the current history entry sits on (0 = none). `true` is the older single-layer mark. */
const depthNow = (): number => {
  const v = (window.history.state as Record<string, unknown> | null)?.[KEY];
  return v === true ? 1 : typeof v === 'number' && v > 0 ? v : 0;
};
function push(depth: number) {
  try {
    window.history.pushState({ ...((window.history.state as object | null) ?? {}), [KEY]: depth }, '', window.location.href);
  } catch {
    // History not available (sandboxed): Back simply keeps its old meaning.
  }
}

export function useBackToClose(active: boolean, onBack: () => boolean | Promise<boolean>): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    let depth: number;
    if (pendingBack !== null && depthNow() > 0) {
      window.clearTimeout(pendingBack);
      pendingBack = null;
      depth = depthNow();
    } else {
      depth = depthNow() + 1;
      push(depth);
    }
    let ours = true;
    const onPop = async () => {
      if (!ours || depthNow() >= depth) return; // still on (or above) this layer's entry: not this layer's Back
      ours = false;
      const closed = await onBackRef.current();
      if (!closed) {
        push(depth);
        ours = true;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (ours && depthNow() >= depth) {
        pendingBack = window.setTimeout(() => {
          pendingBack = null;
          if (depthNow() >= depth) window.history.back();
        }, 0);
      }
    };
  }, [active]);
}
