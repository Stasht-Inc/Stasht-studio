import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { leadsAPI } from '../../services/leadsAPI';
import { getAdminSwitchData, switchAccount, switchIntoAccountForLead } from '../AccountChoiceModal';
import { useProperty } from '../../contexts/PropertyContext';
import { sameOwner } from '../../utils/adminSwitchAccounts';
import { avatarColor } from './AssigneeControl';
import {
  accountInitials, quickSwitchState, unreadBadge,
  type QuickSwitchAccount, type QuickSwitchApiAccount,
} from '../../utils/leadsQuickSwitch';

// Leads quick switch (Deepak + Chris, 14 Nov 2026) — far right of the OPEN / CLOSED row. Rules: utils/leadsQuickSwitch.ts.
// Switching reuses the Profile menu's switch (switchAccount: cached admin_accounts row, /login-as-admin or
// /login-as-partial-admin) — or, for an account the menu has no row for, the lead-link switch — then lands on /leads.

const REFRESH_MS = 60_000;
const ITEM = 'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-gray-900 cursor-pointer focus:bg-gray-200 data-[highlighted]:bg-gray-200';

type Person = { name: string; image: string | null; color: string | null };

function AccountAvatar({ who, size = 'h-7 w-7' }: { who: Person; size?: string }) {
  const bg = avatarColor(who.color);
  return (
    <Avatar className={`${size} shrink-0`}>
      {who.image && <AvatarImage src={who.image} alt="" className="object-cover" />}
      <AvatarFallback className="text-[12px] font-semibold text-white" style={{ backgroundColor: who.color ? bg : '#6B7280' }}>
        {accountInitials(who.name)}
      </AvatarFallback>
    </Avatar>
  );
}

function Badge({ n, className = '' }: { n: number | null | undefined; className?: string }) {
  const text = unreadBadge(n);
  if (!text) return null;
  return (
    <span className={`min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-[18px] text-center ${className}`}>
      {text}
    </span>
  );
}

// Leaving the property view as the lead-link switch does, so the account opens as itself.
const resetView = () => {
  try {
    localStorage.setItem('view_type', 'personal');
    localStorage.removeItem('selected_property');
    localStorage.removeItem('pending_property_switch');
  } catch { /* storage blocked: the reload still lands on /leads */ }
};

export default function LeadsQuickSwitch() {
  const { viewType } = useProperty();
  const [api, setApi] = useState<QuickSwitchApiAccount[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback((fresh: boolean) => {
    leadsAPI.getAdminAccountsUnread(fresh).then((res: any) => {
      const list = res?.data?.accounts ?? res?.accounts;
      // A failed call keeps what was there (or the Profile menu's rows, without counts).
      if (res?.success !== false && Array.isArray(list)) setApi(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    load(false);
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') load(true); }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const state = quickSwitchState(getAdminSwitchData(), api, viewType === 'property');
  if (state.mode === 'none') return null;

  const openAccount = async (acc: QuickSwitchAccount) => {
    if (busy) return;
    setBusy(acc.ownerId);
    const data = getAdminSwitchData();
    let ok = false;
    let error = '';
    if (data?.has_admin_access && data.admin_accounts?.some((r) => sameOwner(r.owner_id, acc.ownerId))) {
      ok = await switchAccount(acc.ownerId).catch(() => false);
    }
    if (!ok) {
      const r = await switchIntoAccountForLead(acc.ownerId, acc.partial, acc.email);
      ok = r.ok;
      error = r.error;
    }
    if (ok) {
      resetView();
      window.location.assign('/leads');
      return;
    }
    toast.error(error || 'Could not open that account.');
    setBusy(null);
  };

  const openPersonal = async () => {
    if (busy) return;
    setBusy('personal');
    if (await switchAccount(null).catch(() => false)) {
      resetView();
      window.location.assign('/leads');
      return;
    }
    toast.error('Could not switch back.');
    setBusy(null);
  };

  const triggerClass = 'relative shrink-0 mb-1.5 inline-flex items-center gap-2 h-9 rounded-full border border-gray-200 bg-white pl-1 pr-1 sm:pr-3 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 disabled:opacity-60';
  const spinner = <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-hidden />;

  const row = (acc: QuickSwitchAccount, current = false) => (
    <DropdownMenuItem
      key={acc.ownerId}
      className={`${ITEM} ${current ? 'bg-gray-200 font-semibold' : ''}`}
      disabled={!!busy}
      onSelect={(e) => { e.preventDefault(); if (!current) openAccount(acc); }}
      aria-current={current ? 'true' : undefined}
    >
      <AccountAvatar who={acc} />
      <span className="flex-1 min-w-0 truncate">{acc.name}</span>
      {busy === acc.ownerId ? spinner : current ? <Check className="h-4 w-4 text-gray-700" aria-hidden /> : <Badge n={acc.unread} />}
    </DropdownMenuItem>
  );

  if (state.mode === 'personal') {
    const first = state.accounts[0];
    const total = state.accounts.reduce((sum, a) => sum + (a.unread ?? 0), 0);
    const anyCount = state.accounts.some((a) => a.unread !== null);
    const inner = (
      <>
        <span className="relative">
          {busy === first.ownerId ? <span className="h-7 w-7 inline-flex items-center justify-center">{spinner}</span> : <AccountAvatar who={first} />}
          <Badge n={anyCount ? (state.accounts.length > 1 ? total : first.unread) : null} className="absolute -top-1.5 -right-2" />
        </span>
        <span className="hidden sm:inline max-w-[160px] truncate text-sm font-medium text-gray-900">
          {state.accounts.length > 1 ? 'Accounts' : first.name}
        </span>
        {state.accounts.length > 1 && <ChevronDown className="hidden sm:block h-4 w-4 text-gray-500" aria-hidden />}
      </>
    );

    if (state.accounts.length === 1) {
      return (
        <button type="button" className={triggerClass} onClick={() => openAccount(first)} disabled={!!busy}
          title={`Open ${first.name}`} aria-label={`Open ${first.name} leads${unreadBadge(first.unread) ? `, ${first.unread} unread` : ''}`}>
          {inner}
        </button>
      );
    }
    return (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={triggerClass} disabled={!!busy} aria-label={`Switch account${total ? `, ${total} unread` : ''}`}>
            {inner}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(280px,calc(100vw-32px))] p-1">
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-gray-500">Open leads</DropdownMenuLabel>
          {state.accounts.map((a) => row(a))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Switched into a business: back to the personal account (its avatar), and the other accounts if there are any.
  const me = state.personal;
  const backInner = (
    <>
      {busy === 'personal' ? <span className="h-7 w-7 inline-flex items-center justify-center">{spinner}</span> : <AccountAvatar who={me} />}
      <span className="hidden sm:inline text-sm font-medium text-gray-900">Personal</span>
      {state.others.length > 0 && <ChevronDown className="hidden sm:block h-4 w-4 text-gray-500" aria-hidden />}
      {state.others.length > 0 && <Badge n={state.others.reduce((s, a) => s + (a.unread ?? 0), 0)} className="absolute -top-1.5 left-5" />}
    </>
  );

  if (state.others.length === 0) {
    return (
      <button type="button" className={triggerClass} onClick={openPersonal} disabled={!!busy}
        title="Back to your personal account" aria-label="Back to your personal leads">
        {backInner}
      </button>
    );
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} disabled={!!busy} aria-label="Switch account">
          {backInner}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(280px,calc(100vw-32px))] p-1">
        <DropdownMenuItem className={ITEM} disabled={!!busy} onSelect={(e) => { e.preventDefault(); openPersonal(); }}>
          <AccountAvatar who={me} />
          <span className="flex-1 min-w-0 truncate">Personal</span>
          {busy === 'personal' && spinner}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row(state.current, true)}
        {state.others.map((a) => row(a))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
