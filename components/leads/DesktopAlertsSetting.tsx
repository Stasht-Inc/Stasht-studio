import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { disableWebPush, enableWebPush, getWebPushState, type WebPushState } from '../../utils/webPush';

// "Desktop alerts" row in Settings → Notification Preferences (Chris, 2026-09-24:
// moved off the Leads page, off by default). It's a per-browser OneSignal
// subscription rather than an account preference, so it applies straight away
// instead of waiting for the section's Save button.
export default function DesktopAlertsSetting({ variant }: { variant: 'pill' | 'switch' }) {
  const [state, setState] = useState<WebPushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWebPushState().then((s) => { if (!cancelled) setState(s); });
    return () => { cancelled = true; };
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === 'on') {
        setState(await disableWebPush());
        toast.success('Desktop alerts turned off for this browser');
      } else {
        const next = await enableWebPush();
        setState(next);
        if (next === 'on') toast.success('Desktop alerts on. You’ll get new leads and replies here.');
        else if (next === 'blocked') toast.error('Notifications are blocked for this site. Allow them in your browser’s site settings.');
      }
    } finally {
      setBusy(false);
    }
  };

  const on = state === 'on';
  const note =
    state === 'unavailable' ? 'Not available in this browser'
    : state === 'blocked' ? 'Blocked. Allow notifications for this site in your browser’s settings (the icon left of the address bar).'
    : null;

  let control: ReactNode;
  if (state === 'loading' || busy) {
    control = <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-label="Loading" />;
  } else if (note) {
    control = <span className="text-sm text-gray-500">Off</span>;
  } else if (variant === 'switch') {
    control = (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Desktop alerts"
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-[#6C60FF]' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    );
  } else {
    control = (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className={`px-4 py-1 rounded-full text-sm font-medium transition-colors text-white ${on ? 'bg-green-500' : 'bg-red-500'}`}
      >
        {on ? 'On' : 'Off'}
      </button>
    );
  }

  return (
    <div className="flex justify-between items-center gap-4">
      <div className="min-w-0">
        <span className="text-gray-700">{variant === 'pill' ? 'Desktop Alerts:' : 'Desktop Alerts'}</span>
        <p className="text-xs text-gray-500 mt-1">{note ?? 'New leads, assignments and replies, in this browser'}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
