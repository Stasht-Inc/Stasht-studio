import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from '../ui/select';
import { leadsAPI, type AssignableUser, type Lead, type LeadAssignee } from '../../services/leadsAPI';
import { initialsOf } from '../../utils/leadInbox';

// Who owns a lead, and the controls to change it (spec 2026-09-23 §2/§5):
//  - admins (can_assign) get a picker of the dealer team, incl. "Unassigned";
//  - anyone else sees the assignee, or an "Accept" button when nobody has it.
// Parents apply `onChanged` as a patch to their copy of the lead.

const UNASSIGNED = '__unassigned__';

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

  const assign = async (value: string) => {
    const userId = value === UNASSIGNED ? null : Number(value);
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
    return (
      <div onClick={stop} className="min-w-0">
        <Select
          value={lead.assignee ? String(lead.assignee.id) : UNASSIGNED}
          onValueChange={assign}
          onOpenChange={(open) => { if (open) loadTeam(); }}
          disabled={busy}
        >
          <SelectTrigger
            aria-label="Assigned to"
            className={`${size === 'sm' ? 'h-8 text-sm' : 'h-10 text-base'} w-full max-w-[14rem] bg-white border-gray-200 !ring-0 !shadow-none focus-visible:!ring-2 focus-visible:!ring-[#6C60FF]`}
          >
            {busy ? (
              <span className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span>
            ) : lead.assignee ? (
              <AssigneeBadge assignee={lead.assignee} size="sm" />
            ) : (
              <span className="text-gray-500">Unassigned</span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            <SelectSeparator className="bg-gray-200" />
            {loadingTeam && !team && (
              <div className="px-2 py-1.5 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading team…</div>
            )}
            {/* Keep the current assignee selectable even before the team loads. */}
            {lead.assignee && !team?.some((u) => u.id === lead.assignee!.id) && (
              <SelectItem value={String(lead.assignee.id)}><AssigneeBadge assignee={lead.assignee} /></SelectItem>
            )}
            {(team ?? []).map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>
                <span className="flex items-center gap-2">
                  <AssigneeBadge assignee={u} />
                  <span className="text-xs text-gray-500 capitalize">{u.role}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
