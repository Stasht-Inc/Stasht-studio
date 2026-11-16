import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  ArchiveRestore, Check, CheckCheck, Copy, ExternalLink, Eye, EyeOff, MessageSquare, MoreHorizontal, Trash2, UserPlus,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { leadViaLabel, leadViaTitle } from '../../services/leadsAPI';
import type { Lead } from '../../services/leadsAPI';
import { STATUS_STYLES, type LeadStatus } from '../LeadDetailsSidebar';
import AssigneeControl, { AssigneeBadge } from './AssigneeControl';
import RowActionButton from './RowActionButton';
import CampaignDeletedTag from './CampaignDeletedTag';
import LeadBusinessTag from './LeadBusinessTag';
import WantsMoreTag from './WantsMoreTag';
import OpenBadge, { openTitle } from './OpenBadge';
import ClaimedBadge, { claimedTitle } from './ClaimedBadge';
import {
  formatInboxDate, formatInboxDateMedium, formatInboxDateShort, inboxExcerpt, isUnread, leadEmail, leadPhone,
} from '../../utils/leadInbox';

// Compact inbox-style Leads list, modelled on Toolbox's Messages table (Chris,
// ClickUp wdy2xh1f6j): one 36px line per lead, action icons on row hover.
//
// Columns adapt to the table's own width (a CSS container query, so the
// sidebar being open or minimised is accounted for):
//   < 62rem  Phone/Email share a column, date without weekday, table scrolls
//   ≥ 62rem  separate Email column
//   ≥ 70rem  full "Wed, Sep 23, 2026 11:28 PM" date

interface Props {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
  emptyState: React.ReactNode;
  selectedLeadId?: number | null;
  isClosedTab: boolean;
  onSelect: (lead: Lead) => void;
  onArchive: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onMarkRead: (lead: Lead) => void;
  onLeadPatched: (leadId: number, patch: Partial<Lead>) => void;
  // "Remove" on a lead someone else claimed: off this person's list only (Chris 13 Nov 2026).
  onRemove?: (lead: Lead) => void;
  // "Join" a lead someone else claimed: read and reply as yourself (Chris 13 Nov 2026 evening).
  onJoin?: (lead: Lead) => void;
  // Bulk choice (Chris 16 Nov 2026, "bulk marked as read"): a checkbox per row and one for the page, as on a List's page.
  chosen?: ReadonlySet<number>;
  onChoose?: (leadId: number) => void;
  onChoosePage?: (leadIds: number[]) => void;
}

// A lead this person may open can be chosen; a claimed one they can't open has nothing to act on.
export function choosableLeadIds(leads: Lead[]): number[] {
  return leads.filter((l) => l.can_open !== false).map((l) => l.id);
}

// A claimed lead this person may no longer open (a Partial Admin's, a salesperson's): its row says who has it instead,
// with Join when they may join it.
function openOrSayClaimed(lead: Lead, onSelect: (lead: Lead) => void, onJoin?: (lead: Lead) => void) {
  if (lead.can_open === false) {
    toast(claimedTitle(lead), lead.can_join && onJoin ? { action: { label: 'Join', onClick: () => onJoin(lead) } } : undefined);
    return;
  }
  onSelect(lead);
}

// Hover actions show while the row is hovered, has focus, or one of its menus
// is open; touch screens (no hover) always show them. focus-within, not
// :has(:focus-visible) — Chrome didn't match the latter once Tab moved from the
// row onto a button, which hid the button and dropped focus to <body>.
const SHOW_WHEN_ROW_ACTIVE =
  'hidden group-hover:flex group-focus-within:flex has-[[data-state=open]]:flex [@media(hover:none)]:flex';
const HIDE_WHEN_ROW_ACTIVE =
  'group-hover:hidden group-focus-within:hidden group-has-[[data-state=open]]:hidden [@media(hover:none)]:hidden';

const CELL = 'h-9 px-3 py-0 text-sm align-middle';
const HEAD = 'h-10 px-3 text-left text-sm font-bold text-gray-700 whitespace-nowrap';

// The phone/email have their own columns, so an unnamed contact shows "—" here
// (as in Chris's reference) rather than repeating the number.
function leadName(lead: Lead): string {
  return lead.user?.name?.trim() || '—';
}

const STATUS_ICON: Partial<Record<LeadStatus, { src: string; className: string }>> = {
  hot: { src: '/hot-icon.svg', className: 'w-2.5 h-3' },
  warm: { src: '/warm-icon.svg', className: 'w-2 h-3' },
  cold: { src: '/cold-icon.svg', className: 'w-3 h-3' },
};

function StatusIndicator({ status }: { status: Lead['status'] }) {
  if (!status) return null;
  const label = `${status.charAt(0).toUpperCase()}${status.slice(1)} lead`;
  const icon = STATUS_ICON[status];
  if (icon) {
    return (
      <span role="img" aria-label={label} title={label} className={`shrink-0 inline-flex items-center justify-center h-5 w-6 rounded border ${STATUS_STYLES[status]}`}>
        <img src={icon.src} className={icon.className} alt="" />
      </span>
    );
  }
  return (
    <span title={label} className={`shrink-0 inline-flex items-center h-5 px-1.5 rounded border text-[12px] font-semibold capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// Open lead: gray (Chris 14 Nov 2026: selected = darker gray, not purple). New (unread): soft yellow, Chris's
// "this is new" cue. Else plain.
function rowBackground(selected: boolean, unread: boolean, chosen = false): string {
  if (selected) return 'bg-gray-100';
  if (chosen) return 'bg-purple-50 hover:bg-purple-100 focus-visible:bg-purple-100';
  if (unread) return 'bg-amber-50 hover:bg-amber-100 focus-visible:bg-amber-100';
  return 'hover:bg-gray-50 focus-visible:bg-gray-50';
}

// Red, on the desktop table and the phone cards (yellow unread cards, Chris 14 Nov 2026).
function UnreadDot({ className = 'bg-red-500' }: { className?: string }) {
  return <span role="img" className={`shrink-0 h-2 w-2 rounded-full ${className}`} aria-label="Unread" />;
}

// Phone card: white with a light border. Unread = the desktop rows' yellow (Chris 14 Nov 2026: "This needs yellow
// background, it doesn't stand out enough") with a darker yellow left edge; the open lead is gray.
export function phoneCardClass(selected: boolean, unread: boolean): string {
  const tone = selected
    ? 'bg-gray-100 border-gray-300'
    : unread
      ? 'bg-amber-50 border-amber-200 active:bg-amber-100'
      : 'bg-white border-gray-200 active:bg-gray-50';
  return `${tone} ${unread ? 'border-l-[3px] border-l-amber-400 pl-[calc(0.875rem-2px)]' : ''}`;
}

type ActionProps = Pick<Props, 'isClosedTab' | 'onSelect' | 'onArchive' | 'onDelete' | 'onMarkRead' | 'onLeadPatched' | 'onRemove' | 'onJoin'> & { lead: Lead };

// "(…)": a little more about the lead, plus the less-used actions.
function MoreMenu({ lead, onSelect, onDelete, onMarkRead }: ActionProps) {
  const rawPhone = lead.user?.phone_number?.trim() ?? '';
  const email = leadEmail(lead);
  const heading = lead.user?.name?.trim() || leadPhone(lead) || email || 'Lead';
  const item = 'cursor-pointer rounded-md px-2 py-1.5 text-sm flex items-center gap-2 text-gray-800 focus:!bg-gray-100 focus:!text-gray-900';

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Couldn't copy the ${what.toLowerCase()}`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <RowActionButton label="More" icon={MoreHorizontal} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-64 p-1.5 bg-white border border-gray-200 shadow-lg rounded-xl font-normal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 pt-1 pb-2 space-y-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{heading}</p>
          <p className="text-xs text-gray-600 truncate">{leadViaLabel(lead)}</p>
          <LeadBusinessTag lead={lead} />
          {lead.campaign_deleted && <CampaignDeletedTag />}
          <p className="text-xs text-gray-600">First seen {formatInboxDateShort(lead.first_seen_at)}</p>
          <p className="text-xs text-gray-600 truncate">
            {lead.claimed ? claimedTitle(lead) : lead.waiting ? <span title={openTitle(lead)}>Open</span> : lead.assignee ? `Assigned to ${lead.assignee.name ?? 'a teammate'}` : 'Unassigned'}
          </p>
          {lead.is_rollup && <p className="text-xs text-gray-500">Accept this lead to reply or close it</p>}
        </div>
        <DropdownMenuSeparator className="my-1 bg-gray-100" />
        <DropdownMenuItem onSelect={() => onSelect(lead)} className={item}>
          <ExternalLink className="w-3.5 h-3.5" />Open lead
        </DropdownMenuItem>
        {rawPhone && (
          <DropdownMenuItem onSelect={() => copy(rawPhone, 'Phone number')} className={item}>
            <Copy className="w-3.5 h-3.5" />Copy phone number
          </DropdownMenuItem>
        )}
        {email && (
          <DropdownMenuItem onSelect={() => copy(email, 'Email')} className={item}>
            <Copy className="w-3.5 h-3.5" />Copy email
          </DropdownMenuItem>
        )}
        {isUnread(lead) && (
          <DropdownMenuItem onSelect={() => onMarkRead(lead)} className={item}>
            <CheckCheck className="w-3.5 h-3.5" />Mark read
          </DropdownMenuItem>
        )}
        {lead.can_delete && (
          <>
            <DropdownMenuSeparator className="my-1 bg-gray-100" />
            <DropdownMenuItem onSelect={() => onDelete(lead)} className={`${item} !text-red-600 focus:!text-red-600`}>
              <Trash2 className="w-3.5 h-3.5" />Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RemoveButton({ lead, onRemove }: Pick<ActionProps, 'lead' | 'onRemove'>) {
  if (!lead.claimed || !lead.can_remove || !onRemove) return null;
  return <RowActionButton label="Remove" icon={EyeOff} tone="neutral" onClick={() => onRemove(lead)} data-testid="lead-remove" />;
}

// Always visible next to the "Claimed" chip (not a hover action), gray like the chip (Chris: active states gray).
function JoinPill({ lead, onJoin, className = '' }: Pick<ActionProps, 'lead' | 'onJoin'> & { className?: string }) {
  if (!lead.can_join || !onJoin) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onJoin(lead); }}
      title="Join to read and reply"
      data-testid="lead-join"
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 transition-colors ${className}`}
    >
      <UserPlus className="w-3.5 h-3.5" />
      Join
    </button>
  );
}

function RowActions(props: ActionProps & { className: string }) {
  const { lead, isClosedTab, onSelect, onArchive, onLeadPatched, onRemove, className } = props;
  const readOnly = !!lead.is_rollup;
  // Claimed by someone else and no longer theirs to open: only Remove (Join sits by the chip).
  if (lead.can_open === false) {
    return (
      <div className={`items-center gap-0.5 shrink-0 ${className}`} onClick={(e) => e.stopPropagation()}>
        <RemoveButton lead={lead} onRemove={onRemove} />
      </div>
    );
  }
  return (
    <div className={`items-center gap-0.5 shrink-0 ${className}`} onClick={(e) => e.stopPropagation()}>
      <RemoveButton lead={lead} onRemove={onRemove} />
      {!readOnly && (
        <RowActionButton
          label={isClosedTab ? 'Reopen lead' : 'Close lead'}
          icon={isClosedTab ? ArchiveRestore : Check}
          onClick={() => onArchive(lead)}
        />
      )}
      <AssigneeControl lead={lead} variant="icon" onChanged={(patch) => onLeadPatched(lead.id, patch)} />
      <RowActionButton
        label={lead.can_message === false ? 'View lead' : 'Reply'}
        icon={lead.can_message === false ? Eye : MessageSquare}
        onClick={() => onSelect(lead)}
      />
      <MoreMenu {...props} />
    </div>
  );
}

export default function LeadsInboxTable(props: Props) {
  const { leads, isLoading, error, emptyState, selectedLeadId, onSelect, onJoin, chosen, onChoose, onChoosePage } = props;
  const choosing = !!(chosen && onChoose && onChoosePage);
  const pageIds = choosing ? choosableLeadIds(leads) : [];
  const chosenOnPage = pageIds.filter((id) => chosen!.has(id)).length;
  const pageState: 'none' | 'some' | 'all' = !pageIds.length || chosenOnPage === 0 ? 'none' : chosenOnPage === pageIds.length ? 'all' : 'some';
  const headerBox = useRef<HTMLInputElement>(null);
  const phoneBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    [headerBox.current, phoneBox.current].forEach((box) => { if (box) box.indeterminate = pageState === 'some'; });
  }, [pageState, leads]);

  const leadLabel = (lead: Lead) => lead.user?.name?.trim() || leadPhone(lead) || leadEmail(lead) || 'this lead';
  // The row/card opens the lead on click, so the checkbox keeps its clicks to itself.
  const box = (lead: Lead) => {
    if (!choosing) return null;
    const canChoose = lead.can_open !== false;
    return (
      <label
        className={`-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center md:-my-2 md:-mx-1 md:h-9 md:w-8 ${canChoose ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          aria-label={`Choose ${leadLabel(lead)}`}
          checked={canChoose && chosen!.has(lead.id)}
          disabled={!canChoose}
          onChange={() => onChoose!(lead.id)}
          data-testid="lead-choose"
          className="h-4 w-4 accent-[#6C60FF]"
        />
      </label>
    );
  };

  const status = isLoading ? (
    <div className="flex items-center justify-center gap-2 py-12">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600" />
      <span className="text-sm text-gray-600">Loading leads...</span>
    </div>
  ) : error ? (
    <div className="py-12 text-center text-red-500 text-sm">{error}</div>
  ) : leads.length === 0 ? (
    <div className="py-14 text-center">{emptyState}</div>
  ) : null;

  const excerptOf = (lead: Lead, unread: boolean) => {
    const excerpt = inboxExcerpt(lead);
    return (
      <>
        {excerpt.prefix && <span className="text-gray-500 font-normal mr-1">{excerpt.prefix}</span>}
        <span className={unread ? 'text-gray-900' : 'text-gray-700'}>{excerpt.text}</span>
      </>
    );
  };

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto [container-type:inline-size]">
        <table className="w-full min-w-[48rem] table-fixed">
          <thead>
            <tr className="border-b border-gray-200">
              {choosing && (
                <th className={`${HEAD} w-10 !pr-0`}>
                  <input ref={headerBox} type="checkbox" aria-label="Choose every lead on this page" checked={pageState === 'all'}
                    disabled={!pageIds.length} onChange={() => onChoosePage!(pageIds)} data-testid="lead-choose-page" className="h-4 w-4 accent-[#6C60FF] cursor-pointer" />
                </th>
              )}
              <th className={`${HEAD} w-[11rem] [@container(min-width:70rem)]:w-[13rem]`}>Date/Time</th>
              <th className={`${HEAD} w-[11rem] [@container(min-width:62rem)]:w-[9rem]`}>
                <span className="[@container(min-width:62rem)]:hidden">Phone / Email</span>
                <span className="hidden [@container(min-width:62rem)]:inline">Phone Number</span>
              </th>
              <th className={`${HEAD} hidden [@container(min-width:62rem)]:table-cell w-[12rem] [@container(min-width:70rem)]:w-[13rem]`}>Email</th>
              <th className={`${HEAD} w-[8.5rem] [@container(min-width:70rem)]:w-[10rem]`}>Name</th>
              <th className={HEAD}>Message Excerpt</th>
              <th className={`${HEAD} w-[11rem]`}>Assignee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {status ? (
              <tr><td colSpan={choosing ? 7 : 6}>{status}</td></tr>
            ) : leads.map((lead) => {
              const unread = isUnread(lead);
              const selected = selectedLeadId === lead.id;
              const isChosen = choosing && chosen!.has(lead.id);
              const when = lead.last_activity_at || lead.last_engaged_at;
              const phone = leadPhone(lead);
              const email = leadEmail(lead);
              return (
                <tr
                  key={lead.id}
                  tabIndex={0}
                  onClick={() => openOrSayClaimed(lead, onSelect, onJoin)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      openOrSayClaimed(lead, onSelect, onJoin);
                    }
                  }}
                  className={`group cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400 ${rowBackground(selected, unread, isChosen)} ${unread ? 'font-semibold' : ''}`}
                  style={selected ? { boxShadow: 'inset 3px 0 0 #202224' } : undefined}
                >
                  {choosing && <td className={`${CELL} !pr-0`}>{box(lead)}</td>}
                  <td className={`${CELL} text-gray-800 whitespace-nowrap overflow-hidden`}>
                    <span className="[@container(min-width:70rem)]:hidden">{formatInboxDateMedium(when)}</span>
                    <span className="hidden [@container(min-width:70rem)]:inline">{formatInboxDate(when)}</span>
                  </td>
                  <td className={`${CELL} text-gray-800 truncate`} title={[phone, email].filter(Boolean).join(' · ') || undefined}>
                    <span className="[@container(min-width:62rem)]:hidden">{phone || email || '—'}</span>
                    <span className="hidden [@container(min-width:62rem)]:inline">{phone || '—'}</span>
                  </td>
                  <td className={`${CELL} hidden [@container(min-width:62rem)]:table-cell text-gray-800 truncate`} title={email || undefined}>
                    {email || '—'}
                  </td>
                  <td className={`${CELL} text-gray-900`} title={leadViaTitle(lead)}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{leadName(lead)}</span>
                      <StatusIndicator status={lead.status} />
                      <WantsMoreTag lead={lead} />
                      {unread && <UnreadDot />}
                    </span>
                  </td>
                  <td className={`${CELL} truncate`}>
                    {/* No business tag here (Chris 11 Nov 2026 (d): just the excerpt) — it stays in More, the header and details. */}
                    {lead.campaign_deleted && <CampaignDeletedTag className="mr-1.5 align-middle" />}
                    {excerptOf(lead, unread)}
                  </td>
                  <td className={`${CELL} font-normal`}>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="min-w-0 flex items-center gap-1.5">
                        {lead.claimed
                          ? <><ClaimedBadge lead={lead} className="group-hover:hidden group-focus-within:hidden group-has-[[data-state=open]]:hidden" /><JoinPill lead={lead} onJoin={onJoin} className="h-6 px-2 text-[12px]" /></>
                          : lead.waiting
                          // Steps aside for the row's actions on hover, like the assignee's name.
                          ? <OpenBadge lead={lead} className="group-hover:hidden group-focus-within:hidden group-has-[[data-state=open]]:hidden" />
                          : lead.assignee
                          ? <AssigneeBadge assignee={lead.assignee} size="sm" nameClassName={HIDE_WHEN_ROW_ACTIVE} />
                          : <span className="text-gray-400">—</span>}
                      </span>
                      <RowActions {...props} lead={lead} className={SHOW_WHEN_ROW_ACTIVE} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per lead (Chris: "no distinction between the leads") */}
      <div className="md:hidden space-y-2">
        {choosing && !status && pageIds.length > 0 && (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3.5 text-sm text-gray-700">
            <span className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center">
              <input ref={phoneBox} type="checkbox" checked={pageState === 'all'} onChange={() => onChoosePage!(pageIds)} className="h-4 w-4 accent-[#6C60FF]" />
            </span>
            Choose every lead on this page
          </label>
        )}
        {status ? <div className="bg-white rounded-xl border border-gray-200">{status}</div> : leads.map((lead) => {
          const unread = isUnread(lead);
          const selected = selectedLeadId === lead.id;
          const contact = [leadPhone(lead), leadEmail(lead)].filter(Boolean).join(' · ') || '—';
          const name = lead.user?.name?.trim();
          const isChosen = choosing && chosen!.has(lead.id);
          return (
            <div
              key={lead.id}
              onClick={() => openOrSayClaimed(lead, onSelect, onJoin)}
              className={`rounded-xl border px-3.5 pt-3 pb-1.5 cursor-pointer transition-colors min-w-0 ${phoneCardClass(selected, unread)} ${isChosen && !selected ? '!bg-purple-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className={`flex items-center gap-1.5 min-w-0 text-[15px] text-gray-900 ${unread ? 'font-bold' : 'font-medium'}`}>
                  {box(lead)}
                  {unread && <UnreadDot />}
                  <span className="truncate">{name || contact}</span>
                  <StatusIndicator status={lead.status} />
                </div>
                <span className={`shrink-0 text-xs whitespace-nowrap ${unread ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                  {formatInboxDateShort(lead.last_activity_at || lead.last_engaged_at)}
                </span>
              </div>
              <p className={`mt-1 text-sm truncate ${unread ? 'font-medium' : ''}`}>{excerptOf(lead, unread)}</p>
              <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                <span className="min-w-0 flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] text-gray-500">{name ? contact : leadViaLabel(lead)}</span>
                  <WantsMoreTag lead={lead} />
                  {lead.campaign_deleted && <CampaignDeletedTag />}
                </span>
                <div className="flex items-center gap-1 shrink-0 -mr-2.5">
                  {lead.claimed
                    ? <><ClaimedBadge lead={lead} /><JoinPill lead={lead} onJoin={onJoin} className="h-8 px-3 text-[13px] mr-1" /></>
                    : lead.waiting
                    ? <OpenBadge lead={lead} />
                    : lead.assignee && <AssigneeBadge assignee={lead.assignee} size="sm" nameClassName="hidden" />}
                  {/* 40px tap targets on phones; the icons stay the same size. */}
                  <RowActions {...props} lead={lead} className="flex !gap-0 [&_button]:h-10 [&_button]:w-10" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
