// Leads "Assigned to" filter (Chris 11 Nov 2026): what each option is called and what it asks the web API for.
//
// - 'all' (the default) → assigned=default. Owner: "Anyone" = only leads that HAVE an assignee (incl. the owner's
//   arrival hold). Staff in their own account: "Me + new" (unchanged).
// - TEAM_ALL (full Admins only) → "Anyone": team=all + assigned=any — oversight of every assigned lead.
// - ALL_LEADS → "All leads": every lead (the old "Anyone"). Owners, and staff who may see all (team=all).
// - 'me' / 'unassigned' / a teammate id → unchanged.

export type TeamLeads = { staff: boolean; can_see_all: boolean; scope?: string } | null | undefined;

/** A full Admin's "Anyone" (team=all, assigned leads only). */
export const TEAM_ALL = 'team-all';
/** "All leads": everything, assigned or not. */
export const ALL_LEADS = 'all-leads';

export type AssignedParams = { assigned?: 'me' | 'unassigned' | 'any' | 'default' | number; team?: 'all' };

export function assignedParams(value: string, teamLeads: TeamLeads): AssignedParams {
  if (value === 'all') return { assigned: 'default' };
  if (value === TEAM_ALL) return { team: 'all', assigned: 'any' };
  if (value === ALL_LEADS) return teamLeads?.can_see_all ? { team: 'all' } : {};
  if (value === 'me' || value === 'unassigned') return { assigned: value };
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? { assigned: id } : { assigned: 'default' };
}

/** The options before "Me" / "Unassigned" / teammates, in order. `short` drops the "Assigned to: " prefix (phone chips). */
export function leadingAssignedOptions(teamLeads: TeamLeads, short = false): { value: string; label: string }[] {
  const p = short ? '' : 'Assigned to: ';
  if (teamLeads?.staff) {
    return [
      { value: 'all', label: `${p}Me + new` },
      ...(teamLeads.can_see_all ? [{ value: TEAM_ALL, label: `${p}Anyone` }, { value: ALL_LEADS, label: 'All leads' }] : []),
    ];
  }
  return [{ value: 'all', label: `${p}Anyone` }, { value: ALL_LEADS, label: 'All leads' }];
}
