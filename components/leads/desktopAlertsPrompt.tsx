import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import { enableWebPush, getWebPushState } from '../../utils/webPush';

// Desktop alerts start off (Chris, 2026-09-24). The first time someone has an
// unread lead notification in the bell, we ask once whether they want them on.
// "Once" is per user per browser; after that it lives in Settings.

const LEAD_TYPES = ['lead_message', 'lead_unassigned', 'lead_assigned', 'lead_reply'];
let askedThisSession = false;

function currentUserId(): string | null {
  try {
    const u = JSON.parse(localStorage.getItem('stasht_user') || 'null');
    const id = u?.external_user_id ?? u?.id;
    return id != null ? String(id) : null;
  } catch {
    return null;
  }
}

function alreadyAsked(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return askedThisSession; }
}

function markAsked(key: string) {
  askedThisSession = true;
  try { localStorage.setItem(key, '1'); } catch { /* private mode: session flag covers it */ }
}

export async function maybeAskForDesktopAlerts(notifications: any[]): Promise<void> {
  if (askedThisSession) return;
  const hasUnreadLeadAlert = notifications.some((n) =>
    LEAD_TYPES.includes(String(n?.type)) && !(n?.is_read === true || n?.is_read === 1));
  if (!hasUnreadLeadAlert) return;

  const userId = currentUserId();
  if (!userId) return;
  const key = `stasht_desktop_alerts_asked_${userId}`;
  if (alreadyAsked(key)) return;

  // Only ask when it could actually be turned on here and isn't already.
  if ((await getWebPushState()) !== 'off') return;
  if (askedThisSession) return; // another poll got here while we awaited
  markAsked(key);

  toast.custom((id) => (
    <div className="w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-[#6C60FF]">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Turn on desktop alerts?</p>
          <p className="mt-1 text-sm text-gray-600">
            You have a new lead notification. Get new leads, assignments and replies on your desktop, even when Studio is in the background.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            toast.dismiss(id);
            toast('You can turn desktop alerts on anytime in Settings → Notification Preferences.');
          }}
          className="flex-1 h-10 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={async () => {
            toast.dismiss(id);
            const next = await enableWebPush();
            if (next === 'on') toast.success('Desktop alerts on. You’ll get new leads and replies here.');
            else if (next === 'blocked') toast.error('Notifications are blocked for this site. Allow them in your browser’s site settings.');
          }}
          className="flex-1 h-10 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium"
        >
          Turn on
        </button>
      </div>
    </div>
  ), { duration: Infinity });
}
