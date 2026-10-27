// Toasts while the newsletter composer shows. App's Toaster sits top-right, right over the composer header's
// Cancel / Save Draft / Send now. While the composer is on screen, its toasts go to this second Toaster instead:
// bottom-right on wide screens (over the email preview; the button row is in the left column), and just under
// the header on narrower screens, where the header has no action buttons on phones and the Cancel / Save Draft /
// Send Now row is in the page flow, not pinned to the bottom. Every other toast in the app is unchanged.
import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Toaster, toast, type ExternalToast } from 'sonner';

const COMPOSER_TOASTER_ID = 'newsletter-composer';
const WIDE = '(min-width: 1024px)';

// How many composer toasters are on screen. Toasts asked for while none is (the gallery harness, or a toast
// fired as the composer closes) go to App's Toaster as before.
let onScreen = 0;
const target = (data?: ExternalToast): ExternalToast | undefined =>
  (onScreen > 0 ? { ...data, toasterId: COMPOSER_TOASTER_ID } : data);

type Message = Parameters<typeof toast.success>[0];

/** sonner's toast, aimed at the composer's Toaster while it shows. */
export const composerToast = {
  success: (message: Message, data?: ExternalToast) => toast.success(message, target(data)),
  error: (message: Message, data?: ExternalToast) => toast.error(message, target(data)),
  info: (message: Message, data?: ExternalToast) => toast.info(message, target(data)),
};

function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** The composer header's bottom edge, kept up to date as it wraps (phones put the switcher on its own row). */
function useBottomEdge(ref: RefObject<HTMLElement>): number {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setBottom(Math.ceil(el.getBoundingClientRect().bottom));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return bottom;
}

export default function ComposerToaster({ headerRef }: { headerRef: RefObject<HTMLElement> }) {
  const wide = useMatches(WIDE);
  const headerBottom = useBottomEdge(headerRef);

  useEffect(() => {
    onScreen += 1;
    return () => { onScreen -= 1; };
  }, []);

  const below = { top: headerBottom + 8, left: 16, right: 16 };
  // Portalled to body so it is above the composer layer (z-index 99999) and its own dialogs.
  return createPortal(
    <Toaster
      id={COMPOSER_TOASTER_ID}
      position={wide ? 'bottom-right' : 'top-center'}
      offset={wide ? 24 : below}
      mobileOffset={below}
      expand
      richColors
      duration={4000}
      // Same look as App's Toaster.
      toastOptions={{
        unstyled: false,
        classNames: { error: 'border-red-400', success: 'border-green-400' },
        style: { background: 'white', color: '#374151', border: '1px solid #E5E7EB' },
      }}
    />,
    document.body,
  );
}
