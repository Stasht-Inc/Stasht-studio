import { Archive, ArchiveRestore, CheckCheck, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { Lead } from '../../services/leadsAPI';
import { STATUS_STYLES, type LeadStatus } from '../LeadDetailsSidebar';
import AssigneeControl from './AssigneeControl';
import { formatInboxDate, formatInboxDateShort, inboxExcerpt, isUnread, leadContactLine } from '../../utils/leadInbox';

// Inbox-style Leads list (spec 2026-09-23 §5, Chris's reference): one line per
// lead — when, who, the latest message, and who owns it.

interface Props {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
  emptyState: React.ReactNode;
  selectedLeadId?: number | null;
  compact?: boolean;
  isClosedTab: boolean;
  onSelect: (lead: Lead) => void;
  onArchive: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onMarkRead: (lead: Lead) => void;
  onLeadPatched: (leadId: number, patch: Partial<Lead>) => void;
}

// The phone/email already has its own column, so an unnamed contact shows "—"
// here (as in Chris's reference) rather than repeating the number.
function leadName(lead: Lead): string {
  return lead.user?.name?.trim() || '—';
}

function StatusPill({ status }: { status: Lead['status'] }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[12px] font-semibold capitalize ${STATUS_STYLES[status as LeadStatus]}`}>
      {status}
    </span>
  );
}

function RowMenu({ lead, isClosedTab, onArchive, onDelete, onMarkRead }: Pick<Props, 'isClosedTab' | 'onArchive' | 'onDelete' | 'onMarkRead'> & { lead: Lead }) {
  const canAct = !lead.is_rollup;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="More actions"
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 bg-white border border-gray-200 shadow-lg" onClick={(e) => e.stopPropagation()}>
        {isUnread(lead) && (
          <DropdownMenuItem onClick={() => onMarkRead(lead)} className="cursor-pointer text-sm flex items-center gap-2">
            <CheckCheck className="w-3.5 h-3.5" />Mark read
          </DropdownMenuItem>
        )}
        {canAct && (
          <DropdownMenuItem onClick={() => onArchive(lead)} className="cursor-pointer text-sm flex items-center gap-2">
            {isClosedTab ? <><ArchiveRestore className="w-3.5 h-3.5" />Reopen</> : <><Archive className="w-3.5 h-3.5" />Close</>}
          </DropdownMenuItem>
        )}
        {lead.can_delete && (
          <DropdownMenuItem onClick={() => onDelete(lead)} className="cursor-pointer text-sm text-red-600 focus:text-red-600 flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5" />Delete
          </DropdownMenuItem>
        )}
        {!canAct && !isUnread(lead) && !lead.can_delete && (
          <div className="px-2 py-1.5 text-xs text-gray-500">Accept this lead to act on it</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function LeadsInboxTable(props: Props) {
  const { leads, isLoading, error, emptyState, selectedLeadId, compact, onSelect, onLeadPatched } = props;
  const cell = compact ? 'px-3 py-2' : 'px-4 py-3';

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

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[13.5rem]" />
            <col className="w-[10rem]" />
            <col className="w-[12rem]" />
            <col />
            <col className="w-[14rem]" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm font-bold text-gray-700">
              <th className={cell}>Date/Time</th>
              <th className={cell}>Phone</th>
              <th className={cell}>Name</th>
              <th className={cell}>Message Excerpt</th>
              <th className={cell}>Assignee</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {status ? (
              <tr><td colSpan={6}>{status}</td></tr>
            ) : leads.map((lead) => {
              const unread = isUnread(lead);
              const excerpt = inboxExcerpt(lead);
              const selected = selectedLeadId === lead.id;
              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelect(lead)}
                  className={`group cursor-pointer transition-colors ${selected ? 'bg-purple-50' : 'hover:bg-gray-50'} ${unread ? 'font-semibold' : ''}`}
                  style={selected ? { boxShadow: 'inset 3px 0 0 #6C60FF' } : undefined}
                >
                  <td className={`${cell} text-sm text-gray-800 whitespace-nowrap`}>
                    {formatInboxDate(lead.last_activity_at || lead.last_engaged_at)}
                  </td>
                  <td className={`${cell} text-sm text-gray-800 truncate`}>{leadContactLine(lead)}</td>
                  <td className={`${cell} text-sm text-gray-900`} title={lead.story ? `Via: ${lead.story.title}` : 'Direct message'}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{leadName(lead)}</span>
                      <StatusPill status={lead.status} />
                      {unread && <span className="shrink-0 h-2 w-2 rounded-full bg-red-500" aria-label="Unread" />}
                    </span>
                  </td>
                  <td className={`${cell} text-sm`}>
                    <span className="block truncate">
                      {excerpt.prefix && <span className="text-gray-500 font-normal mr-1">{excerpt.prefix}</span>}
                      <span className={unread ? 'text-gray-900' : 'text-gray-700'}>{excerpt.text}</span>
                    </span>
                  </td>
                  <td className={`${cell} text-sm`}>
                    <AssigneeControl lead={lead} onChanged={(patch) => onLeadPatched(lead.id, patch)} />
                  </td>
                  <td className={`${cell} text-right`}>
                    <RowMenu {...props} lead={lead} />
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
          const excerpt = inboxExcerpt(lead);
          return (
            <div key={lead.id} onClick={() => onSelect(lead)} className="px-4 py-3 space-y-1.5 cursor-pointer">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={`flex items-center gap-1.5 text-base text-gray-900 ${unread ? 'font-semibold' : 'font-medium'}`}>
                    <span className="truncate">{leadName(lead)}</span>
                    <StatusPill status={lead.status} />
                    {unread && <span className="shrink-0 h-2 w-2 rounded-full bg-red-500" aria-label="Unread" />}
                  </div>
                  <div className="text-sm text-gray-600 whitespace-nowrap">{leadContactLine(lead)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatInboxDateShort(lead.last_activity_at || lead.last_engaged_at)}</span>
                  <RowMenu {...props} lead={lead} />
                </div>
              </div>
              <p className="text-sm truncate">
                {excerpt.prefix && <span className="text-gray-500 mr-1">{excerpt.prefix}</span>}
                <span className={unread ? 'text-gray-900 font-semibold' : 'text-gray-700'}>{excerpt.text}</span>
              </p>
              <div><AssigneeControl lead={lead} onChanged={(patch) => onLeadPatched(lead.id, patch)} /></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
