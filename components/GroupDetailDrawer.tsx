import React, { useEffect, useRef, useState } from 'react';
import { X, Users, AlertCircle, Send, Paperclip, Smile, Sparkles, Lightbulb, RefreshCw, MessageSquare, Heart, Gift, Calendar, MessageCircle, ThumbsUp, TrendingUp, FileText } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { LeadGroup, LeadMessageAttachment, leadsAPI } from '../services/leadsAPI';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { toast } from 'sonner';
import { smsSegmentInfo, SMS_MAX_BODY } from '../utils/smsSegments';

// AI Suggest actions (same 7 as the lead drawer / create modal).
const AI_ACTIONS: { key: string; icon: typeof Heart; title: string; desc: string }[] = [
  { key: 'feedback', icon: MessageSquare, title: 'Request Feedback', desc: 'Ask for their thoughts and opinions' },
  { key: 'thanks', icon: Heart, title: 'Thank You Message', desc: 'Show appreciation for their engagement' },
  { key: 'related', icon: Gift, title: 'Share Related Content', desc: 'Recommend another campaign they might enjoy' },
  { key: 'call', icon: Calendar, title: 'Schedule a Call', desc: 'Invite them to discuss the campaign over a call' },
  { key: 'followup', icon: MessageCircle, title: 'Generate Follow-up', desc: 'Create a thoughtful response to their recent activity' },
  { key: 'support', icon: ThumbsUp, title: 'Offer Support', desc: "Let them know you're available to help" },
  { key: 'reengage', icon: TrendingUp, title: 'Re-engagement Message', desc: 'Bring them back with news about updates' },
];

const STATUS_STYLES: Record<string, string> = {
  hot: 'bg-red-100 text-red-600 border-red-200',
  warm: 'bg-orange-100 text-orange-500 border-orange-200',
  cold: 'bg-blue-100 text-blue-500 border-blue-200',
};

// Built-in emoji grid — kept small/lightweight, no external dependency.
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎',
  '🤩', '🥳', '🙂', '😉', '😇', '🤔', '😏', '😴',
  '😢', '😮', '😡', '👍', '👎', '👏', '🙌', '🙏',
  '💪', '🔥', '✨', '🎉', '🎊', '❤️', '💜', '💙',
  '💚', '💛', '⭐', '🌟', '💯', '✅', '📅', '📞',
];

// Attachment constraints — images & PDF only, ~2 MB per file.
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

// Read a File as a base64 data URL (e.g. "data:application/pdf;base64,JVBER...").
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDateTime(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function channelLabel(ch: string): string {
  return ch.toLowerCase() === 'sms' ? 'SMS' : ch.charAt(0).toUpperCase() + ch.slice(1);
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Renders a broadcast's attachments: images as thumbnails, everything else
// (e.g. PDF) as a compact file chip. All open the S3 url in a new tab.
function MessageAttachments({ attachments }: { attachments: LeadMessageAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2 justify-end">
      {attachments.map((att) => {
        const isImage = att.content_type?.startsWith('image/');
        if (isImage) {
          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              title={att.filename}
              className="block h-24 w-24 rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
            >
              <img src={att.url} alt={att.filename} className="h-full w-full object-cover" />
            </a>
          );
        }
        return (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            title={att.filename}
            className="flex items-center gap-2 max-w-[220px] rounded-lg border border-gray-200 bg-white px-2.5 py-2 hover:bg-gray-50 transition-colors"
          >
            <span className="h-8 w-8 rounded-md bg-red-50 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-red-500" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-gray-700 truncate">{att.filename}</span>
              {att.size ? <span className="block text-[11px] text-gray-400">{formatFileSize(att.size)}</span> : null}
            </span>
          </a>
        );
      })}
    </div>
  );
}

interface Props {
  groupId: number | null;
  open: boolean;
  onClose: () => void;
}

export default function GroupDetailDrawer({ groupId, open, onClose }: Props) {
  const [group, setGroup] = useState<LeadGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingBroadcasts, setIsRefreshingBroadcasts] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composeInputRef = useRef<HTMLTextAreaElement>(null);
  const [showAiActions, setShowAiActions] = useState(false);
  const [generatingAction, setGeneratingAction] = useState<string | null>(null);
  const [lastAiAction, setLastAiAction] = useState<string | null>(null);
  const { limitData } = useMemoryLimit();
  const [aiCredits, setAiCredits] = useState<number>(limitData.ai_connects ?? 0);
  useEffect(() => { setAiCredits(limitData.ai_connects ?? 0); }, [limitData.ai_connects]);
  // Guards against StrictMode's dev double-invoke fetching the same group twice.
  const fetchedIdRef = useRef<number | null>(null);
  // Idempotency key for the broadcast compose — regenerated only after a
  // confirmed send, reused on failure/retry so a duplicate request dedupes
  // server-side (Task B3).
  const idemKeyRef = useRef<string>(crypto.randomUUID());

  const handleAiAction = async (action: string, noCredit = false) => {
    if (!group || generatingAction) return;
    setGeneratingAction(action);
    try {
      const res = await leadsAPI.aiSuggestGroup(action, noCredit, group.id);
      if (res.success && res.data?.message) {
        setMessage(res.data.message);
        setLastAiAction(action);
        if (typeof res.data.credits_remaining === 'number') setAiCredits(res.data.credits_remaining);
        if (!noCredit) recheckMemoryLimit();
        setShowAiActions(false);
      } else {
        const msg = ((res as any).message || res.error || '').toString();
        if (/out of credits/i.test(msg)) { setAiCredits(0); toast.error('Out of credits'); }
        else toast.error(msg || 'Failed to generate suggestion.');
      }
    } catch {
      toast.error('Failed to generate suggestion.');
    } finally {
      setGeneratingAction(null);
    }
  };

  useEffect(() => {
    if (open && groupId) {
      setMessage('');
      setShowAiActions(false);
      setLastAiAction(null);
      setShowEmojiPicker(false);
      setAttachments([]);
      // Fresh compose session for this group — new idempotency key.
      idemKeyRef.current = crypto.randomUUID();
      if (fetchedIdRef.current !== groupId) {
        fetchedIdRef.current = groupId;
        setGroup(null);
        fetchGroup(groupId);
      }
    } else {
      fetchedIdRef.current = null;
      setGroup(null);
      setMessage('');
      setShowAiActions(false);
      setLastAiAction(null);
      setShowEmojiPicker(false);
      setAttachments([]);
    }
  }, [open, groupId]);

  const fetchGroup = async (id: number, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await leadsAPI.getLeadGroup(id);
      if (res.success && res.data) {
        const data = res.data as LeadGroup | { group: LeadGroup };
        setGroup('members' in data ? data : data.group);
      }
    } catch {
      // silently ignore — drawer shows the not-found state
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Silent refetch so the members list above doesn't flash a full-page loader —
  // only the broadcast refresh icon spins.
  const handleRefreshBroadcasts = async () => {
    if (!group || isRefreshingBroadcasts) return;
    setIsRefreshingBroadcasts(true);
    try {
      await fetchGroup(group.id, true);
    } finally {
      setIsRefreshingBroadcasts(false);
    }
  };

  const reachableCount = group ? group.members.filter((m) => m.has_email || m.has_phone).length : 0;

  // Attachments reach email-reachable members; SMS members just get the text.
  const canSend = !!message.trim() || attachments.length > 0;

  const handleSend = async () => {
    if (isSending) return; // handler-level guard against double-send races
    const body = message.trim();
    if (!group || !canSend) return;
    setIsSending(true);
    try {
      // POST /lead-groups/{id}/broadcast — server fans out to email/SMS.
      const encoded = await Promise.all(
        attachments.map(async (f) => ({ filename: f.name, data: await fileToDataUrl(f) })),
      );
      const key = idemKeyRef.current;
      const res = await leadsAPI.broadcastToGroup(group.id, body, encoded, key);
      if (res.success) {
        idemKeyRef.current = crypto.randomUUID(); // confirmed success → fresh key for the next compose
        const sent = res.data?.summary?.sent ?? 0;
        const skipped = res.data?.summary?.skipped ?? 0;
        toast.success(`Message sent to ${sent} member${sent === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped (no contact)` : ''}.`);
        setMessage('');
        setAttachments([]);
        setShowEmojiPicker(false);
        setLastAiAction(null);
        // Refresh so the new broadcast appears in the history.
        fetchGroup(group.id, true);
      } else {
        toast.error('Failed to send message.');
        // failure → key intentionally kept for retry
      }
    } finally {
      setIsSending(false);
    }
  };

  // Insert an emoji at the textarea caret (falls back to appending).
  const insertEmoji = (emoji: string) => {
    const el = composeInputRef.current;
    if (el) {
      const start = el.selectionStart ?? message.length;
      const end = el.selectionEnd ?? message.length;
      const next = message.slice(0, start) + emoji + message.slice(end);
      setMessage(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setMessage((m) => m + emoji);
    }
  };

  // Validate picked files (images/PDF, ≤2 MB) and queue the valid ones.
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of picked) {
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      if (!isImage && !isPdf) {
        toast.error(`${f.name}: only images and PDF files are allowed.`);
        continue;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} is too large (max 2 MB).`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length) setAttachments((prev) => [...prev, ...valid]);
    e.target.value = ''; // allow re-picking the same file
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <span className="h-14 w-14 rounded-2xl bg-purple-100 flex items-center justify-center shrink-0">
              <Users className="w-7 h-7 text-[#6C60FF]" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-tight truncate">{group?.name ?? 'Group'}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {group ? `${group.member_count} member${group.member_count === 1 ? '' : 's'}` : ' '}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Member avatar stack */}
              {group && group.members.length > 0 && (
                <div className="flex items-center mt-3">
                  {group.members.slice(0, 6).map((m, i) => (
                    <Avatar key={m.lead_id} className={`h-7 w-7 border-2 border-white ${i > 0 ? '-ml-2' : ''}`}>
                      <AvatarImage src={m.user.profile_image} alt={m.user.name} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-[9px] font-medium">{getInitials(m.user.name)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {group.member_count > 6 && (
                    <span className="-ml-2 h-7 w-7 rounded-full border-2 border-white bg-gray-100 text-gray-600 text-[10px] font-semibold flex items-center justify-center">
                      +{group.member_count - 6}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Members list */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#6C60FF]" />
            <span className="text-sm text-gray-500">Loading group...</span>
          </div>
        ) : group ? (
          <div>
            <p className="px-5 pt-4 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Members</p>
            <div className="divide-y divide-gray-100">
              {group.members.map((m) => (
                <div key={m.lead_id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={m.user.profile_image} alt={m.user.name} />
                    <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-medium">{getInitials(m.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{m.user.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {m.has_email ? m.user.email : m.has_phone ? m.user.phone_number : <span className="text-red-500">No contact info</span>}
                    </div>
                  </div>
                  {!m.has_email && !m.has_phone && (
                    <span className="flex items-center gap-1 px-2 h-6 rounded-md bg-red-50 text-red-500 border border-red-200 text-[11px] font-medium shrink-0">
                      <AlertCircle className="w-3 h-3" /> No contact
                    </span>
                  )}
                  {m.status && (
                    <span className={`flex items-center justify-center h-6 w-7 rounded-md border shrink-0 ${STATUS_STYLES[m.status]}`}>
                      {m.status === 'hot' && <img src="/hot-icon.svg" className="w-3 h-3.5" />}
                      {m.status === 'warm' && <img src="/warm-icon.svg" className="w-2 h-3.5" />}
                      {m.status === 'cold' && <img src="/cold-icon.svg" className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Broadcast history */}
            {group.messages && group.messages.length > 0 && (
              <div className="border-t border-gray-100 mt-2">
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Broadcasts</p>
                  <button
                    onClick={handleRefreshBroadcasts}
                    disabled={isRefreshingBroadcasts}
                    title="Refresh broadcasts"
                    className="flex items-center gap-1.5 h-6 px-2.5 rounded-md border border-gray-200 text-[11px] font-medium text-gray-600 hover:text-[#6C60FF] hover:border-[#6C60FF] disabled:opacity-40 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingBroadcasts ? 'animate-spin' : ''}`} />
                    {isRefreshingBroadcasts ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="px-5 pb-4 space-y-4">
                  {[...group.messages]
                    .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
                    .map((m) => (
                      <div key={m.broadcast_id} className="flex flex-col items-end">
                        {m.subject && <p className="text-xs font-semibold text-[#6C60FF] mb-1 max-w-[85%] truncate">{m.subject}</p>}
                        {m.body && (
                          <div className="max-w-[85%] bg-[#6C60FF] text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                          </div>
                        )}
                        {m.attachments && m.attachments.length > 0 && (
                          <MessageAttachments attachments={m.attachments} />
                        )}
                        <div className="flex items-center flex-wrap justify-end gap-x-1.5 gap-y-0.5 mt-1 text-[11px] text-gray-400">
                          <span className="text-gray-500">{m.channels.map(channelLabel).join(', ')}</span>
                          <span>· {m.recipient_count} recipient{m.recipient_count === 1 ? '' : 's'}</span>
                          <span>· {formatDateTime(m.sent_at)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">Group not found.</p>
        )}
      </div>

      {/* Compose box — pinned to bottom (broadcasts to the whole group) */}
      <div className="border-t border-gray-200 px-4 pt-3 pb-4 bg-white">
        <div className="border border-gray-200 rounded-2xl bg-white px-4 pt-3 pb-3">
          <textarea
            ref={composeInputRef}
            value={message}
            onChange={(e) => { setMessage(e.target.value); if (e.target.value === '') setLastAiAction(null); }}
            onKeyDown={handleKeyDown}
            placeholder={group ? `Send a message to ${group.name}...` : 'Send a message to the group...'}
            rows={3}
            maxLength={SMS_MAX_BODY}
            disabled={!group}
            className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent leading-relaxed disabled:opacity-50"
          />

          {/* SMS character counter — broadcasts can go as SMS */}
          {group && (() => {
            const info = smsSegmentInfo(message);
            const isOverLimit = info.chars > SMS_MAX_BODY;
            const isAmber = info.segments > 3;
            const textColor = isOverLimit ? 'text-red-500' : isAmber ? 'text-amber-500' : 'text-gray-400';
            const segmentLabel = info.segments === 1 ? 'SMS segment' : 'SMS segments';
            return (
              <p className={`text-xs ${textColor} mt-1.5`}>
                {info.chars}/{SMS_MAX_BODY} · ~{info.segments} {segmentLabel}
              </p>
            );
          })()}

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-1.5 max-w-[200px] bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-600"
                >
                  <Paperclip className="w-3 h-3 shrink-0 text-gray-400" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-gray-400 shrink-0">{Math.ceil(f.size / 1024)} KB</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="text-gray-400 hover:text-gray-600 shrink-0"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input — images & PDF, ≤2 MB each */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={handleFilesSelected}
          />

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={!group}
              title="Attach image or PDF (max 2 MB)"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                disabled={!group}
                title="Insert emoji"
                className={`p-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${showEmojiPicker ? 'text-[#6C60FF]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Smile className="w-4 h-4" />
              </button>
              {showEmojiPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                  <div className="absolute bottom-10 left-0 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-8 gap-1">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="text-xl leading-none p-1 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* AI Suggest */}
            <div className="relative">
              <button
                onClick={() => setShowAiActions((v) => !v)}
                disabled={!group}
                title="AI Suggest"
                className="flex items-center justify-center gap-1 h-9 px-2 rounded-lg whitespace-nowrap hover:opacity-90 transition-opacity disabled:opacity-40"
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

              {showAiActions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAiActions(false)} />
                  <div className="absolute bottom-full left-0 mb-2 z-50 w-[280px] max-w-[80vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-[#6C60FF]" />
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Suggested Actions</p>
                      </div>
                      {aiCredits > 0 && (
                        <span className="flex items-center gap-1 px-2 h-6 rounded-full bg-purple-100 text-[#6C60FF] text-[11px] font-semibold shrink-0">
                          <Sparkles className="w-3 h-3" /> 1 credit
                        </span>
                      )}
                    </div>
                    <div className="max-h-[280px] overflow-y-auto p-2 space-y-1.5">
                      {AI_ACTIONS.map((a) => {
                        const Icon = a.icon;
                        const isGenerating = generatingAction === a.key;
                        return (
                          <button
                            key={a.key}
                            onClick={() => handleAiAction(a.key)}
                            disabled={generatingAction !== null}
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

            {/* Retry — free regenerate */}
            {lastAiAction && (
              <button
                onClick={() => handleAiAction(lastAiAction, true)}
                disabled={generatingAction !== null}
                title="Regenerate (free)"
                className="flex items-center gap-1 h-9 px-2.5 rounded-lg border border-[#6C60FF] text-[#6C60FF] bg-purple-50 hover:bg-purple-100 text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {generatingAction ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-[#6C60FF]" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Retry
              </button>
            )}

            <button
              onClick={handleSend}
              disabled={!group || !canSend || isSending}
              className="ml-auto flex items-center gap-2 h-10 px-5 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : `Send to ${reachableCount}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
