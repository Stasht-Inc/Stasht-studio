// Leads "Assigned to" filter (Chris 11 Nov 2026 (d)): a MULTI-SELECT. Each choice is a checkbox and the server returns
// the union of the ticked ones. The filter value LeadsTab keeps is one string:
//
// - DEFAULT ('all') → assigned=default (the server's default, which the unread badge also follows). Shown ticked as
//   Anyone + Open for the owner and anyone switched into the account; Me + Open for staff in their own account.
// - ALL_LEADS → "All leads": every lead (ticks everything). Owners, and full Admins (team=all). Never a Partial Admin.
// - otherwise a comma list of tokens: ANY ("Anyone" = a real assignee), OPEN (waiting to be accepted), 'me',
//   'unassigned' (no assignee at all, imports included), or a teammate's id.

export type TeamLeads = { staff: boolean; can_see_all: boolean; scope?: string } | null | undefined;
export type AssignedOption = { value: string; label: string };
export type Teammate = { id: number; name: string | null };

export const DEFAULT = 'all';
/** "All leads": everything, assigned or not. */
export const ALL_LEADS = 'all-leads';
/** "Anyone": leads someone has really taken. */
export const ANY = 'any';
/** "Open": waiting to be accepted. */
export const OPEN = 'open';

export type AssignedParams = { assigned?: string; team?: 'all' };

const isPartial = (t: TeamLeads) => !!t?.staff && !t.can_see_all;

/** "All leads" is offered to owners (and anyone switched in) and full Admins; a Partial Admin keeps their own reach. */
export const offersAllLeads = (t: TeamLeads) => !isPartial(t);

/** The ticked choices of the default view. */
export function defaultTicks(t: TeamLeads): string[] {
  return t?.staff ? ['me', OPEN] : [ANY, OPEN];
}

/** The checkbox choices, in order (without "All leads"). Partial Admins get no "Anyone". */
export function assignedOptions(t: TeamLeads, teammates: Teammate[] = []): AssignedOption[] {
  return [
    ...(isPartial(t) ? [] : [{ value: ANY, label: 'Anyone' }]),
    { value: OPEN, label: 'Open' },
    { value: 'me', label: 'Me' },
    { value: 'unassigned', label: 'Unassigned' },
    ...teammates.map((a) => ({ value: String(a.id), label: a.name ?? `Teammate #${a.id}` })),
  ];
}

/** Which choices show ticked for a filter value. */
export function ticksOf(value: string, t: TeamLeads, options: AssignedOption[]): string[] {
  if (value === DEFAULT) return defaultTicks(t);
  if (value === ALL_LEADS) return options.map((o) => o.value);
  return value.split(',').filter(Boolean);
}

/** The new filter value after ticking/unticking `token` (or "All leads"). Never leaves nothing ticked. */
export function toggleAssigned(value: string, token: string, t: TeamLeads, options: AssignedOption[]): string {
  if (token === ALL_LEADS) return value === ALL_LEADS ? DEFAULT : ALL_LEADS;
  const ticks = new Set(ticksOf(value, t, options));
  if (ticks.has(token)) ticks.delete(token); else ticks.add(token);
  if (ticks.size === 0) return value;
  const order = options.map((o) => o.value);
  const next = [...ticks].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v) => b.includes(v));
  if (same(next, defaultTicks(t))) return DEFAULT;
  if (offersAllLeads(t) && same(next, order)) return ALL_LEADS;
  return next.join(',');
}

/** The trigger's text: "Anyone, Open", "Me, Open", "All leads", "3 selected". */
export function assignedLabel(value: string, t: TeamLeads, options: AssignedOption[]): string {
  if (value === ALL_LEADS) return 'All leads';
  const ticks = ticksOf(value, t, options);
  if (ticks.length > 2) return `${ticks.length} selected`;
  return ticks.map((v) => options.find((o) => o.value === v)?.label ?? (Number(v) > 0 ? 'Teammate' : v)).join(', ');
}

export function assignedParams(value: string, t: TeamLeads): AssignedParams {
  if (value === DEFAULT) return { assigned: 'default' };
  // A full Admin looks across the accounts they help run (team=all); the server never widens a Partial Admin.
  const team: AssignedParams = t?.can_see_all ? { team: 'all' } : {};
  if (value === ALL_LEADS) return isPartial(t) ? { assigned: 'default' } : team;
  const tokens = value.split(',').filter((v) => v === ANY || v === OPEN || v === 'me' || v === 'unassigned' || Number(v) > 0);
  return tokens.length ? { ...team, assigned: tokens.join(',') } : { assigned: 'default' };
}
