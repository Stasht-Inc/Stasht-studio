import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (!opts.open) return;
    openerRef.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    if (!panel) return;

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      );

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
      openerRef.current?.focus();
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
