import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MoreHorizontal, MessageSquare, Clock, RefreshCw, Trash2, Archive, Check, Send, Users, ChevronLeft, Sparkles, Heart, Gift, Calendar, MessageCircle, ThumbsUp, TrendingUp, Lightbulb } from 'lucide-react';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { leadsAPI, Lead, LeadMessage, CommentaryTarget, LeadGroupSummary, LeadGroup, Conversation } from '../services/leadsAPI';

const STATUS_TRIGGER_CLASS: Record<string, string> = {
  hot: 'bg-red-100 text-red-600 border-red-200 hover:bg-red-100 focus:ring-0',
  warm: 'bg-orange-100 text-orange-500 border-orange-200 hover:bg-orange-100 focus:ring-0',
  cold: 'bg-blue-100 text-blue-500 border-blue-200 hover:bg-blue-100 focus:ring-0',
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

function StatusSelect({ lead, onUpdate, disabled }: { lead: Lead; onUpdate: (id: number, status: 'hot' | 'warm' | 'cold' | null) => void; disabled: boolean }) {
  return (
    <Select
      value={lead.status ?? 'none'}
      disabled={disabled}
      onValueChange={(val) => onUpdate(lead.id, val === 'none' ? null : val as 'hot' | 'warm' | 'cold')}
    >
      <SelectTrigger
        className={`h-6 text-xs font-medium rounded-md px-2 w-auto min-w-[68px] border shadow-none outline-none focus:ring-0 focus:outline-none ${
          lead.status
            ? STATUS_TRIGGER_CLASS[lead.status]
            : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50 focus:ring-0'
        }`}
      >
        {lead.status === 'hot' && <span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
        {lead.status === 'warm' && <span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
        {lead.status === 'cold' && <span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
        {!lead.status && <SelectValue placeholder="Set status" />}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Set status</SelectItem>
        <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
        <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
        <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
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
}

export default function LeadsTab({ selectedLead, onLeadSelect, refreshTrigger, compact = false, onLeadsRefreshed, onFilterChange, onCommentaryJump, selectedGroupId, onGroupSelect, selectedConversationId, onConversationSelect }: LeadsTabProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'annually'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search Group (global commentary search across all leads)
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

      // Messages — one request per lead, run in parallel.
      const fetched = await Promise.all(
        leads.map(async (lead) => {
          try {
            const res = await leadsAPI.getMessages(lead.id);
            if (res.success && res.data?.messages) return { lead, messages: res.data.messages };
          } catch {
            // ignore — a failed lead simply contributes no messages
          }
          return { lead, messages: [] as LeadMessage[] };
        })
      );

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
  const { limitData } = useMemoryLimit();
  const [mgAiCredits, setMgAiCredits] = useState<number>(limitData.ai_connects ?? 0);
  useEffect(() => { setMgAiCredits(limitData.ai_connects ?? 0); }, [limitData.ai_connects]);

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
  const uniqueLeads = (() => {
    const seen = new Set<number>();
    return leads.filter((l) => {
      if (seen.has(l.user.id)) return false;
      seen.add(l.user.id);
      return true;
    });
  })();
  const mgQ = mgSearch.toLowerCase().trim();
  const mgFiltered = uniqueLeads.filter(
    (l) =>
      (!mgQ || l.user.name.toLowerCase().includes(mgQ) || l.user.email.toLowerCase().includes(mgQ)) &&
      (mgStatusFilter === 'all' || l.status === mgStatusFilter)
  );
  const allFilteredSelected = mgFiltered.length > 0 && mgFiltered.every((l) => mgSelected.has(l.id));

  const openMessageGroup = () => {
    setShowMessageGroup(true);
    setMgSearch('');
    setMgSelected(new Set());
    setMgMessage('');
    setMgStatusFilter('all');
    setMgGroupName('');
    setShowMgAiActions(false);
    setMgLastAiAction(null);
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
      const bRes = await leadsAPI.broadcastToGroup(newGroup.id, body);
      if (bRes.success) {
        const sent = bRes.data?.summary?.sent ?? 0;
        const skipped = bRes.data?.summary?.skipped ?? 0;
        toast.success(`Group "${name}" created · sent to ${sent} member${sent === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped (no contact)` : ''}.`);
      } else {
        toast.error('Group created, but the broadcast failed.');
      }
      setShowMessageGroup(false);
      // Re-fetch leads + groups so the list reflects the newly created group.
      fetchLeads();
      fetchLeadGroups();
    } finally {
      setMgSending(false);
    }
  };

  const fetchLeads = async (search?: string, status?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await leadsAPI.getLeads({
        search: search ?? searchQuery,
        status: status ?? statusFilter,
      });
      if (res.success && res.data) {
        const freshLeads = res.data.leads ?? [];
        setLeads(freshLeads);
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

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchLeads(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchLeads(value, statusFilter), 300);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    fetchLeads(searchQuery, value);
    onFilterChange?.(value);
  };

  const handleClear = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTimeFilter('all');
    fetchLeads('', 'all');
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

  const handleUpdateStatus = async (leadId: number, newStatus: 'hot' | 'warm' | 'cold' | null) => {
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
          className={`h-8 px-4 rounded-md text-sm font-medium transition-colors ${leadsView === 'leads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Leads
        </button>
        <button
          onClick={() => { setLeadsView('groups'); onGroupSelect?.(null); onLeadSelect(null); onConversationSelect?.(null); }}
          className={`h-8 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${leadsView === 'groups' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
          className={`h-8 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${leadsView === 'conversations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          My Conversations
          {conversationsUnread > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {conversationsUnread}
            </span>
          )}
        </button>
      </div>

      {leadsView === 'leads' ? (
      <>
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="relative flex items-center gap-2 sm:gap-3">
          {/* Search — takes remaining width */}
          <div className="relative flex-1">
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
            <SelectTrigger className="w-32 bg-white border-gray-200 h-9 text-sm shrink-0 !ring-0 !outline-none !shadow-none focus:!ring-0 focus-visible:!ring-0 focus-visible:!border-gray-200">
              {statusFilter === 'hot' && <span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
              {statusFilter === 'warm' && <span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
              {statusFilter === 'cold' && <span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
              {statusFilter === 'archived' && <span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" />Archived</span>}
              {statusFilter === 'all' && <SelectValue placeholder="Status" />}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
              <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
              <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
              <SelectSeparator className="bg-gray-200" />
              <SelectItem value="archived"><span className="flex items-center gap-1.5"><Archive className="w-3.5 h-3.5" />Archived</span></SelectItem>
            </SelectContent>
          </Select>

          {/* Time filter — leads by first-seen period */}
          <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as typeof timeFilter)}>
            <SelectTrigger className="w-32 bg-white border-gray-200 h-9 text-sm shrink-0 !ring-0 !outline-none !shadow-none focus:!ring-0 focus-visible:!ring-0 focus-visible:!border-gray-200">
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

          {/* Search Group Commentary popover */}
          {showSearchGroup && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearchGroup(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-[520px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4 text-[#6C60FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">Search Group Commentary</p>
                    <p className="text-xs text-gray-400">Search across all leads' messages and activity</p>
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
                      <span className="text-sm text-gray-400">Loading messages...</span>
                    </div>
                  ) : !groupQ ? (
                    <p className="text-sm text-gray-400 text-center py-10">Type to search messages &amp; comments…</p>
                  ) : groupResults.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">No results found</p>
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
                          <AvatarImage src={r.lead.user.profile_image} alt={r.lead.user.name} />
                          <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">
                            {getInitials(r.lead.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">{r.lead.user.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{r.meta}</span>
                          </div>
                          {r.title && (
                            <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">{highlightMatch(r.title, groupQuery)}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{highlightMatch(r.body, groupQuery)}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer count */}
                {groupQ && !isBuildingIndex && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
                    {groupResults.length} result{groupResults.length === 1 ? '' : 's'} found across {groupLeadCount} leads
                  </div>
                )}
              </div>
            </>
          )}

          {/* Message Group popover */}
          {showMessageGroup && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMessageGroup(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-[380px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-[#6C60FF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">Message Group</p>
                    <p className="text-xs text-gray-400">Send a message to multiple leads</p>
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
                    <SelectTrigger className="w-24 h-[42px] bg-white border-gray-200 text-sm shrink-0 !ring-0 !outline-none !shadow-none focus:!ring-0 focus-visible:!ring-0 focus-visible:!border-gray-200">
                      {mgStatusFilter === 'hot' && <span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
                      {mgStatusFilter === 'warm' && <span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
                      {mgStatusFilter === 'cold' && <span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
                      {mgStatusFilter === 'all' && <SelectValue placeholder="Status" />}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
                      <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
                      <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
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
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Suggested Actions</p>
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
                                  <p className="text-xs text-gray-400">{isGenerating ? 'Generating…' : a.desc}</p>
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
                    {mgFiltered.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No leads found</p>
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
                              <AvatarImage src={lead.user.profile_image} alt={lead.user.name} />
                              <AvatarFallback className="bg-[#6C60FF] text-white text-[10px] font-medium">
                                {getInitials(lead.user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">{lead.user.name}</div>
                              <div className="text-xs text-gray-500 truncate">{lead.user.email}</div>
                            </div>
                            {lead.status && (
                              <span className={`flex items-center justify-center h-6 w-7 rounded-md border shrink-0 ${STATUS_TRIGGER_CLASS[lead.status]}`}>
                                {lead.status === 'hot' && <img src="/hot-icon.svg" className="w-3 h-3.5" />}
                                {lead.status === 'warm' && <img src="/warm-icon.svg" className="w-2 h-3.5" />}
                                {lead.status === 'cold' && <img src="/cold-icon.svg" className="w-3.5 h-3.5" />}
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
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Lead</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Viewed Campaigns</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Messages</th>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-700">Last Engaged</th>
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
                      <span className="text-sm text-gray-500">Loading leads...</span>
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
                    <p className="text-sm text-gray-400">No leads found</p>
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
                          <AvatarImage src={lead.user.profile_image} alt={lead.user.name} />
                          <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">
                            {getInitials(lead.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>{lead.user.name}</div>
                          <div className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>{lead.user.email}</div>
                          <div className={`text-gray-400 mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>Via: {lead.story.title}</div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className={`px-4 ${compact ? 'py-1.5' : 'py-2.5'}`} onClick={(e) => e.stopPropagation()}>
                      <StatusSelect lead={lead} onUpdate={handleUpdateStatus} disabled={updatingId === lead.id} />
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
                          <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg">
                          <DropdownMenuItem onClick={() => handleArchiveLead(lead.id)} className="cursor-pointer text-sm flex items-center gap-2">
                            <Archive className="w-3.5 h-3.5" />{statusFilter === 'archived' ? 'Unarchive' : 'Archive'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteLead(lead.id)} className="cursor-pointer text-sm text-red-600 focus:text-red-600 flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </DropdownMenuItem>
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
                <span className="text-sm text-gray-500">Loading leads...</span>
              </div>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-red-500 text-sm">{error}</div>
          ) : displayLeads.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-400">No leads found</p>
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
                      <AvatarImage src={lead.user.profile_image} alt={lead.user.name} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">
                        {getInitials(lead.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{lead.user.name}</div>
                      <div className="text-xs text-gray-500">{lead.user.email}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Via: {lead.story.title}</div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 bg-white border border-gray-200 shadow-lg">
                      <DropdownMenuItem onClick={() => handleArchiveLead(lead.id)} className="cursor-pointer text-sm flex items-center gap-2">
                        <Archive className="w-3.5 h-3.5" />{statusFilter === 'archived' ? 'Unarchive' : 'Archive'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteLead(lead.id)} className="cursor-pointer text-sm text-red-600 focus:text-red-600 flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div onClick={(e) => e.stopPropagation()}>
                    <StatusSelect lead={lead} onUpdate={handleUpdateStatus} disabled={updatingId === lead.id} />
                  </div>
                  <span className="text-xs text-gray-500">{lead.engagement} views</span>
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

                <div className="flex items-center gap-4 text-xs text-gray-500">
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
              <p className="text-xs text-gray-400 mt-1">Create one from the Leads tab using "Message Group".</p>
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
                          <div className="text-xs text-gray-500 mt-0.5">
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
              <span className="text-sm text-gray-500">Loading conversations...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-16">
              <span className="inline-flex h-12 w-12 rounded-xl bg-purple-100 items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6 text-[#6C60FF]" />
              </span>
              <p className="text-sm font-medium text-gray-700">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">Messages with campaign owners will appear here.</p>
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
                        <span className="text-xs text-gray-400 shrink-0">{getTimeAgo(c.last_message_at)}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">Re: {c.story.title}</div>
                      {lm && (
                        <div className="text-xs text-gray-500 truncate mt-0.5">
                          {lm.from_me && <span className="text-gray-400">You: </span>}{lm.body}
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
