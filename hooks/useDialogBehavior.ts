import { useLayoutEffect, useRef } from 'react';

/**
 * Dialog semantics for a hand-rolled panel: Escape-to-close, focus moved into
 * the panel on open, focus returned to the opener on close, and Tab cycling
 * trapped inside. Attach the returned ref to the panel's root element and
 * spread `dialogProps` onto it.
 */
export function useDialogBehavior(opts: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string; // id of the heading element inside the panel
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(opts.onClose);
  onCloseRef.current = opts.onClose;

  // useLayoutEffect (not useEffect) is load-bearing here, for two reasons:
  //
  // 1. Focus-return on close depends on it. React runs useEffect cleanups for
  //    an unmounting subtree AFTER the DOM has already been detached — by the
  //    time our cleanup below checks `panel.contains(document.activeElement)`,
  //    the panel node is gone, the browser has already forced focus back to
  //    document.body, and the check is always false, silently no-opping
  //    `openerRef.current?.focus()` on every close path. useLayoutEffect
  //    cleanups run synchronously during the mutation phase, BEFORE React
  //    detaches the subtree, so the containment check still sees the real
  //    DOM and the opener reliably regains focus.
  // 2. Initial focus-into-panel then also happens pre-paint instead of
  //    post-paint, which is a strict improvement (no visible flash of focus
  //    landing on the wrong element).
  //
  // Do not "simplify" this back to useEffect — it will silently break focus
  // return without any visible error, since nothing throws when the guard
  // is always false.
  useLayoutEffect(() => {
    if (!opts.open) return;
    openerRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      // offsetParent !== null excludes display:none (and detached) elements —
      // e.g. LeadDetailDrawer's composer container toggles class `hidden` for
      // archived/rollup/no-contact leads, which would otherwise leave hidden
      // buttons as the last DOM matches and let Tab escape the trap after the
      // last visible control. This treats position:fixed descendants as
      // "visible enough" too (offsetParent is null for those even when shown),
      // which is an acceptable false-negative for this panel context since
      // none of these drawers currently position focusable children fixed.

    (focusables()[0] ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    panel.addEventListener('keydown', onKeyDown);
    return () => {
      panel.removeEventListener('keydown', onKeyDown);
      // Only restore focus if it's still inside this panel. On a cross-type
      // drawer swap (e.g. Lead → Group), focus has already moved to the
      // newly-clicked row before this cleanup runs — yanking it back to the
      // old opener would both steal focus from the click and cause the next
      // drawer's mount effect to capture the wrong element as its opener.
      if (panel.contains(document.activeElement)) {
        openerRef.current?.focus();
      }
    };
  }, [opts.open]);

  return {
    panelRef,
    dialogProps: {
      role: 'dialog' as const,
      'aria-modal': true,
      'aria-labelledby': opts.labelledBy,
      tabIndex: -1,
    },
  };
}
