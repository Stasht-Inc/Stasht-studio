import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from '../../utils/webPush';

// "Desktop alerts" switch on the Leads page: opts this browser in to lead
// notifications (new lead, assigned to you, customer replied). Hidden where web
// push isn't available (see utils/webPush.ts). We ask from this button rather
// than on page load, which browsers penalise.
export default function DesktopAlertsToggle() {
  const [state, setState] = useState<WebPushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWebPushState().then((s) => { if (!cancelled) setState(s); });
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading' || state === 'unavailable') return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === 'on') {
        setState(await disableWebPush());
        toast.success('Desktop alerts turned off for this browser');
      } else {
        const next = await enableWebPush();
        setState(next);
        if (next === 'on') toast.success('Desktop alerts on — you’ll get new leads and replies here');
        else if (next === 'blocked') toast.error('Notifications are blocked for this site. Allow them in your browser’s site settings.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (state === 'blocked') {
    return (
      <span
        title="Notifications are blocked for this site. Allow them in your browser's site settings (the icon left of the address bar)."
        className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-500"
      >
        <BellOff className="w-4 h-4" />Alerts blocked
      </span>
    );
  }

  const on = state === 'on';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      title={on ? 'Turn off desktop alerts for this browser' : 'Get desktop alerts for new leads and replies'}
      className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-60 ${on ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : on ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      {on ? 'Desktop alerts on' : 'Enable desktop alerts'}
    </button>
  );
}
