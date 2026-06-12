import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MoreHorizontal, MessageSquare, Clock, RefreshCw, Trash2, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { leadsAPI, Lead } from '../services/leadsAPI';

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
}

export default function LeadsTab({ selectedLead, onLeadSelect, refreshTrigger, compact = false, onLeadsRefreshed, onFilterChange }: LeadsTabProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => { fetchLeads(); }, []);
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

  const hasActiveFilters = searchQuery.trim() !== '' || (statusFilter !== 'all' && statusFilter !== '');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-3">
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

          {/* Clear */}
          <Button
            variant="outline"
            onClick={handleClear}
            className="h-9 px-4 text-sm border-gray-200 text-gray-600 hover:bg-gray-50 shrink-0"
          >
            Clear
          </Button>

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
              ) : leads.length === 0 ? (
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
                leads.map((lead) => {
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
          ) : leads.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-400">No leads found</p>
              {hasActiveFilters && (
                <button onClick={handleClear} className="mt-2 text-xs text-[#6C60FF] hover:underline">Clear filters</button>
              )}
            </div>
          ) : (
            leads.map((lead) => (
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

    </div>
  );
}
