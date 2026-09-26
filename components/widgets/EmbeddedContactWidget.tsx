import { useEffect } from 'react';
import { installOrigin } from './widgetHelpers';

/** Stasht's own Contact Us widget on the Studio login page (created in Connectors, "Login Page"). */
export const LOGIN_PAGE_WIDGET_ID = 'w_tws45lmxaf';

/**
 * Installs a Contact Us widget on the current Studio screen exactly as a customer's site would
 * (same loader script), and removes it again when the screen unmounts, since Studio is a SPA.
 */
export function EmbeddedContactWidget({ widgetId }: { widgetId: string }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = `${installOrigin()}/widget-loader.js`;
    script.async = true;
    script.setAttribute('data-widget-id', widgetId);
    document.body.appendChild(script);

    return () => {
      // A removed tag that hasn't run yet is skipped by the loader; one that has run left an iframe.
      script.remove();
      document.getElementById(`stasht-widget-${widgetId}`)?.remove();
    };
  }, [widgetId]);

  return null;
}
