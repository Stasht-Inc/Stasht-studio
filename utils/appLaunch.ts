// Links opened INTO the installed Stasht Studio app (Chrome / Edge desktop PWA), e.g. the lead email's
// "Open conversation" → /leads?lead=N (11 Nov 2026). The web manifest (vite.config.ts) asks the browser to capture
// in-scope links into the app (handle_links: "preferred") and to reuse the open app window instead of opening a new one
// (launch_handler client_mode "focus-existing"). With focus-existing the window is NOT reloaded — the browser only hands
// the link to window.launchQueue, so Studio routes to the lead itself and nothing on screen (e.g. a newsletter draft)
// is lost. Browsers without launchQueue (Safari, Firefox) simply never call this.

export type LaunchTarget = { kind: 'lead'; leadId: number } | { kind: 'url'; url: string };

/** What a launch URL asks for: a lead (/leads?lead=N on this origin), another Studio page, or nothing usable. */
export function launchTarget(targetURL: string | null | undefined, origin: string): LaunchTarget | null {
  if (!targetURL) return null;
  let url: URL;
  try {
    url = new URL(targetURL, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/leads') {
    const raw = url.searchParams.get('lead');
    const leadId = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
    if (leadId > 0) return { kind: 'lead', leadId };
  }
  return { kind: 'url', url: url.href };
}

type LaunchParams = { targetURL?: string | null };
type LaunchQueueLike = { setConsumer: (consumer: (params: LaunchParams) => void) => void };

/** The URL this document was loaded with (before any replaceState), so the launch that opened it is not replayed. */
function documentLoadUrl(): string | null {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.name || null;
  } catch {
    return null;
  }
}

/**
 * Registers the launchQueue consumer. Returns true when the browser supports it.
 * The launch that opened this very window is skipped — the normal start-up URL handling (App.tsx) already did it.
 */
export function installLaunchConsumer(
  handlers: { onLead: (leadId: number) => void; onUrl: (url: string) => void },
  win: (Window & { launchQueue?: LaunchQueueLike }) | undefined = typeof window !== 'undefined' ? window : undefined,
  loadUrl: string | null = documentLoadUrl(),
): boolean {
  const queue = win?.launchQueue;
  if (!win || !queue || typeof queue.setConsumer !== 'function') return false;
  let first = true;
  queue.setConsumer((params) => {
    const isOpeningLaunch = first && !!loadUrl && params?.targetURL === loadUrl;
    first = false;
    if (isOpeningLaunch) return;
    const target = launchTarget(params?.targetURL, win.location.origin);
    if (!target) return;
    if (target.kind === 'lead') {
      handlers.onLead(target.leadId);
    } else if (target.url !== win.location.href) {
      handlers.onUrl(target.url);
    }
  });
  return true;
}

/** True inside the installed app window (Chrome/Edge PWA, or a Safari "Add to Dock" web app). */
export function isInstalledAppWindow(win: Window | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win) return false;
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* ignore */ }
  return (win.navigator as Navigator & { standalone?: boolean })?.standalone === true;
}
