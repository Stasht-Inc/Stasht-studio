import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Loader2, UserCheck, UserX } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { leadsAPI, type AssignableUser, type Lead, type LeadAssignee } from '../../services/leadsAPI';
import { initialsOf } from '../../utils/leadInbox';

// Who owns a lead, and the controls to change it (spec 2026-09-23 §2/§5):
//  - admins (can_assign) get a picker of the dealer team, incl. "Unassigned";
//  - anyone else sees the assignee, or an "Accept" button when nobody has it.
// Parents apply `onChanged` as a patch to their copy of the lead.

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', rep: 'Rep' };

export function avatarColor(color: string | null | undefined): string {
  if (!color) return '#6C60FF';
  return color.startsWith('#') ? color : `#${color}`;
}

export function AssigneeBadge({ assignee, size = 'sm' }: { assignee: LeadAssignee; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-6 w-6 text-[12px]' : 'h-8 w-8 text-sm';
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span
        className={`${dim} shrink-0 rounded-full inline-flex items-center justify-center text-white font-semibold`}
        style={{ backgroundColor: avatarColor(assignee.profile_color) }}
        aria-hidden
      >
        {initialsOf(assignee.name)}
      </span>
      <span className="truncate text-gray-800">{assignee.name ?? 'Team member'}</span>
    </span>
  );
}

interface Props {
  lead: Lead;
  onChanged: (patch: Partial<Lead>) => void;
  size?: 'sm' | 'md';
}

export default function AssigneeControl({ lead, onChanged, size = 'sm' }: Props) {
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<AssignableUser[] | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      const res: any = await leadsAPI.acceptLead(lead.id);
      if (res.success && res.data) {
        onChanged({ assignee: res.data.assignee, can_message: true, is_rollup: false });
        toast.success('Lead accepted — it’s yours');
      } else if (res.conflict && res.taken_by) {
        onChanged({ assignee: res.taken_by, can_message: false, is_rollup: true });
        toast.error(`Already taken by ${res.taken_by.name ?? 'a teammate'}`);
      } else {
        toast.error(res.error || 'Could not accept this lead');
      }
    } catch {
      toast.error('Could not accept this lead');
    } finally {
      setBusy(false);
    }
  };

  const loadTeam = async () => {
    if (team || loadingTeam) return;
    setLoadingTeam(true);
    try {
      const res = await leadsAPI.getAssignableUsers(lead.id);
      setTeam(res.success && res.data ? res.data.users : []);
    } catch {
      setTeam([]);
    } finally {
      setLoadingTeam(false);
    }
  };

  const assign = async (userId: number | null) => {
    if (userId === (lead.assignee?.id ?? null)) return;
    setBusy(true);
    try {
      const res = await leadsAPI.assignLead(lead.id, userId);
      if (res.success && res.data) {
        onChanged({ assignee: res.data.assignee });
        toast.success(res.data.assignee ? `Assigned to ${res.data.assignee.name ?? 'teammate'}` : 'Lead unassigned');
      } else {
        toast.error(res.error || 'Could not assign this lead');
      }
    } catch {
      toast.error('Could not assign this lead');
    } finally {
      setBusy(false);
    }
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (lead.can_assign) {
    // A menu rather than a Select: Select marks the chosen option aria-selected,
    // and an app-wide [aria-selected="true"] rule paints it solid purple, which
    // made the current assignee's role unreadable.
    const currentId = lead.assignee?.id ?? null;
    const people = [
      ...(lead.assignee && !team?.some((u) => u.id === lead.assignee!.id) ? [{ ...lead.assignee, role: '' }] : []),
      ...(team ?? []),
    ];
    return (
      <div onClick={stop} className="min-w-0">
        <DropdownMenu onOpenChange={(open) => { if (open) loadTeam(); }}>
          <DropdownMenuTrigger asChild disabled={busy}>
            <button
              type="button"
              aria-label="Assigned to"
              className={`${size === 'sm' ? 'h-9 text-sm' : 'h-10 text-base'} w-full max-w-[15rem] inline-flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-left hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] disabled:opacity-60`}
            >
              {busy ? (
                <span className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span>
              ) : lead.assignee ? (
                <AssigneeBadge assignee={lead.assignee} size="sm" />
              ) : (
                <span className="inline-flex items-center gap-2 text-gray-500"><UserX className="w-4 h-4" />Unassigned</span>
              )}
              <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={6} className="w-72 p-1.5 bg-white border border-gray-200 shadow-lg rounded-xl">
            <DropdownMenuLabel className="px-2.5 pt-1.5 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Assign lead to</DropdownMenuLabel>
            {loadingTeam && !team && (
              <div className="px-2.5 py-2 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading team…</div>
            )}
            {people.map((u) => {
              const isCurrent = u.id === currentId;
              return (
                <DropdownMenuItem
                  key={u.id}
                  onSelect={() => assign(u.id)}
                  className={`cursor-pointer rounded-lg px-2.5 py-2 flex items-center gap-2.5 outline-none focus:outline-none focus-visible:outline-none focus:bg-gray-50 ${isCurrent ? 'bg-purple-50 focus:bg-purple-50' : ''}`}
                >
                  <span className="min-w-0 flex-1"><AssigneeBadge assignee={u} size="md" /></span>
                  {u.role && ROLE_LABEL[u.role] && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{ROLE_LABEL[u.role]}</span>
                  )}
                  <Check className={`w-4 h-4 shrink-0 text-[#6C60FF] ${isCurrent ? 'visible' : 'invisible'}`} aria-hidden />
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="my-1.5 bg-gray-100" />
            <DropdownMenuItem
              onSelect={() => assign(null)}
              className={`cursor-pointer rounded-lg px-2.5 py-2 flex items-center gap-2.5 outline-none focus:outline-none focus-visible:outline-none text-gray-700 focus:bg-gray-50 ${currentId === null ? 'bg-purple-50 focus:bg-purple-50' : ''}`}
            >
              <span className="h-8 w-8 shrink-0 rounded-full border border-dashed border-gray-300 inline-flex items-center justify-center text-gray-400"><UserX className="w-4 h-4" /></span>
              <span className="flex-1">Unassigned <span className="block text-xs text-gray-500">Team can accept it</span></span>
              <Check className={`w-4 h-4 shrink-0 text-[#6C60FF] ${currentId === null ? 'visible' : 'invisible'}`} aria-hidden />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  if (lead.assignee) {
    return <AssigneeBadge assignee={lead.assignee} size={size} />;
  }

  return (
    <button
      type="button"
      onClick={(e) => { stop(e); accept(); }}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white font-semibold disabled:opacity-60 ${size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-base'}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
      Accept
    </button>
  );
}
