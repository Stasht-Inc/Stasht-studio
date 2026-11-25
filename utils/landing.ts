// The one-time landing after sign-in (App; release E2E, 5 Nov 2026, B1).
//
// Deepak, 24 Nov 2026 (P4): Campaigns is first in the menu and is where Studio opens — after sign-in, on '/', after an
// account switch and for any address Studio doesn't know. The old Dashboard is now "Stats" (page id still
// 'dashboard'); its address /dashboard (and old links to it) opens Stats.
//
// Role 3 / 4 accounts (and invite sign-ins) land on Campaigns instead of Dashboard. That is decided ONCE, when the
// sign-in is ready, on the page the app opened on. Opened on another page it is simply done — before, it stayed pending
// and fired on the person's first Dashboard click, bouncing them back to Campaigns.

/** 'wait' (not ready, or already decided), 'campaigns' (go there now, then done) or 'done' (stay, mark decided). */
export function landingAfterSignIn({ authReady, done, currentPage, role, inviteLanding }: {
  authReady: boolean;
  done: boolean;
  currentPage: string;
  role: unknown;
  inviteLanding: boolean;
}): 'wait' | 'campaigns' | 'done' {
  if (!authReady || done) return 'wait';
  if (currentPage !== 'dashboard') return 'done';
  if (inviteLanding) return 'campaigns';
  const value = String(role ?? '');
  return value === '3' || value === '4' ? 'campaigns' : 'done';
}


/** Where Studio opens when nothing else asks for a page: Campaigns (App.tsx currentPage id). */
export const LANDING_PAGE = 'memories';

/**
 * The page the app starts on, from the address it opened at: /dashboard is Stats, everything else starts on the landing
 * page (App's mount effect then moves /media, /leads, /products … to their own page, as before).
 */
export function initialPage(pathname: string): string {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') ? 'dashboard' : LANDING_PAGE;
}
