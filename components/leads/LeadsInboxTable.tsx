import { toast } from 'sonner';
import {
  ArchiveRestore, Check, CheckCheck, Copy, ExternalLink, Eye, MessageSquare, MoreHorizontal, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { leadViaLabel } from '../../services/leadsAPI';
import type { Lead } from '../../services/leadsAPI';
import { STATUS_STYLES, type LeadStatus } from '../LeadDetailsSidebar';
import AssigneeControl, { AssigneeBadge } from './AssigneeControl';
import RowActionButton from './RowActionButton';
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

function UnreadDot() {
  return <span className="shrink-0 h-2 w-2 rounded-full bg-red-500" aria-label="Unread" />;
}

type ActionProps = Pick<Props, 'isClosedTab' | 'onSelect' | 'onArchive' | 'onDelete' | 'onMarkRead' | 'onLeadPatched'> & { lead: Lead };

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
          <p className="text-xs text-gray-600">First seen {formatInboxDateShort(lead.first_seen_at)}</p>
          <p className="text-xs text-gray-600 truncate">
            {lead.assignee ? `Assigned to ${lead.assignee.name ?? 'a teammate'}` : 'Unassigned'}
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

function RowActions(props: ActionProps & { className: string }) {
  const { lead, isClosedTab, onSelect, onArchive, onLeadPatched, className } = props;
  const readOnly = !!lead.is_rollup;
  return (
    <div className={`items-center gap-0.5 shrink-0 ${className}`} onClick={(e) => e.stopPropagation()}>
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
  const { leads, isLoading, error, emptyState, selectedLeadId, onSelect } = props;

  const status = isLoading ? (
    <div className="flex items-center justify-center gap-2 py-12">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6C60FF]" />
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
              <tr><td colSpan={6}>{status}</td></tr>
            ) : leads.map((lead) => {
              const unread = isUnread(lead);
              const selected = selectedLeadId === lead.id;
              const when = lead.last_activity_at || lead.last_engaged_at;
              const phone = leadPhone(lead);
              const email = leadEmail(lead);
              return (
                <tr
                  key={lead.id}
                  tabIndex={0}
                  onClick={() => onSelect(lead)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelect(lead);
                    }
                  }}
                  className={`group cursor-pointer transition-colors focus:outline-none focus-visible:bg-gray-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6C60FF] ${selected ? 'bg-purple-50' : 'hover:bg-gray-50'} ${unread ? 'font-semibold' : ''}`}
                  style={selected ? { boxShadow: 'inset 3px 0 0 #6C60FF' } : undefined}
                >
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
                  <td className={`${CELL} text-gray-900`} title={leadViaLabel(lead)}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{leadName(lead)}</span>
                      <StatusIndicator status={lead.status} />
                      {unread && <UnreadDot />}
                    </span>
                  </td>
                  <td className={`${CELL} truncate`}>{excerptOf(lead, unread)}</td>
                  <td className={`${CELL} font-normal`}>
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <span className="min-w-0 flex items-center">
                        {lead.assignee
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

      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {status ?? leads.map((lead) => {
          const unread = isUnread(lead);
          const contact = [leadPhone(lead), leadEmail(lead)].filter(Boolean).join(' · ') || '—';
          const name = lead.user?.name?.trim();
          return (
            <div key={lead.id} onClick={() => onSelect(lead)} className="px-4 py-2.5 cursor-pointer active:bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <div className={`flex items-center gap-1.5 min-w-0 text-[15px] text-gray-900 ${unread ? 'font-semibold' : 'font-medium'}`}>
                  <span className="truncate">{name || contact}</span>
                  <StatusIndicator status={lead.status} />
                  {unread && <UnreadDot />}
                </div>
                <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
                  {formatInboxDateShort(lead.last_activity_at || lead.last_engaged_at)}
                </span>
              </div>
              <p className={`mt-0.5 text-sm truncate ${unread ? 'font-semibold' : ''}`}>{excerptOf(lead, unread)}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] text-gray-600">{name ? contact : leadViaLabel(lead)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {lead.assignee && <AssigneeBadge assignee={lead.assignee} size="sm" nameClassName="hidden" />}
                  <RowActions {...props} lead={lead} className="flex" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
