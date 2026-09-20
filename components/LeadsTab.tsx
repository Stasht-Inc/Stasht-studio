import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MoreHorizontal, MessageSquare, Clock, RefreshCw, Trash2, Archive, Check, Send, Users, ChevronLeft, Sparkles, Heart, Gift, Calendar, MessageCircle, ThumbsUp, TrendingUp, Lightbulb, UserRound, MapPin, CheckCircle2 } from 'lucide-react';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from './ui/dropdown-menu';
import { leadsAPI, Lead, LeadMessage, CommentaryTarget, LeadGroupSummary, LeadGroup, Conversation } from '../services/leadsAPI';
import { mapLimit } from '../utils/requestLimit';

const STATUS_TRIGGER_CLASS: Record<string, string> = {
  hot: 'bg-red-100 text-red-600 border-red-200 hover:bg-red-100 focus:ring-0',
  warm: 'bg-orange-100 text-orange-500 border-orange-200 hover:bg-orange-100 focus:ring-0',
  cold: 'bg-blue-100 text-blue-500 border-blue-200 hover:bg-blue-100 focus:ring-0',
  visited: 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-100 focus:ring-0',
  sold: 'bg-green-100 text-green-600 border-green-200 hover:bg-green-100 focus:ring-0',
};

function getTimeAgo(dateString: string): string {
  if (!dateString) return 'Never';
  const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDate(dateString: string): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// Guest leads (photo submitted from a published page, no account) carry a
// `user` block with name/email/phone but a null `id`. Malformed rows can
// have no `user` at all — fall back to an em-dash placeholder for those.
function leadDisplayName(lead: Lead): string {
  return lead.user?.name || '—';
}
function leadDisplayEmail(lead: Lead): string {
  return lead.user?.email || '—';
}

// Small badge marking a lead with no account (guest submission) — matches
// GroupDetailDrawer's "No contact info" badge styling.
function GuestBadge() {
  return (
    <span className="flex items-center gap-1 px-2 h-6 rounded-md bg-blue-50 text-blue-500 border border-blue-200 text-[11px] font-medium shrink-0">
      <UserRound className="w-3 h-3" /> Guest
    </span>
  );
}

// AI Suggest actions for the Message Group composer (same 7 as the lead drawer).
const AI_GROUP_ACTIONS: { key: string; icon: typeof Heart; title: string; desc: string }[] = [
  { key: 'feedback', icon: MessageSquare, title: 'Request Feedback', desc: 'Ask for their thoughts and opinions' },
  { key: 'thanks', icon: Heart, title: 'Thank You Message', desc: 'Show appreciation for their engagement' },
  { key: 'related', icon: Gift, title: 'Share Related Content', desc: 'Recommend another campaign they might enjoy' },
  { key: 'call', icon: Calendar, title: 'Schedule a Call', desc: 'Invite them to discuss the campaign over a call' },
  { key: 'followup', icon: MessageCircle, title: 'Generate Follow-up', desc: 'Create a thoughtful response to their recent activity' },
  { key: 'support', icon: ThumbsUp, title: 'Offer Support', desc: "Let them know you're available to help" },
  { key: 'reengage', icon: TrendingUp, title: 'Re-engagement Message', desc: 'Bring them back with news about updates' },
];

// Highlights every (case-insensitive) occurrence of `query` inside `text`.
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i <= text.length) {
    const idx = lower.indexOf(lowerQ, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="bg-yellow-200 text-gray-900 rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    i = idx + q.length;
  }
  return parts;
}

// A single searchable item across all leads' messages + comments.
interface CommentaryEntry {
  lead: Lead;
  kind: 'message' | 'comment';
  targetId: number; // id of the source message, or the parent comment for replies
  title: string; // message subject (blank for comments / no-subject messages)
  body: string;  // message body or comment text
  meta: string;  // e.g. "Email · Outbound", "SMS · Inbound", "Comment"
  date: string;
}

// Sortable desktop-table column header: a button that cycles asc → desc →
// default, with an inline chevron on the active column and aria-sort on the
// <th> for assistive tech (sub-plan #4 builds further accessibility on this).
function SortableTh({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string;
  field: 'name' | 'last_engaged' | 'status';
  activeField: 'name' | 'last_engaged' | 'status' | null;
  direction: 'asc' | 'desc';
  onSort: (field: 'name' | 'last_engaged' | 'status') => void;
}) {
  const isActive = activeField === field;
  return (
    <th
      className="px-6 py-3 text-left text-sm font-bold text-gray-700"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 hover:text-[#6C60FF] transition-colors"
      >
        {label}
        <span className={`text-[10px] ${isActive ? 'text-[#6C60FF]' : 'text-gray-300'}`}>
          {isActive ? (direction === 'asc' ? '▲' : '▼') : '▲'}
        </span>
      </button>
    </th>
  );
}

function StatusSelect({ lead, onUpdate, disabled }: { lead: Lead; onUpdate: (id: number, status: 'hot' | 'warm' | 'cold' | 'visited' | 'sold' | null) => void; disabled: boolean }) {
  return (
    <Select
      value={lead.status ?? 'none'}
      disabled={disabled}
      onValueChange={(val) => onUpdate(lead.id, val === 'none' ? null : val as 'hot' | 'warm' | 'cold' | 'visited' | 'sold')}
    >
      <SelectTrigger
        className={`h-6 text-xs font-medium rounded-md px-2 w-auto min-w-[68px] border shadow-none outline-none focus:ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-1 ${
          lead.status
            ? STATUS_TRIGGER_CLASS[lead.status]
            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 focus:ring-0'
        }`}
      >
        {lead.status === 'hot' && <span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
        {lead.status === 'warm' && <span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
        {lead.status === 'cold' && <span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
        {lead.status === 'visited' && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span>}
        {lead.status === 'sold' && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span>}
        {!lead.status && <SelectValue placeholder="Set status" />}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Set status</SelectItem>
        <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
        <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
        <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
        <SelectSeparator />
        <SelectItem value="visited"><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span></SelectItem>
        <SelectItem value="sold"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span></SelectItem>
      </SelectContent>
    </Select>
  );
}

interface LeadsTabProps {
  selectedLead: Lead | null;
  onLeadSelect: (lead: Lead | null) => void;
  refreshTrigger: number;
  compact?: boolean;
  onLeadsRefreshed?: (leads: Lead[]) => void;
  onFilterChange?: (filter: string) => void;
  onCommentaryJump?: (lead: Lead, target: CommentaryTarget) => void;
  selectedGroupId?: number | null;
  onGroupSelect?: (id: number | null) => void;
  selectedConversationId?: number | null;
  onConversationSelect?: (conversation: Conversation | null) => void;
  // Leads-wide unread breakdown from GET /leads/unread-count, already fetched
  // once by UsersPage for the sidebar/tab badge — threaded down as a prop
  // (rather than refetched here) so the Groups sub-tab's unread cards don't
  // duplicate that call.
  unreadBreakdown?: { total_unread_messages: number; total_unread_comments: number; total_unread: number } | null;
  // Opens the Storeel Report screen — property resolution happens on that
  // screen itself (auto-selects when there's only one), so this tab doesn't
  // need to know about properties at all.
  onViewStoreelReport?: () => void;
}

// One summary-card row above the sub-tab content, scoped to whichever
// sub-tab (Leads / Groups / My Conversations) is currently active.
interface SummaryCardData {
  label: string;
  value: number | string;
  valueClassName?: string;
}

function SummaryCardRow({ cards }: { cards: SummaryCardData[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-600">{card.label}</p>
          <p className={`text-2xl font-semibold text-gray-900 mt-1 ${card.valueClassName ?? ''}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function LeadsTab({ selectedLead, onLeadSelect, refreshTrigger, compact = false, onLeadsRefreshed, onFilterChange, onCommentaryJump, selectedGroupId, onGroupSelect, selectedConversationId, onConversationSelect, unreadBreakdown, onViewStoreelReport }: LeadsTabProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'annually'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sorting + pagination — backend params already exist (Task M1); this state
  // drives them. `sortField` null = default backend ordering (last_engaged desc).
  const [sortField, setSortField] = useState<'name' | 'last_engaged' | 'status' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  // "Latest fetch args" ref for effects that register once (`[]` deps, e.g.
  // the visibilitychange listener below) and would otherwise permanently
  // close over the search/status/sort/page values from the render they
  // mounted on. Updated after every render so any []-effect can read the
  // *current* filter/sort/page state instead of stale mount-time defaults.
  const fetchArgsRef = useRef({ search: '', status: 'all', sort: null as 'name' | 'last_engaged' | 'status' | null, direction: 'asc' as 'asc' | 'desc', page: 1 });
  const perPage = 50;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // Summary-card data for the Leads sub-tab (Task M4) — backend-computed
  // across the full filtered/scoped result set, not just the current page.
  const [statusCounts, setStatusCounts] = useState<Partial<Record<'hot' | 'warm' | 'cold' | 'visited' | 'sold', number>>>({});
  const [messagesTotal, setMessagesTotal] = useState(0);

  // Search Group (commentary search across the currently loaded leads page)
  const [showSearchGroup, setShowSearchGroup] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [commentaryEntries, setCommentaryEntries] = useState<CommentaryEntry[]>([]);
  const [isBuildingIndex, setIsBuildingIndex] = useState(false);
  const groupInputRef = useRef<HTMLInputElement>(null);

  // Approach B: build the search index client-side — comments come from the
  // already-loaded leads, messages are fetched per-lead on demand.
  const buildCommentaryIndex = async () => {
    if (isBuildingIndex) return;
    setIsBuildingIndex(true);
    try {
      const entries: CommentaryEntry[] = [];

      // Comments / activity are already attached to each lead. Replies are
      // rendered nested under their parent in the drawer, so target the parent.
      leads.forEach((lead) => {
        (lead.comments ?? []).forEach((c) => {
          if (c.description) {
            entries.push({
              lead,
              kind: 'comment',
              targetId: c.parent_id ?? c.id,
              title: '',
              body: c.description,
              meta: 'Comment',
              date: c.created_at,
            });
          }
        });
      });

      // Messages — one request per lead. `leads` is now the current page only
      // (<= per_page, default 50) rather than the full unpaginated list — the
      // index only covers what's loaded on this page. Still concurrency-capped:
      // an unbounded Promise.all here would fire up to `per_page` requests in
      // the same tick and trip the backend rate limiter.
      const fetched = await mapLimit(leads, async (lead) => {
        try {
          const res = await leadsAPI.getMessages(lead.id);
          if (res.success && res.data?.messages) return { lead, messages: res.data.messages };
        } catch {
          // ignore — a failed lead simply contributes no messages
        }
        return { lead, messages: [] as LeadMessage[] };
      });

      fetched.forEach(({ lead, messages }) => {
        messages.forEach((m) => {
          const channel = m.channel === 'email' ? 'Email' : 'SMS';
          const dir = m.direction === 'outbound' ? 'Outbound' : 'Inbound';
          entries.push({
            lead,
            kind: 'message',
            targetId: m.id,
            title: m.subject && m.subject !== 'Following up' ? m.subject : '',
            body: m.body ?? '',
            meta: `${channel} · ${dir}`,
            date: m.sent_at,
          });
        });
      });

      setCommentaryEntries(entries);
    } finally {
      setIsBuildingIndex(false);
    }
  };

  const openSearchGroup = () => {
    setShowSearchGroup(true);
    setGroupQuery('');           // start fresh — no prefilled previous query
    buildCommentaryIndex();      // rebuild so results reflect the latest data
    setTimeout(() => groupInputRef.current?.focus(), 50);
  };

  const groupQ = groupQuery.toLowerCase().trim();
  const groupResults = groupQ
    ? commentaryEntries.filter((e) => e.body.toLowerCase().includes(groupQ) || e.title.toLowerCase().includes(groupQ))
    : [];
  const groupLeadCount = new Set(groupResults.map((r) => r.lead.id)).size;

  // Message Group (bulk message to multiple leads)
  const [showMessageGroup, setShowMessageGroup] = useState(false);
  const [mgSearch, setMgSearch] = useState('');
  const [mgSelected, setMgSelected] = useState<Set<number>>(new Set());
  const [mgMessage, setMgMessage] = useState('');
  const [mgSending, setMgSending] = useState(false);
  const [mgStatusFilter, setMgStatusFilter] = useState('all');
  const [mgGroupName, setMgGroupName] = useState('');
  const [showMgAiActions, setShowMgAiActions] = useState(false);
  const [mgGeneratingAction, setMgGeneratingAction] = useState<string | null>(null);
  const [mgLastAiAction, setMgLastAiAction] = useState<string | null>(null);
  // Idempotency key for the group broadcast compose — regenerated only after a
  // confirmed send, reused on failure/retry so a duplicate request dedupes
  // server-side (Task B3).
  const mgIdemKeyRef = useRef<string>(crypto.randomUUID());
  // Picker needs every matching lead, not just the current page (final-review
  // Finding 1, sub-plan #3): `leads` only holds the current page since
  // pagination landed, which silently dropped recipients >50 leads deep from
  // the bulk-broadcast picker/search/Select All. Fetched fresh each time the
  // popover opens, unpaginated (the backend returns the full filtered set
  // when `page` is omitted) using the same search/status filters as the
  // main table — independent of the paginated `leads` state.
  const [mgAllLeads, setMgAllLeads] = useState<Lead[]>([]);
  const [mgLoading, setMgLoading] = useState(false);
  const [mgLoadError, setMgLoadError] = useState<string | null>(null);
  // Sequence guard so a stale in-flight fetch (popover reopened before the
  // previous fetch resolved) can't clobber a newer response.
  const mgFetchSeqRef = useRef(0);
  const { limitData } = useMemoryLimit();
  const [mgAiCredits, setMgAiCredits] = useState<number>(limitData.ai_connects ?? 0);
  useEffect(() => { setMgAiCredits(limitData.ai_connects ?? 0); }, [limitData.ai_connects]);

  // Both popovers are conditionally rendered ({showXGroup && (...)}) rather
  // than always-mounted-but-hidden, so panelRef is null until the panel
  // actually mounts. That's fine here: React commits the DOM (mounting the
  // panel) before running effects, so by the time this hook's effect body
  // runs on the open:false->true transition, panelRef.current is already
  // set. Two separate hook instances since both popovers live in this one
  // component — each needs its own ref/focus-trap state.
  const { panelRef: searchGroupPanelRef, dialogProps: searchGroupDialogProps } = useDialogBehavior({
    open: showSearchGroup,
    onClose: () => setShowSearchGroup(false),
    labelledBy: 'search-group-title',
  });
  const { panelRef: messageGroupPanelRef, dialogProps: messageGroupDialogProps } = useDialogBehavior({
    open: showMessageGroup,
    onClose: () => setShowMessageGroup(false),
    labelledBy: 'message-group-title',
  });

  const handleMgAiAction = async (action: string, noCredit = false) => {
    if (mgGeneratingAction) return;
    setMgGeneratingAction(action);
    try {
      const res = await leadsAPI.aiSuggestGroup(action, noCredit);
      if (res.success && res.data?.message) {
        setMgMessage(res.data.message);
        setMgLastAiAction(action); // enables the Retry button
        if (typeof res.data.credits_remaining === 'number') setMgAiCredits(res.data.credits_remaining);
        if (!noCredit) recheckMemoryLimit();
        setShowMgAiActions(false);
      } else {
        const msg = ((res as any).message || res.error || '').toString();
        if (/out of credits/i.test(msg)) { setMgAiCredits(0); toast.error('Out of credits'); }
        else toast.error(msg || 'Failed to generate suggestion.');
      }
    } catch {
      toast.error('Failed to generate suggestion.');
    } finally {
      setMgGeneratingAction(null);
    }
  };

  // One row per person — the same user can appear under multiple stories.
  // Guest leads have no account (user.id is null), so dedupe those by lead id
  // instead — otherwise every guest would collapse into a single null key.
  // Sourced from mgAllLeads (the unpaginated fetch above), not the paginated
  // `leads` state, so the picker covers every matching lead.
  const uniqueLeads = (() => {
    const seen = new Set<number | string>();
    return mgAllLeads.filter((l) => {
      const key = l.user?.id ?? `guest-${l.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  const mgQ = mgSearch.toLowerCase().trim();
  const mgFiltered = uniqueLeads.filter(
    (l) =>
      (!mgQ || leadDisplayName(l).toLowerCase().includes(mgQ) || leadDisplayEmail(l).toLowerCase().includes(mgQ)) &&
      (mgStatusFilter === 'all' || l.status === mgStatusFilter)
  );
  const allFilteredSelected = mgFiltered.length > 0 && mgFiltered.every((l) => mgSelected.has(l.id));

  // Fetches the full (unpaginated) matching-lead set for the Message Group
  // picker. Guarded against stale responses via mgFetchSeqRef.
  const loadMgAllLeads = async () => {
    const seq = ++mgFetchSeqRef.current;
    setMgLoading(true);
    setMgLoadError(null);
    try {
      const res = await leadsAPI.getLeads({ search: searchQuery, status: statusFilter });
      if (seq !== mgFetchSeqRef.current) return; // superseded by a newer fetch
      if (res.success && res.data) {
        setMgAllLeads((res.data.leads ?? []).filter((l) => l != null));
      } else {
        setMgAllLeads([]);
        const msg = res.error || 'Failed to load leads.';
        setMgLoadError(msg);
        toast.error(msg);
      }
    } catch {
      if (seq !== mgFetchSeqRef.current) return;
      setMgAllLeads([]);
      setMgLoadError('Failed to load leads.');
      toast.error('Failed to load leads for the picker.');
    } finally {
      if (seq === mgFetchSeqRef.current) setMgLoading(false);
    }
  };

  const openMessageGroup = () => {
    setShowMessageGroup(true);
    setMgSearch('');
    setMgSelected(new Set());
    setMgMessage('');
    setMgStatusFilter('all');
    setMgGroupName('');
    setShowMgAiActions(false);
    setMgLastAiAction(null);
    // Fresh compose session — new idempotency key.
    mgIdemKeyRef.current = crypto.randomUUID();
    loadMgAllLeads();
  };

  const toggleMgSelect = (id: number) => {
    setMgSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setMgSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) mgFiltered.forEach((l) => next.delete(l.id));
      else mgFiltered.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const handleSendGroup = async () => {
    if (mgSending) return; // handler-level guard against double-send races
    const targets = uniqueLeads.filter((l) => mgSelected.has(l.id));
    const body = mgMessage.trim();
    const name = mgGroupName.trim();
    if (targets.length === 0 || !body || !name) return;
    setMgSending(true);
    try {
      // 1. Create the persistent lead group (POST /api/react/lead-groups).
      const groupRes = await leadsAPI.createLeadGroup(name, targets.map((l) => l.id));
      if (!groupRes.success || !groupRes.data) {
        toast.error(groupRes.error || 'Failed to create group.');
        return;
      }
      const created = groupRes.data as LeadGroup | { group: LeadGroup };
      const newGroup = 'id' in created ? created : created.group;

      // 2. Broadcast the message to the group (server fans out to email/SMS).
      const key = mgIdemKeyRef.current;
      const bRes = await leadsAPI.broadcastToGroup(newGroup.id, body, undefined, key);
      if (bRes.success) {
        mgIdemKeyRef.current = crypto.randomUUID(); // confirmed success → fresh key for the next compose
        const sent = bRes.data?.summary?.sent ?? 0;
        const skipped = bRes.data?.summary?.skipped ?? 0;
        toast.success(`Group "${name}" created · sent to ${sent} member${sent === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped (no contact)` : ''}.`);
      } else {
        toast.error('Group created, but the broadcast failed.');
        // failure → key intentionally kept for retry
      }
      setShowMessageGroup(false);
      // Re-fetch leads + groups so the list reflects the newly created group.
      fetchLeads();
      fetchLeadGroups();
    } finally {
      setMgSending(false);
    }
  };

  const fetchLeads = async (
    search?: string,
    status?: string,
    sort?: 'name' | 'last_engaged' | 'status' | null,
    direction?: 'asc' | 'desc',
    pageNum?: number,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const effectiveSort = sort !== undefined ? sort : sortField;
      const effectiveDirection = direction ?? sortDirection;
      const effectivePage = pageNum ?? page;
      const res = await leadsAPI.getLeads({
        search: search ?? searchQuery,
        status: status ?? statusFilter,
        ...(effectiveSort ? { sort: effectiveSort, direction: effectiveDirection } : {}),
        page: effectivePage,
        per_page: perPage,
      });
      if (res.success && res.data) {
        // Guest leads (no account) and rollup leads are rendered, not dropped —
        // only guard against genuinely malformed rows (null/undefined entries).
        const rawLeads = res.data.leads ?? [];
        const freshLeads = rawLeads.filter((l) => l != null);
        setLeads(freshLeads);
        setTotal(res.data.total ?? 0);
        setStatusCounts(res.data.status_counts ?? {});
        setMessagesTotal(res.data.messages_total ?? 0);
        setTotalPages(res.data.meta?.total_pages ?? 1);
        onLeadsRefreshed?.(freshLeads);
      } else {
        setError(res.error || 'Failed to load leads');
      }
    } catch {
      setError('An error occurred while fetching leads');
    } finally {
      setIsLoading(false);
    }
  };

  const [leadGroups, setLeadGroups] = useState<LeadGroupSummary[]>([]);
  const [leadsView, setLeadsView] = useState<'leads' | 'groups' | 'conversations'>('leads');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const fetchMyConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const res = await leadsAPI.getMyConversations();
      if (res.success && res.data) setConversations(res.data.conversations ?? []);
    } catch {
      // silently ignore
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    const onRefresh = () => fetchMyConversations();
    window.addEventListener('my-conversations-refresh', onRefresh);
    return () => window.removeEventListener('my-conversations-refresh', onRefresh);
  }, []);

  // When a conversation gets selected (e.g. from a notification deep-link),
  // make sure the conversations view is showing.
  useEffect(() => {
    if (selectedConversationId && leadsView !== 'conversations') {
      setLeadsView('conversations');
      fetchMyConversations();
    }
  }, [selectedConversationId]);

  const fetchLeadGroups = async () => {
    try {
      const res = await leadsAPI.getLeadGroups();
      if (res.success && res.data) {
        const data = res.data as LeadGroupSummary[] | { groups: LeadGroupSummary[] };
        setLeadGroups(Array.isArray(data) ? data : (data.groups ?? []));
      }
    } catch {
      // silently ignore — groups are supplementary
    }
  };

  useEffect(() => { fetchLeads(); fetchLeadGroups(); fetchMyConversations(); }, []);
  useEffect(() => { if (refreshTrigger > 0) fetchLeads(); }, [refreshTrigger]);

  // Keep fetchArgsRef current after every render — deliberately no dep array.
  useEffect(() => {
    fetchArgsRef.current = { search: searchQuery, status: statusFilter, sort: sortField, direction: sortDirection, page };
  });

  useEffect(() => {
    // Reads fetchArgsRef instead of closing over searchQuery/statusFilter/
    // sortField/sortDirection/page directly — this effect only registers once
    // ([] deps), so a direct closure would freeze at mount-time defaults and
    // a tab refocus would silently discard the user's current page/sort/
    // search/status. See task-M2-report.md fix addendum.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const { search, status, sort, direction, page: currentPage } = fetchArgsRef.current;
        fetchLeads(search, status, sort, direction, currentPage);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchLeads(value, statusFilter, undefined, undefined, 1), 300);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    fetchLeads(searchQuery, value, undefined, undefined, 1);
    onFilterChange?.(value);
  };

  // Cycles a column through asc → desc → default (unsorted, back to the
  // backend's default last_engaged-desc ordering). Sorting always jumps back
  // to page 1 so the user isn't left staring at an out-of-range page.
  const handleSort = (field: 'name' | 'last_engaged' | 'status') => {
    let nextField: 'name' | 'last_engaged' | 'status' | null = field;
    let nextDirection: 'asc' | 'desc' = 'asc';
    if (sortField === field) {
      if (sortDirection === 'asc') {
        nextDirection = 'desc';
      } else {
        nextField = null;
      }
    }
    setSortField(nextField);
    setSortDirection(nextDirection);
    setPage(1);
    fetchLeads(searchQuery, statusFilter, nextField, nextDirection, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    fetchLeads(searchQuery, statusFilter, sortField, sortDirection, newPage);
  };

  const handleClear = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTimeFilter('all');
    setPage(1);
    fetchLeads('', 'all', sortField, sortDirection, 1);
  };

  const handleDeleteLead = async (leadId: number) => {
    try {
      const res = await leadsAPI.deleteLead(leadId);
      if (res.success) {
        setLeads(prev => prev.filter(l => l.id !== leadId));
        toast.success('Lead deleted');
      } else {
        toast.error('Failed to delete lead');
      }
    } catch {
      toast.error('Failed to delete lead');
    }
  };

  const handleArchiveLead = async (leadId: number) => {
    try {
      const res = await leadsAPI.archiveLead(leadId);
      if (res.success) {
        setLeads(prev => prev.filter(l => l.id !== leadId));
        toast.success(res.data?.is_archived ? 'Lead archived' : 'Lead unarchived');
      } else {
        toast.error('Failed to archive lead');
      }
    } catch {
      toast.error('Failed to archive lead');
    }
  };

  const handleUpdateStatus = async (leadId: number, newStatus: 'hot' | 'warm' | 'cold' | 'visited' | 'sold' | null) => {
    setUpdatingId(leadId);
    try {
      const res = await leadsAPI.updateLeadStatus(leadId, newStatus);
      if (res.success) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const hasActiveFilters = searchQuery.trim() !== '' || (statusFilter !== 'all' && statusFilter !== '') || timeFilter !== 'all';
  const conversationsUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  // Summary cards scoped to the ACTIVE sub-tab only (Task M4 / product
  // decision): switching sub-tabs swaps the whole card row, it never mixes
  // metrics from more than one dataset.
  const summaryCards: SummaryCardData[] = (() => {
    if (leadsView === 'leads') {
      return [
        { label: 'Total Leads', value: total },
        { label: 'Hot', value: statusCounts.hot ?? 0, valueClassName: 'text-red-600' },
        { label: 'Warm', value: statusCounts.warm ?? 0, valueClassName: 'text-orange-500' },
        { label: 'Cold', value: statusCounts.cold ?? 0, valueClassName: 'text-blue-500' },
        { label: 'Visited', value: statusCounts.visited ?? 0, valueClassName: 'text-purple-600' },
        { label: 'Sold', value: statusCounts.sold ?? 0, valueClassName: 'text-green-600' },
        // Messages = sent + received combined (backend messages_total).
        { label: 'Messages', value: messagesTotal },
      ];
    }
    if (leadsView === 'groups') {
      const totalMembers = leadGroups.reduce((sum, g) => sum + (g.member_count ?? 0), 0);
      const cards: SummaryCardData[] = [
        { label: 'Total Groups', value: leadGroups.length },
        { label: 'Total Members', value: totalMembers },
      ];
      // Only add the unread cards when the breakdown was actually threaded in —
      // cheap because it rides on UsersPage's existing /leads/unread-count call.
      if (unreadBreakdown) {
        cards.push({ label: 'Unread Messages', value: unreadBreakdown.total_unread_messages });
        cards.push({ label: 'Unread Comments', value: unreadBreakdown.total_unread_comments });
      }
      return cards;
    }
    // My Conversations
    return [
      { label: 'Total Conversations', value: conversations.length },
      { label: 'Unread', value: conversationsUnread, valueClassName: conversationsUnread > 0 ? 'text-red-600' : undefined },
    ];
  })();

  // Time filter — show only leads first seen within the selected period (by first_seen_at).
  const displayLeads = (() => {
    if (timeFilter === 'all') return leads;
    const now = new Date();
    const cutoff = new Date(now);
    if (timeFilter === 'daily') cutoff.setDate(now.getDate() - 1);
    else if (timeFilter === 'weekly') cutoff.setDate(now.getDate() - 7);
    else if (timeFilter === 'monthly') cutoff.setMonth(now.getMonth() - 1);
    else if (timeFilter === 'annually') cutoff.setFullYear(now.getFullYear() - 1);
    return leads.filter((l) => {
      if (!l.first_seen_at) return false;
      const seen = new Date(l.first_seen_at);
      return !isNaN(seen.getTime()) && seen >= cutoff;
    });
  })();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sub-tab toggle: Leads / Groups / My Conversations */}
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => { setLeadsView('leads'); onGroupSelect?.(null); onConversationSelect?.(null); }}
          className={`h-8 px-4 rounded-md text-sm font-medium transition-colors ${leadsView === 'leads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-700'}`}
        >
          Leads
        </button>
        <button
          onClick={() => { setLeadsView('groups'); onGroupSelect?.(null); onLeadSelect(null); onConversationSelect?.(null); }}
          className={`h-8 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${leadsView === 'groups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-700'}`}
        >
          Groups
          {leadGroups.length > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#6C60FF] text-white text-[10px] font-bold">
              {leadGroups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setLeadsView('conversations'); onLeadSelect(null); onGroupSelect?.(null); onConversationSelect?.(null); fetchMyConversations(); }}
          className={`h-8 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${leadsView === 'conversations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-700'}`}
        >
          My Conversations
          {conversationsUnread > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {conversationsUnread}
            </span>
          )}
        </button>
      </div>

      {/* Summary cards — scoped to the active sub-tab, above its content */}
      <SummaryCardRow cards={summaryCards} />

      {leadsView === 'leads' ? (
      <>
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search — takes remaining width (wraps the filters below it on narrow screens) */}
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search users or emails..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-full bg-gray-50 border-gray-200 placeholder:text-gray-400 h-9 text-sm"
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-32 bg-white border-gray-200 h-9 text-sm shrink-0 !ring-0 !outline-none !shadow-none focus:!ring-0 focus-visible:!ring-2 focus-visible:!ring-[#6C60FF] focus-visible:!ring-offset-1">
              {statusFilter === 'hot' && <span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
              {statusFilter === 'warm' && <span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
              {statusFilter === 'cold' && <span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
              {statusFilter === 'visited' && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span>}
              {statusFilter === 'sold' && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span>}
              {statusFilter === 'archived' && <span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" />Archived</span>}
              {statusFilter === 'all' && <SelectValue placeholder="Status" />}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
              <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
              <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
              <SelectItem value="visited"><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span></SelectItem>
              <SelectItem value="sold"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span></SelectItem>
              <SelectSeparator className="bg-gray-200" />
              <SelectItem value="archived"><span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" />Archived</span></SelectItem>
            </SelectContent>
          </Select>

          {/* Time filter — leads by first-seen period */}
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as typeof timeFilter)}>
            <SelectTrigger className="w-32 bg-white border-gray-200 h-9 text-sm shrink-0 !ring-0 !outline-none !shadow-none focus:!ring-0 focus-visible:!ring-2 focus-visible:!ring-[#6C60FF] focus-visible:!ring-offset-1">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>

          {/* Message Group — bulk messaging */}
          <Button
            onClick={() => (showMessageGroup ? setShowMessageGroup(false) : openMessageGroup())}
            className="h-9 px-4 text-sm bg-[#6C60FF] hover:bg-[#5A4FE5] text-white shrink-0 gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Message Group</span>
          </Button>

          {/* Search Group — global commentary search */}
          <Button
            variant="outline"
            onClick={() => (showSearchGroup ? setShowSearchGroup(false) : openSearchGroup())}
            className={`h-9 px-4 text-sm shrink-0 gap-1.5 border-[#6C60FF] text-[#6C60FF] hover:bg-purple-50 hover:text-[#6C60FF] ${showSearchGroup ? 'bg-purple-50' : ''}`}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search Group</span>
          </Button>

          {/* Clear */}
          <Button
            variant="outline"
            onClick={handleClear}
            className="h-9 px-4 text-sm border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
          >
            Clear
          </Button>

          {/* Leads Report (internally "Storeel") — same screen reachable from a
              property row's "⋯" menu in the Properties tab, surfaced here too
              since that's buried and this is where reps actually spend their
              time. Teal, deliberately distinct from the app's purple accent so
              it doesn't read as just another primary button. */}
          {onViewStoreelReport && (
            <Button
              variant="outline"
              onClick={onViewStoreelReport}
              className="h-9 px-4 text-sm shrink-0 gap-1.5 border-[#0D9488] text-[#0D9488] hover:bg-teal-50 hover:text-[#0D9488]"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Leads Report</span>
            </Button>
          )}

          {/* Search Group Commentary popover */}
          {showSearchGroup && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowSearchGroup(false)} />
              <div
                ref={searchGroupPanelRef}
                {...searchGroupDialogProps}
                className="absolute right-0 top-full mt-2 z-50 w-[520px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4 text-[#6C60FF]" />
                  </div>
                  <div className="min-w-0">
                    <p id="search-group-title" className="text-sm font-bold text-gray-900">Search Group Commentary</p>
                    <p className="text-xs text-gray-600">Search messages and activity for the leads on this page</p>
                  </div>
                </div>

                {/* Search input */}
                <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={groupInputRef}
                      value={groupQuery}
                      onChange={(e) => setGroupQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full h-10 pl-9 pr-9 text-sm border-2 border-[#6C60FF] rounded-lg outline-none bg-white text-gray-700 placeholder:text-gray-400"
                    />
                    {groupQuery && (
                      <button
                        onClick={() => { setGroupQuery(''); groupInputRef.current?.focus(); }}
                        aria-label="Clear search"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto border-t border-gray-100">
                  {isBuildingIndex ? (
                    <div className="flex items-center justify-center gap-2 py-10">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6C60FF]" />
                      <span className="text-sm text-gray-600">Loading messages...</span>
                    </div>
                  ) : !groupQ ? (
                    <p className="text-sm text-gray-600 text-center py-10">Type to search messages &amp; comments…</p>
                  ) : groupResults.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-10">No results found</p>
                  ) : (
                    groupResults.map((r, idx) => (
                      <button
                        key={`${r.lead.id}-${r.kind}-${idx}`}
                        onClick={() => {
                          if (onCommentaryJump) onCommentaryJump(r.lead, { kind: r.kind, id: r.targetId });
                          else onLeadSelect(r.lead);
                          setShowSearchGroup(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex gap-3 border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={r.lead.user?.profile_image} alt={leadDisplayName(r.lead)} />
                          <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">
                            {getInitials(leadDisplayName(r.lead))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{leadDisplayName(r.lead)}</span>
                            <span className="text-xs text-gray-600 shrink-0">{r.meta}</span>
                          </div>
                          {r.title && (
                            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">{highlightMatch(r.title, groupQuery)}</p>
                          )}
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{highlightMatch(r.body, groupQuery)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer count */}
                {groupQ && !isBuildingIndex && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
                    {groupResults.length} result{groupResults.length === 1 ? '' : 's'} found across {groupLeadCount} leads on this page
                  </div>
                )}
              </div>
            </>
          )}

          {/* Message Group popover */}
          {showMessageGroup && (
            <>
              <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setShowMessageGroup(false)} />
              <div
                ref={messageGroupPanelRef}
                {...messageGroupDialogProps}
                className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-[#6C60FF]" />
                  </div>
                  <div className="min-w-0">
                    <p id="message-group-title" className="text-sm font-bold text-gray-900">Message Group</p>
                    <p className="text-xs text-gray-600">Send a message to multiple leads</p>
                  </div>
                </div>

                {/* Search leads */}
                <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={mgSearch}
                      onChange={(e) => setMgSearch(e.target.value)}
                      placeholder="Search leads..."
                      className="w-full h-10 pl-9 pr-3 text-sm border border-gray-200 rounded-lg outline-none bg-gray-50 text-gray-700 placeholder:text-gray-400 focus:border-[#6C60FF]"
                    />
                  </div>
                </div>

                {/* Group name */}
                <div className="px-4 pb-3">
                  <p className="text-sm font-semibold text-gray-900 mb-1.5">Group Name</p>
                  <input
                    value={mgGroupName}
                    onChange={(e) => setMgGroupName(e.target.value)}
                    placeholder="Enter group name..."
                    className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none bg-white text-gray-700 placeholder:text-gray-400 focus:border-[#6C60FF]"
                  />
                </div>

                {/* Select All + status filter + AI Suggest */}
                <div className="px-4 flex items-center gap-2 relative">
                  <button
                    onClick={toggleSelectAll}
                    disabled={mgFiltered.length === 0}
                    className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  >
                    <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${allFilteredSelected ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                      {allFilteredSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span className="truncate">Select All ({mgSelected.size})</span>
                  </button>
                  <Select value={mgStatusFilter} onValueChange={setMgStatusFilter}>
                    <SelectTrigger className="w-24 h-[42px] bg-white border-gray-200 text-sm shrink-0 !ring-0 !outline-none !shadow-none focus:!ring-0 focus-visible:!ring-2 focus-visible:!ring-[#6C60FF] focus-visible:!ring-offset-1">
                      {mgStatusFilter === 'hot' && <span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
                      {mgStatusFilter === 'warm' && <span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
                      {mgStatusFilter === 'cold' && <span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
                      {mgStatusFilter === 'visited' && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span>}
                      {mgStatusFilter === 'sold' && <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span>}
                      {mgStatusFilter === 'all' && <SelectValue placeholder="Status" />}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
                      <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
                      <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
                      <SelectItem value="visited"><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span></SelectItem>
                      <SelectItem value="sold"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span></SelectItem>
                    </SelectContent>
                  </Select>

                  {/* AI Suggest */}
                  <button
                    onClick={() => setShowMgAiActions((v) => !v)}
                    title="AI Suggest"
                    className="h-9 px-4 rounded-lg shrink-0 flex items-center gap-1.5 whitespace-nowrap hover:opacity-90 transition-opacity"
                    style={{
                      border: '1.5px solid transparent',
                      backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #6C60FF, #FF5FAD)',
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#6C60FF]" />
                    <span className="bg-gradient-to-r from-[#6C60FF] to-[#FF5FAD] bg-clip-text text-transparent text-xs font-semibold">AI Suggest</span>
                  </button>

                  {showMgAiActions && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMgAiActions(false)} />
                      <div className="absolute right-4 top-full mt-2 z-50 w-[280px] max-w-[88vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100">
                          <div className="flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-[#6C60FF]" />
                            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Suggested Actions</p>
                          </div>
                          {mgAiCredits > 0 && (
                            <span className="flex items-center gap-1 px-2 h-6 rounded-full bg-purple-100 text-[#6C60FF] text-[11px] font-semibold shrink-0">
                              <Sparkles className="w-3 h-3" /> 1 credit
                            </span>
                          )}
                        </div>
                        <div className="max-h-[280px] overflow-y-auto p-2 space-y-1.5">
                          {AI_GROUP_ACTIONS.map((a) => {
                            const Icon = a.icon;
                            const isGenerating = mgGeneratingAction === a.key;
                            return (
                              <button
                                key={a.key}
                                onClick={() => handleMgAiAction(a.key)}
                                disabled={mgGeneratingAction !== null}
                                className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-[#6C60FF] hover:bg-purple-50/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {isGenerating ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6C60FF] shrink-0 mt-0.5" />
                                ) : (
                                  <Icon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{a.title}</p>
                                  <p className="text-xs text-gray-600">{isGenerating ? 'Generating…' : a.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Leads list */}
                <div className="px-4 py-3">
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                    {mgLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#6C60FF]" />
                        <span className="text-sm text-gray-600">Loading leads...</span>
                      </div>
                    ) : mgLoadError ? (
                      <p className="text-sm text-red-500 text-center py-8">{mgLoadError}</p>
                    ) : mgFiltered.length === 0 ? (
                      <p className="text-sm text-gray-600 text-center py-8">No leads found</p>
                    ) : (
                      mgFiltered.map((lead) => {
                        const checked = mgSelected.has(lead.id);
                        return (
                          <button
                            key={lead.id}
                            onClick={() => toggleMgSelect(lead.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-[#6C60FF] border-[#6C60FF]' : 'border-gray-300 bg-white'}`}>
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={lead.user?.profile_image} alt={leadDisplayName(lead)} />
                              <AvatarFallback className="bg-[#6C60FF] text-white text-[10px] font-medium">
                                {getInitials(leadDisplayName(lead))}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1.5">
                                {leadDisplayName(lead)}
                                {!lead.user?.id && <GuestBadge />}
                              </div>
                              <div className="text-xs text-gray-600 truncate">{leadDisplayEmail(lead)}</div>
                            </div>
                            {lead.status && (
                              <span
                                role="img"
                                aria-label={`${lead.status.charAt(0).toUpperCase()}${lead.status.slice(1)} lead`}
                                className={`flex items-center justify-center h-6 w-7 rounded-md border shrink-0 ${STATUS_TRIGGER_CLASS[lead.status]}`}
                              >
                                {lead.status === 'hot' && <img src="/hot-icon.svg" className="w-3 h-3.5" alt="" />}
                                {lead.status === 'warm' && <img src="/warm-icon.svg" className="w-2 h-3.5" alt="" />}
                                {lead.status === 'cold' && <img src="/cold-icon.svg" className="w-3.5 h-3.5" alt="" />}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Message body */}
                <div className="px-4 pb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-semibold text-gray-900">Message</p>
                    {mgLastAiAction && (
                      <button
                        onClick={() => handleMgAiAction(mgLastAiAction, true)}
                        disabled={mgGeneratingAction !== null}
                        title="Regenerate (free)"
                        className="flex items-center gap-1 px-2 h-6 rounded-md border border-[#6C60FF] text-[#6C60FF] bg-purple-50 hover:bg-purple-100 text-[11px] font-medium disabled:opacity-50 transition-colors"
                      >
                        {mgGeneratingAction ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#6C60FF]" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Retry
                      </button>
                    )}
                  </div>
                  <textarea
                    value={mgMessage}
                    onChange={(e) => { setMgMessage(e.target.value); if (e.target.value === '') setMgLastAiAction(null); }}
                    placeholder="Type your message here..."
                    rows={3}
                    className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border border-gray-200 rounded-lg outline-none focus:border-[#6C60FF] px-3 py-2.5 leading-relaxed"
                  />
                </div>

                {/* Footer actions */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={() => setShowMessageGroup(false)}
                    className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendGroup}
                    disabled={mgSelected.size === 0 || !mgMessage.trim() || !mgGroupName.trim() || mgSending}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {mgSending ? 'Sending...' : `Send to ${mgSelected.size}`}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Refresh */}
          <button
            onClick={() => fetchLeads()}
            disabled={isLoading}
            title="Refresh leads"
            aria-label="Refresh leads"
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#6C60FF] transition-colors shrink-0 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <SortableTh label="Lead" field="name" activeField={sortField} direction={sortDirection} onSort={handleSort} />
                <SortableTh label="Status" field="status" activeField={sortField} direction={sortDirection} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Viewed Campaigns</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Messages</th>
                <SortableTh label="Last Engaged" field="last_engaged" activeField={sortField} direction={sortDirection} onSort={handleSort} />
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">First Seen</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6C60FF]" />
                      <span className="text-sm text-gray-600">Loading leads...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-red-500 text-sm">{error}</td>
                </tr>
              ) : displayLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <p className="text-sm text-gray-600">No leads found</p>
                    {hasActiveFilters && (
                      <button onClick={handleClear} className="mt-2 text-xs text-[#6C60FF] hover:underline">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                displayLeads.map((lead) => {
                  const isSelected = selectedLead?.id === lead.id;
                  return (
                  <tr
                    key={lead.id}
                    className={`transition-colors cursor-pointer ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                    style={isSelected ? { boxShadow: 'inset 3px 0 0 #6C60FF' } : {}}
                    onClick={() => onLeadSelect(lead)}
                  >

                    {/* Lead: avatar + name + email + Via campaign */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`}>
                      <div className="flex items-center gap-2.5">
                        <Avatar className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} shrink-0`}>
                          <AvatarImage src={lead.user?.profile_image} alt={leadDisplayName(lead)} />
                          <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">
                            {getInitials(leadDisplayName(lead))}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className={`font-semibold text-gray-900 flex items-center gap-1.5 ${compact ? 'text-sm' : 'text-base'}`}>
                            {leadDisplayName(lead)}
                            {!lead.user?.id && <GuestBadge />}
                          </div>
                          <div className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>{leadDisplayEmail(lead)}</div>
                          <div className={`text-gray-600 mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>Via: {lead.story.title}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`} onClick={(e) => e.stopPropagation()}>
                      <StatusSelect lead={lead} onUpdate={handleUpdateStatus} disabled={updatingId === lead.id || !!lead.is_rollup} />
                    </td>

                    {/* Viewed Campaigns */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`}>
                      <span className={`font-semibold text-gray-800 ${compact ? 'text-sm' : 'text-base'}`}>{lead.engagement}</span>
                    </td>

                    {/* Messages */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onLeadSelect(lead)}
                        className="flex items-center gap-1.5 hover:opacity-75 transition-opacity"
                      >
                        <MessageSquare className={`text-gray-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                        <span className={`text-gray-700 ${compact ? 'text-sm' : 'text-base'}`}>{(lead.messages_count ?? 0) + (lead.comments?.length ?? 0)}</span>
                        {((lead.unread_count ?? 0) + (lead.comment_unread_count ?? 0)) > 0 && (
                          <span className="flex items-center justify-center min-w-[22px] h-5 px-1 rounded-lg bg-red-500 text-white text-[10px] font-bold">
                            {(lead.unread_count ?? 0) + (lead.comment_unread_count ?? 0)}
                          </span>
                        )}
                      </button>
                    </td>

                    {/* Last Engaged */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`}>
                      <div className={`flex items-center gap-1.5 text-gray-600 ${compact ? 'text-sm' : 'text-base'}`}>
                        <Clock className={`text-gray-400 shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                        {getTimeAgo(lead.last_engaged_at)}
                      </div>
                    </td>

                    {/* First Seen */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`}>
                      <span className={`text-gray-600 ${compact ? 'text-sm' : 'text-base'}`}>{formatDate(lead.first_seen_at)}</span>
                    </td>

                    {/* Actions */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'} text-right`} onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button aria-label="More actions" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg">
                          {lead.is_rollup ? (
                            <DropdownMenuLabel className="text-xs font-normal text-gray-600">View only</DropdownMenuLabel>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => handleArchiveLead(lead.id)} className="cursor-pointer text-sm flex items-center gap-2">
                                <Archive className="w-3.5 h-3.5" />{statusFilter === 'archived' ? 'Unarchive' : 'Archive'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteLead(lead.id)} className="cursor-pointer text-sm text-red-600 focus:text-red-600 flex items-center gap-2">
                                <Trash2 className="w-3.5 h-3.5" />Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6C60FF]" />
                <span className="text-sm text-gray-600">Loading leads...</span>
              </div>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-red-500 text-sm">{error}</div>
          ) : displayLeads.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-600">No leads found</p>
              {hasActiveFilters && (
                <button onClick={handleClear} className="mt-2 text-xs text-[#6C60FF] hover:underline">Clear filters</button>
              )}
            </div>
          ) : (
            displayLeads.map((lead) => (
              <div key={lead.id} className="px-4 py-4 space-y-3 cursor-pointer" onClick={() => onLeadSelect(lead)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={lead.user?.profile_image} alt={leadDisplayName(lead)} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">
                        {getInitials(leadDisplayName(lead))}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                        {leadDisplayName(lead)}
                        {!lead.user?.id && <GuestBadge />}
                      </div>
                      <div className="text-xs text-gray-600">{leadDisplayEmail(lead)}</div>
                      <div className="text-xs text-gray-600 mt-0.5">Via: {lead.story.title}</div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="More actions" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg">
                      {lead.is_rollup ? (
                        <DropdownMenuLabel className="text-xs font-normal text-gray-600">View only</DropdownMenuLabel>
                      ) : (
                        <>
                          <DropdownMenuItem onClick={() => handleArchiveLead(lead.id)} className="cursor-pointer text-sm flex items-center gap-2">
                            <Archive className="w-3.5 h-3.5" />{statusFilter === 'archived' ? 'Unarchive' : 'Archive'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteLead(lead.id)} className="cursor-pointer text-sm text-red-600 focus:text-red-600 flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div onClick={(e) => e.stopPropagation()}>
                    <StatusSelect lead={lead} onUpdate={handleUpdateStatus} disabled={updatingId === lead.id || !!lead.is_rollup} />
                  </div>
                  <span className="text-xs text-gray-600">{lead.engagement} views</span>
                  <button
                    onClick={() => onLeadSelect(lead)}
                    className="flex items-center gap-1 hover:opacity-75 transition-opacity"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-600">{(lead.messages_count ?? 0) + (lead.comments?.length ?? 0)}</span>
                    {((lead.unread_count ?? 0) + (lead.comment_unread_count ?? 0)) > 0 && (
                      <span className="flex items-center justify-center min-w-[22px] h-5 px-1 rounded-lg bg-red-500 text-white text-[10px] font-bold">
                        {(lead.unread_count ?? 0) + (lead.comment_unread_count ?? 0)}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getTimeAgo(lead.last_engaged_at)}
                  </div>
                  <span>First seen: {formatDate(lead.first_seen_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination footer */}
        {!isLoading && !error && total > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-gray-100">
            <span className="text-xs sm:text-sm text-gray-600">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="h-8 px-3 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              >
                Prev
              </button>
              <span className="text-xs text-gray-600 whitespace-nowrap">Page {page} of {totalPages}</span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="h-8 px-3 rounded-md border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      ) : leadsView === 'groups' ? (
        /* ─── Groups view (table) ─────────────────────────────────── */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {leadGroups.length === 0 ? (
            <div className="text-center py-16">
              <span className="inline-flex h-12 w-12 rounded-xl bg-purple-100 items-center justify-center mb-3">
                <Users className="w-6 h-6 text-[#6C60FF]" />
              </span>
              <p className="text-sm font-medium text-gray-700">No groups yet</p>
              <p className="text-xs text-gray-600 mt-1">Create one from the Leads tab using "Message Group".</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Group</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Members</th>
                      <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Created</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leadGroups.map((g) => {
                      const isSelected = selectedGroupId === g.id;
                      return (
                        <tr
                          key={g.id}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                          style={isSelected ? { boxShadow: 'inset 3px 0 0 #6C60FF' } : {}}
                          onClick={() => onGroupSelect?.(g.id)}
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4 text-[#6C60FF]" />
                              </span>
                              <span className="text-base font-semibold text-gray-900">{g.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center">
                              {(g.members ?? []).slice(0, 4).map((m, i) => (
                                <Avatar key={m.lead_id} className={`h-8 w-8 border-2 border-white ${i > 0 ? '-ml-2' : ''}`}>
                                  <AvatarImage src={m.profile_image ?? undefined} alt={m.name} />
                                  <AvatarFallback className="bg-[#6C60FF] text-white text-[10px] font-medium">{getInitials(m.name)}</AvatarFallback>
                                </Avatar>
                              ))}
                              {g.member_count > 4 && (
                                <span className="-ml-2 h-8 w-8 rounded-full border-2 border-white bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center">
                                  +{g.member_count - 4}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="text-gray-600">{formatDate(g.created_at)}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180 inline-block" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {leadGroups.map((g) => {
                  const isSelected = selectedGroupId === g.id;
                  return (
                    <div
                      key={g.id}
                      className={`px-4 py-4 cursor-pointer ${isSelected ? 'bg-purple-50' : ''}`}
                      onClick={() => onGroupSelect?.(g.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-[#6C60FF]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-900 truncate">{g.name}</div>
                          <div className="text-xs text-gray-600 mt-0.5">
                            {g.member_count} member{g.member_count === 1 ? '' : 's'} · {formatDate(g.created_at)}
                          </div>
                        </div>
                        <div className="flex items-center shrink-0">
                          {(g.members ?? []).slice(0, 3).map((m, i) => (
                            <Avatar key={m.lead_id} className={`h-7 w-7 border-2 border-white ${i > 0 ? '-ml-2' : ''}`}>
                              <AvatarImage src={m.profile_image ?? undefined} alt={m.name} />
                              <AvatarFallback className="bg-[#6C60FF] text-white text-[9px] font-medium">{getInitials(m.name)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {g.member_count > 3 && (
                            <span className="-ml-2 h-7 w-7 rounded-full border-2 border-white bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center">
                              +{g.member_count - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        /* ─── My Conversations view ───────────────────────────────── */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6C60FF]" />
              <span className="text-sm text-gray-600">Loading conversations...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16">
              <span className="inline-flex h-12 w-12 rounded-xl bg-purple-100 items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-[#6C60FF]" />
              </span>
              <p className="text-sm font-medium text-gray-700">No conversations yet</p>
              <p className="text-xs text-gray-600 mt-1">Messages with campaign owners will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((c) => {
                const isSelected = selectedConversationId === c.lead_id;
                const lm = c.last_message;
                return (
                  <div
                    key={c.lead_id}
                    className={`flex items-center gap-3 px-4 sm:px-6 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                    style={isSelected ? { boxShadow: 'inset 3px 0 0 #6C60FF' } : {}}
                    onClick={() => onConversationSelect?.(c)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={c.owner.profile_image} alt={c.owner.name} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">{getInitials(c.owner.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">{c.owner.name}</span>
                        <span className="text-xs text-gray-600 shrink-0">{getTimeAgo(c.last_message_at)}</span>
                      </div>
                      {c.story?.title && (
                        <div className="text-xs text-gray-600 truncate">Re: {c.story.title}</div>
                      )}
                      {lm && (
                        <div className="text-xs text-gray-600 truncate mt-0.5">
                          {lm.from_me && <span className="text-gray-600">You: </span>}{lm.body}
                        </div>
                      )}
                    </div>
                    {c.unread_count > 0 && (
                      <span className="flex items-center justify-center min-w-[22px] h-5 px-1 rounded-lg bg-red-500 text-white text-[10px] font-bold shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
