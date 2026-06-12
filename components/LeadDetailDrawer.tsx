import React, { useState, useEffect, useRef } from 'react';
import { Mail, Phone, MapPin, Clock, MessageSquare, X, Paperclip, Send, ChevronDown, Smile, RefreshCw, Eye, Sparkles, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Lead, LeadMessage, leadsAPI } from '../services/leadsAPI';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-600 border-red-200',
  warm: 'bg-orange-100 text-orange-500 border-orange-200',
  cold: 'bg-blue-100 text-blue-500 border-blue-200',
};

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getTimeAgo(dateString: string): string {
  if (!dateString) return 'Never';
  const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function getDaysAsLead(firstSeen: string): number {
  if (!firstSeen) return 0;
  return Math.floor((Date.now() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateString: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onRefreshLead?: () => Promise<void>;
  isArchived?: boolean;
}

export default function LeadDetailDrawer({ lead, open, onClose, onRefreshLead, isArchived = false }: Props) {
  const { user } = useAuth();
  const [currentStatus, setCurrentStatus] = useState<'hot' | 'warm' | 'cold' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [via, setVia] = useState<'email' | 'sms'>('email');
  const [isSending, setIsSending] = useState(false);
  const [showViaDropdown, setShowViaDropdown] = useState(false);
  const [replyingToMsgId, setReplyingToMsgId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && lead) {
      setCurrentStatus(lead.status ?? null);
      setMessage('');
      setSubject('');
      setReplyingToMsgId(null);
      setReplyText('');
      setShowSearch(false);
      setChatSearch('');
      isInitialLoad.current = true;
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
      fetchMessages(lead.id);
      const hasEmail = !!lead.user.email;
      const hasPhone = !!(lead.user.phone_number || lead.user.phone);
      setVia(hasEmail ? 'email' : hasPhone ? 'sms' : 'email');
    } else {
      setMessages([]);
      setReplyingToMsgId(null);
      setReplyText('');
      setReplyingToCommentId(null);
    }
  }, [open, lead]);

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
      } else {
        threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  const fetchMessages = async (leadId: number) => {
    setIsLoadingMessages(true);
    try {
      const res = await leadsAPI.getMessages(leadId);
      if (res.success && res.data?.messages) {
        setMessages(res.data.messages);
      }
      leadsAPI.markRead(leadId);
      leadsAPI.markCommentsRead(leadId);
      window.dispatchEvent(new CustomEvent('leads-unread-count-refresh'));
    } catch {
      // silently fail
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleStatusChange = async (val: string) => {
    const newStatus = val === 'none' ? null : val as 'hot' | 'warm' | 'cold';
    setIsUpdatingStatus(true);
    try {
      const res = await leadsAPI.updateLeadStatus(lead!.id, newStatus);
      if (res.success) setCurrentStatus(newStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const refreshAll = async () => {
    if (!lead) return;
    try {
      await Promise.all([
        fetchMessages(lead.id),
        onRefreshLead?.(),
      ]);
    } catch {
      // silently ignore refresh errors — the user action already succeeded
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    try {
      let res;
      if (via === 'sms') {
        res = await leadsAPI.sendSMS(lead!.id, message.trim());
      } else {
        res = await leadsAPI.sendEmail(lead!.id, subject.trim() || 'Following up', message.trim());
      }
      if (res.success) {
        setMessage('');
        setSubject('');
        toast.success(`${via === 'email' ? 'Email' : 'SMS'} sent successfully.`);
        await refreshAll();
      } else {
        toast.error((res as any)?.message || 'Failed to send message.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCommentReplySubmit = async (comment: { id: number; image_id: number }) => {
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    try {
      const res = await leadsAPI.replyToComment(comment.image_id, replyText.trim(), comment.id);
      if (res.success) {
        setReplyingToCommentId(null);
        setReplyText('');
        toast.success('Reply sent.');
        await refreshAll();
      } else {
        toast.error((res as any)?.message || 'Failed to send reply.');
      }
    } catch {
      toast.error('Failed to send reply.');
    } finally {
      setIsSendingReply(false);
    }
  };

  if (!lead) return null;

  const firstName = lead.user.name.split(' ')[0];
  const daysAsLead = getDaysAsLead(lead.first_seen_at);
  const unreadCount = lead.unread_count ?? 0;

  const renderMessage = (msg: LeadMessage, isChild = false): React.ReactNode => {
    const isOutbound = msg.direction === 'outbound';
    const isEmail = msg.channel === 'email';
    const channelLabel = isEmail ? 'Email' : 'SMS';
    const isReplying = replyingToMsgId === msg.id;
    const children = messages
      .filter((m) => m.parent_message_id === msg.id)
      .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

    const handleReplySubmit = async () => {
      if (!replyText.trim()) return;
      setIsSendingReply(true);
      try {
        const res = await leadsAPI.replyToMessage(lead!.id, msg.id, replyText.trim());
        if (res.success) {
          setReplyingToMsgId(null);
          setReplyText('');
          toast.success('Reply sent.');
          await refreshAll();
        } else {
          toast.error((res as any)?.message || 'Failed to send reply.');
        }
      } catch {
        toast.error('Failed to send reply.');
      } finally {
        setIsSendingReply(false);
      }
    };

    if (isOutbound) {
      return (
        <div key={`msg-${msg.id}`} className={isChild ? 'ml-4 mt-3' : 'py-3'}>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs text-gray-400">{formatShortDate(msg.sent_at)}</span>
              <span className="text-xs font-semibold text-gray-700">You</span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.avatar} alt={user?.name || 'You'} />
                <AvatarFallback className="bg-[#6C60FF] text-white text-[10px] font-bold">
                  {getInitials(user?.name || 'You')}
                </AvatarFallback>
              </Avatar>
            </div>
            {msg.subject && msg.subject !== 'Following up' && (
              <p className="text-xs font-semibold text-[#6C60FF] mb-1">{msg.subject}</p>
            )}
            <div className="max-w-[82%] bg-[#6C60FF] text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
              <p className="text-sm leading-relaxed">{msg.body}</p>
            </div>
            <div className="flex items-center gap-0.5 mt-1">
              <span className="text-[11px] text-gray-400">via {channelLabel}</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </div>
          </div>
          {children.map((child) => renderMessage(child, true))}
        </div>
      );
    }

    return (
      <div key={`msg-${msg.id}`} className={isChild ? 'ml-11 mt-3' : 'py-4'}>
        <div className="flex items-start gap-3">
          {/* Avatar with channel badge */}
          <div className="relative shrink-0 mt-0.5">
            <Avatar className="h-9 w-9">
              <AvatarImage src={lead.user.profile_image} alt={lead.user.name} />
              <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-semibold">
                {getInitials(lead.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 h-[18px] w-[18px] rounded-full flex items-center justify-center border-2 border-white bg-[#6C60FF]">
              {isEmail
                ? <Mail className="w-2.5 h-2.5 text-white" />
                : <MessageSquare className="w-2.5 h-2.5 text-white" />
              }
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* Name · channel  +  date */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-800">
                {firstName}
                <span className="font-normal text-gray-400"> · {channelLabel}</span>
              </span>
              <span className="text-xs text-gray-400 shrink-0">{formatShortDate(msg.sent_at)}</span>
            </div>

            {/* Subject above bubble */}
            {msg.subject && msg.subject !== 'Following up' && (
              <p className="text-xs font-semibold text-gray-900 mt-1">{msg.subject}</p>
            )}
            {/* Bubble */}
            <div className="w-fit max-w-[90%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 mt-1">
              <p className="text-sm text-gray-700 leading-relaxed">{msg.body}</p>
            </div>

            {/* Reply button */}
            {!isReplying && !isArchived && (
              <button
                onClick={() => {
                  setReplyingToMsgId(msg.id);
                  setReplyingToCommentId(null);
                  setReplyText('');
                  setTimeout(() => replyInputRef.current?.focus(), 50);
                }}
                className="mt-2 text-xs text-[#6C60FF] hover:underline font-medium"
              >
                Reply
              </button>
            )}

            {/* Inline reply box */}
            {isReplying && (
              <div className="mt-2 border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                <textarea
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReplySubmit(); } }}
                  placeholder={`Reply to ${firstName}...`}
                  rows={2}
                  className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent px-3 pt-2.5 pb-1 leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2 px-3 pb-2">
                  <button
                    onClick={() => { setReplyingToMsgId(null); setReplyText(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReplySubmit}
                    disabled={!replyText.trim() || isSendingReply}
                    className="flex items-center gap-1 h-7 px-3 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-xs font-medium disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    {isSendingReply ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Child messages indented */}
        {children.map((child) => renderMessage(child, true))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
        {/* Scrollable body — key resets scroll to top on each new lead */}
        <div key={lead.id} ref={scrollBodyRef} className="flex-1 overflow-y-auto">

          {/* Profile header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">

            {/* Top row: avatar + name/status + unread + X */}
            <div className="flex items-start gap-3">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarImage src={lead.user.profile_image} alt={lead.user.name} />
                <AvatarFallback className="bg-[#6C60FF] text-white text-base font-semibold">
                  {getInitials(lead.user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-gray-900 leading-tight">{lead.user.name}</p>
                    <Select
                      value={currentStatus ?? 'none'}
                      disabled={isUpdatingStatus}
                      onValueChange={handleStatusChange}
                    >
                      <SelectTrigger className={`mt-1.5 h-5 text-[11px] font-semibold rounded-md px-2 w-auto min-w-[60px] border shadow-none focus:ring-0 focus:outline-none outline-none ${
                        currentStatus ? STATUS_STYLES[currentStatus] : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>
                        {currentStatus === 'hot' && <span className="flex items-center gap-1"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span>}
                        {currentStatus === 'warm' && <span className="flex items-center gap-1"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span>}
                        {currentStatus === 'cold' && <span className="flex items-center gap-1"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span>}
                        {!currentStatus && <SelectValue />}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Set status</SelectItem>
                        <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" className="w-3 h-3.5" />Hot</span></SelectItem>
                        <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" className="w-2 h-3.5" />Warm</span></SelectItem>
                        <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" className="w-3.5 h-3.5" />Cold</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Unread badge + refresh + close */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {unreadCount > 0 && (
                      <span className="flex items-center justify-center min-w-[22px] h-6 px-1.5 rounded-lg bg-red-500 text-white text-xs font-bold">
                        {unreadCount}
                      </span>
                    )}
                    <button
                      onClick={onClose}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-1">Via: {lead.story.title}</p>
              </div>
            </div>

            {/* Contact info */}
            <div className="mt-4 space-y-2">
              {lead.user.email && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {lead.user.email}
                </div>
              )}
              {(lead.user.phone_number || lead.user.phone) && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {lead.user.phone_number || lead.user.phone}
                </div>
              )}
              {(lead.user.location || lead.user.city) && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  {lead.user.location || [lead.user.city, lead.user.country].filter(Boolean).join(', ')}
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                Last engaged {getTimeAgo(lead.last_engaged_at)}
              </div>
            </div>

            {/* Stats — grey background boxes */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="bg-gray-100 rounded-xl px-3 py-3 text-center">
                <div className="text-xl font-bold text-gray-900">{lead.engagement}</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-tight">Campaigns<br/>viewed</div>
              </div>
              <div className="bg-gray-100 rounded-xl px-3 py-3 text-center">
                <div className="text-xl font-bold text-gray-900">{lead.sent_count ?? 0}</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-tight">Messages<br/>sent</div>
              </div>
              <div className="bg-gray-100 rounded-xl px-3 py-3 text-center">
                <div className="text-xl font-bold text-gray-900">{daysAsLead}d</div>
                <div className="text-[11px] text-gray-400 mt-1 leading-tight">Days as<br/>lead</div>
              </div>
            </div>

            {/* AI Suggest / Email / Call buttons */}
            {(() => {
              const hasEmail = !!lead.user.email;
              const hasPhone = !!(lead.user.phone_number || lead.user.phone);
              const extraCount = (hasEmail ? 1 : 0) + (hasPhone ? 1 : 0);
              const gridCols = extraCount === 2 ? 'grid-cols-3' : extraCount === 1 ? 'grid-cols-2' : 'grid-cols-1';
              return (
                <div className={`mt-4 grid ${gridCols} gap-2`}>
                  <button
                    className="flex items-center justify-center gap-1 h-9 px-2 rounded-lg w-full whitespace-nowrap hover:opacity-90 transition-opacity"
                    style={{
                      border: '1.5px solid transparent',
                      backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #6C60FF, #FF5FAD)',
                      backgroundOrigin: 'border-box',
                      backgroundClip: 'padding-box, border-box',
                    }}
                  >
                    <Sparkles className="w-3 h-3 shrink-0 text-[#6C60FF]" />
                    <span className="bg-gradient-to-r from-[#6C60FF] to-[#FF5FAD] bg-clip-text text-transparent text-xs font-medium">AI Suggest</span>
                  </button>
                  {hasEmail && (
                    <button
                      onClick={() => window.open(`mailto:${lead.user.email}`)}
                      className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 text-sm text-gray-900 font-medium hover:bg-gray-50 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-gray-900" />
                      Email
                    </button>
                  )}
                  {hasPhone && (
                    <button
                      onClick={() => { const p = lead.user.phone_number || lead.user.phone; if (p) window.open(`tel:${p}`); }}
                      className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-gray-200 text-sm text-gray-900 font-medium hover:bg-gray-50 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-gray-900" />
                      Call
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Correspondence */}
          <div className="px-5 pt-4 pb-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Correspondence
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowSearch((v) => !v);
                    setChatSearch('');
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className={`h-6 w-6 flex items-center justify-center rounded-md border transition-colors ${showSearch ? 'border-[#6C60FF] text-[#6C60FF] bg-purple-50' : 'border-gray-200 text-gray-400 hover:text-[#6C60FF] hover:border-[#6C60FF]'}`}
                >
                  <Search className="w-3 h-3" />
                </button>
                <button
                  onClick={() => fetchMessages(lead.id)}
                  disabled={isLoadingMessages}
                  className="h-6 px-3 text-[11px] font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#6C60FF] hover:border-[#6C60FF] disabled:opacity-40 transition-colors"
                >
                  {isLoadingMessages ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            {showSearch && (
              <div className="mb-3 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#6C60FF] transition-colors placeholder:text-gray-400"
                />
                {chatSearch && (
                  <button onClick={() => setChatSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {isLoadingMessages ? (
              <p className="text-sm text-gray-400 text-center py-10">Loading messages...</p>
            ) : (() => {
              const comments = lead.comments ?? [];
              const topLevelMessages = messages.filter((m) => !m.parent_message_id);

              const q = chatSearch.toLowerCase().trim();
              const commentItems = comments
                .filter((c) => c.parent_id === null)
                .filter((c) => !q || c.description?.toLowerCase().includes(q))
                .map((c) => ({ _type: 'comment' as const, _date: new Date(c.created_at).getTime(), data: c }));
              const topLevelMessageItems = topLevelMessages
                .filter((m) => !q || m.body?.toLowerCase().includes(q) || m.subject?.toLowerCase().includes(q))
                .map((m) => ({ _type: 'message' as const, _date: new Date(m.sent_at).getTime(), data: m }));
              const topLevel = [...commentItems, ...topLevelMessageItems].sort((a, b) => a._date - b._date);

              return (
                <div>

                  {/* Campaign viewed — always first */}
                  <div className="flex items-center gap-2 py-2.5">
                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Eye className="w-3 h-3 text-gray-400" />
                    </div>
                    <span className="text-xs text-gray-400 flex-1">
                      {firstName} viewed <span className="font-medium text-gray-500">"{lead.story.title}"</span>
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{formatShortDate(lead.first_seen_at)}</span>
                  </div>

                  {topLevel.map((item) => {
                      if (item._type === 'comment') {
                        const c = item.data;
                        const childComments = comments.filter((ch) => ch.parent_id === c.id);
                        return (
                          <div key={`comment-${c.id}`} className="py-4">
                            {/* Parent comment row */}
                            <div className="flex items-start gap-3">
                              <div className="relative shrink-0 mt-0.5">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={c.user?.profile_image} alt={c.user?.name} />
                                  <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-semibold">
                                    {getInitials(c.user?.name || firstName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 h-[18px] w-[18px] rounded-full flex items-center justify-center border-2 border-white bg-[#6C60FF]">
                                  <MessageSquare className="w-2.5 h-2.5 text-white" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-gray-800">
                                    {c.user?.name || firstName}
                                    <span className="font-normal text-gray-400"> · Comment</span>
                                  </span>
                                  <span className="text-xs text-gray-400 shrink-0">{formatShortDate(c.created_at)}</span>
                                </div>
                                <div className="w-fit max-w-[90%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 mt-1">
                                  <p className="text-sm text-gray-700 leading-relaxed">{c.description}</p>
                                </div>

                                {/* Reply button */}
                                {replyingToCommentId !== c.id && !isArchived && (
                                  <button
                                    onClick={() => {
                                      setReplyingToCommentId(c.id);
                                      setReplyingToMsgId(null);
                                      setReplyText('');
                                      setTimeout(() => replyInputRef.current?.focus(), 50);
                                    }}
                                    className="mt-1 text-xs text-[#6C60FF] hover:underline font-medium"
                                  >
                                    Reply
                                  </button>
                                )}

                                {/* Inline reply box */}
                                {replyingToCommentId === c.id && (
                                  <div className="mt-2 flex items-start gap-2">
                                    <Avatar className="h-7 w-7 shrink-0 mt-1">
                                      <AvatarImage src={user?.avatar} alt={user?.name || 'You'} />
                                      <AvatarFallback className="bg-[#6C60FF] text-white text-[10px] font-bold">
                                        {getInitials(user?.name || 'You')}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                                      <textarea
                                        ref={replyInputRef}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentReplySubmit(c); } }}
                                        placeholder={`Reply to ${firstName}...`}
                                        rows={2}
                                        className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent px-3 pt-2.5 pb-1 leading-relaxed"
                                      />
                                      <div className="flex items-center justify-end gap-2 px-3 pb-2">
                                        <button
                                          onClick={() => { setReplyingToCommentId(null); setReplyText(''); }}
                                          className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleCommentReplySubmit(c)}
                                          disabled={!replyText.trim() || isSendingReply}
                                          className="flex items-center gap-1 h-7 px-3 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-xs font-medium disabled:opacity-40 transition-colors"
                                        >
                                          <Send className="w-3 h-3" />
                                          {isSendingReply ? 'Sending...' : 'Send'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Child comment replies — indented */}
                            {childComments.map((child) => {
                              const isMyReply = child.user?.id !== lead.user.id;
                              return (
                              <div key={`comment-${child.id}`} className="ml-12 mt-3 flex items-start gap-2">
                                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                                  <AvatarImage src={child.user?.profile_image} alt={child.user?.name} />
                                  <AvatarFallback className="bg-[#6C60FF] text-white text-[10px] font-semibold">
                                    {getInitials(child.user?.name || firstName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-gray-800">
                                      {child.user?.name || firstName}
                                      <span className="font-normal text-gray-400"> · Reply</span>
                                    </span>
                                    <span className="text-xs text-gray-400 shrink-0">{formatShortDate(child.created_at)}</span>
                                  </div>
                                  <div className={`inline-block rounded-2xl rounded-tl-sm px-4 py-2.5 mt-1 max-w-[90%] ${isMyReply ? 'bg-[#6C60FF]' : 'bg-gray-100'}`}>
                                    <p className={`text-sm leading-relaxed ${isMyReply ? 'text-white' : 'text-gray-700'}`}>{child.description}</p>
                                  </div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return renderMessage(item.data);
                    })}
                  <div ref={threadBottomRef} />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Compose box — pinned to bottom */}
        {isArchived && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-center text-sm text-gray-400">
            This lead is archived. Unarchive to send messages.
          </div>
        )}
        <div className={`border-t border-gray-200 px-4 pt-3 pb-4 bg-white ${isArchived ? 'hidden' : ''}`}>
          <div className="border border-gray-200 rounded-2xl bg-white px-4 pt-3 pb-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Send new message to ${firstName}...`}
              rows={3}
              className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent leading-relaxed"
            />
            <div className="flex items-center gap-2 mt-2">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                <Smile className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowViaDropdown((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-1.5 transition-colors"
                >
                  via {via === 'email' ? 'Email' : 'SMS'}
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showViaDropdown && (
                  <div className="absolute bottom-10 left-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10 w-28">
                    {(['email', 'sms'] as const).map((option) => {
                      const isDisabled = option === 'email'
                        ? !lead?.user.email
                        : !(lead?.user.phone_number || lead?.user.phone);
                      return (
                        <button
                          key={option}
                          disabled={isDisabled}
                          onClick={() => { if (isDisabled) return; setVia(option); setShowViaDropdown(false); if (option === 'sms') setSubject(''); }}
                          className={`w-full text-left px-3 py-2 text-sm ${isDisabled ? 'opacity-40 cursor-not-allowed text-gray-400' : via === option ? 'text-[#6C60FF] font-medium hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {option === 'email' ? 'Email' : 'SMS'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={!message.trim() || isSending}
                className="ml-auto flex items-center gap-2 h-10 px-5 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
