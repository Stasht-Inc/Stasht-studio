import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authAPI } from '../utils/authUtils';
import SessionValidator from '../utils/sessionValidator';
import StashtLogo from '../components/StashtLogo';

// Module-level guard: survives React StrictMode's double-invoke (and any remount)
// in the same page load, so a single code is exchanged exactly once.
let ssoExchangeStarted = false;

/**
 * Inbound SSO landing page.
 * An external portal redirects here as /sso#code=XXXX (code in the URL FRAGMENT).
 * We exchange the code (via the normal API base — route is /api/react/sso/exchange)
 * for a session token, store it exactly like a normal login, then redirect into the
 * app. Any failure falls back to /login.
 */
export default function Sso() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('🟣 [SSO] mounted. href:', window.location.href, '| guard:', ssoExchangeStarted);

    // Re-entry guard (StrictMode double-invoke, remount, back/forward, bfcache).
    // The first run owns the exchange; later runs do nothing.
    if (ssoExchangeStarted) {
      console.warn('🟣 [SSO] guard already set → skipping (no exchange this run)');
      return;
    }

    // The code is in the URL FRAGMENT (#), not the query string (?)
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get('code');
    console.log('🟣 [SSO] parsed code:', code);

    if (!code) {
      // No code (direct visit / already consumed) → go to login
      console.warn('🟣 [SSO] no code → /login');
      navigate('/login');
      return;
    }

    // Claim this exchange and IMMEDIATELY wipe the code from the URL so it can
    // never be re-exchanged (e.g. on reload, back nav, or right after logout).
    ssoExchangeStarted = true;
    window.history.replaceState({}, '', '/sso');

    (async () => {
      try {
        console.log('🟣 [SSO] calling authAPI.ssoExchange…');
        const res = await authAPI.ssoExchange(code);
        console.log('🟣 [SSO] exchange result:', res);

        if (!res.success || !res.user || !res.token) {
          console.error('❌ SSO exchange failed:', res.error);
          navigate('/login');
          return;
        }

        const { user, token } = res;

        // Store EXACTLY like normal login — these are the keys this app authenticates on
        localStorage.setItem('stasht_token', token);
        localStorage.setItem('stasht_user', JSON.stringify(user));

        // Initialize session validation (email OR phone_number as identifier)
        const userIdentifier = user.email || user.phone_number;
        if (user.id && userIdentifier) {
          SessionValidator.initSession(user.id, userIdentifier, token);
        }

        // Cross-tab session-change event (same as login)
        localStorage.setItem('stasht_session_change', JSON.stringify({
          userId: user.id,
          email: user.email,
          phone_number: user.phone_number,
          timestamp: Date.now(),
        }));

        // 60-second logout-protection window (same as login)
        localStorage.setItem('last_successful_login_timestamp', String(Date.now()));

        // Hard redirect so AuthContext re-reads storage and authenticates the user
        // (code was already wiped from the URL before the exchange)
        window.location.replace('/');
      } catch (e) {
        console.error('❌ SSO exchange error:', e);
        navigate('/login');
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <StashtLogo className="h-12 w-auto max-w-[180px] object-contain mb-6" fill="#6C60FF" />
      <div className="flex items-center gap-3 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" />
        <span className="text-base font-medium">Signing you in…</span>
      </div>
    </div>
  );
}
