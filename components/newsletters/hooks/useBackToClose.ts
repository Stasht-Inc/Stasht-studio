import { useEffect, useRef } from 'react';

// The browser's Back button closes a full-window layer instead of leaving the page. While `active`, one history
// entry (same URL, marked in history.state) sits on top; Back pops it and calls onBack. When onBack answers false
// (the person chose to stay, e.g. unsaved changes), the entry goes back on so the next Back asks again. Closing the
// layer any other way takes its entry off again.

const KEY = 'stashtNlLayer';
// React StrictMode mounts, unmounts and mounts again: the second mount takes over the entry the first one left
// instead of stacking another (its history.back() is deferred and cancelled here).
let pendingBack: number | null = null;

const marked = () => Boolean((window.history.state as Record<string, unknown> | null)?.[KEY]);
function push() {
  try {
    window.history.pushState({ ...((window.history.state as object | null) ?? {}), [KEY]: true }, '', window.location.href);
  } catch {
    // History not available (sandboxed): Back simply keeps its old meaning.
  }
}

export function useBackToClose(active: boolean, onBack: () => boolean | Promise<boolean>): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return undefined;
    if (pendingBack !== null && marked()) {
      window.clearTimeout(pendingBack);
      pendingBack = null;
    } else {
      push();
    }
    let ours = true;
    const onPop = async () => {
      if (!ours || marked()) return;
      ours = false;
      const closed = await onBackRef.current();
      if (!closed) {
        push();
        ours = true;
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (ours && marked()) {
        pendingBack = window.setTimeout(() => {
          pendingBack = null;
          if (marked()) window.history.back();
        }, 0);
      }
    };
  }, [active]);
}
