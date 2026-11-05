import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { clearAdminSwitchData, getAdminSwitchData, switchAccount } from './AccountChoiceModal';

// The way out of the new-account plan picker (Chris, 5 Nov 2026: "I can't get off it!!"). The picker can't be closed,
// so it always offers "Sign out", and — when this browser switched into another account from the Profile menu — the
// way back to the account that signed in ("Switch to Pedalheads"), the same switch the Profile menu makes.
export default function PlanGateExits() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const switchData = getAdminSwitchData();
  const personal = switchData?.current_mode === 'admin' ? switchData.personal_account?.user : null;
  const personalName = personal ? String(personal.name || personal.email || personal.phone_number || 'your account') : '';

  const switchBack = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await switchAccount(null).catch(() => false);
    if (ok) window.location.reload();
    else setBusy(false);
  };

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    clearAdminSwitchData();
    await logout();
  };

  const link = 'text-sm font-medium text-white/80 underline underline-offset-2 hover:text-white disabled:opacity-60';
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" data-name="PlanGateExits">
      {personal && (
        <button type="button" onClick={switchBack} disabled={busy} className={link}>
          Switch to {personalName}
        </button>
      )}
      <button type="button" onClick={signOut} disabled={busy} className={link}>
        Sign out
      </button>
    </div>
  );
}
