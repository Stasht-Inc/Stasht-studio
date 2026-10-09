import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Mail, Phone, MessageSquare, X, Paperclip, Send, ChevronDown, Smile, RefreshCw, Eye, Sparkles, Search, Heart, Gift, Calendar, MessageCircle, ThumbsUp, TrendingUp, Lightbulb, FileText, UserRound, Plus, ChevronLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Lead, LeadMessage, LeadMessageAttachment, leadsAPI, CommentaryTarget, messageChannelLabel } from '../services/leadsAPI';
import { useAuth } from '../contexts/AuthContext';
import { useMemoryLimit, recheckMemoryLimit } from '../hooks/useMemoryLimit';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { toast } from 'sonner';
import { smsSegmentInfo, SMS_MAX_BODY } from '../utils/smsSegments';
import ShareCarsDialog from './ShareCarsDialog';
import AssigneeControl from './leads/AssigneeControl';
import LinkifiedText from './leads/LinkifiedText';
import LeadDetailsSidebar, { StatusChip } from './LeadDetailsSidebar';

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
// Twilio MMS to US/Canada: JPG/PNG/GIF are resized for the phone, PDFs accepted; 5 MB per text.
const MMS_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_MMS_TOTAL_BYTES = 5 * 1024 * 1024;
// Website chat (Contact Us widget, spec 2026-09-29): up to 3 photos/PDFs per message, the widget's
// types (WebP too). Files stay under the composer's 2 MB-per-file cap above; the API allows 5 MB.
const CHAT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const CHAT_MAX_FILES = 3;
const CHAT_MAX_BODY = 1000;
const CHAT_OFFLINE_HINT = "They've left your site — reply by text or email";
type Via = 'email' | 'sms' | 'chat';
const VIA_LABELS: Record<Via, string> = { email: 'Email', sms: 'SMS', chat: 'Website chat' };

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

// AI Suggest quick actions — each generates a message via the ai-suggest API.
const AI_ACTIONS: { key: string; icon: typeof Heart; title: string; desc: string }[] = [
  { key: 'feedback', icon: MessageSquare, title: 'Request Feedback', desc: 'Ask for their thoughts and opinions' },
  { key: 'thanks', icon: Heart, title: 'Thank You Message', desc: 'Show appreciation for their engagement' },
  { key: 'related', icon: Gift, title: 'Share Related Content', desc: 'Recommend another campaign they might enjoy' },
  { key: 'call', icon: Calendar, title: 'Schedule a Call', desc: 'Invite them to discuss the campaign over a call' },
  { key: 'followup', icon: MessageCircle, title: 'Generate Follow-up', desc: 'Create a thoughtful response to their recent activity' },
  { key: 'support', icon: ThumbsUp, title: 'Offer Support', desc: "Let them know you're available to help" },
  { key: 'reengage', icon: TrendingUp, title: 'Re-engagement Message', desc: 'Bring them back with news about updates' },
];

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

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Renders a message's attachments: images as thumbnails, everything else
// (e.g. PDF) as a compact file chip. All open the S3 url in a new tab.
function MessageAttachments({
  attachments,
  align = 'left',
}: {
  attachments: LeadMessageAttachment[];
  align?: 'left' | 'right';
}) {
  if (!attachments?.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 mt-2 ${align === 'right' ? 'justify-end' : ''}`}>
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
              {att.size ? <span className="block text-[12px] text-gray-600">{formatFileSize(att.size)}</span> : null}
            </span>
          </a>
        );
      })}
    </div>
  );
}

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onRefreshLead?: () => Promise<void>;
  isArchived?: boolean;
  highlightTarget?: CommentaryTarget | null;
  onTargetHandled?: () => void;
  onNavigate?: (page: string) => void;
}

export default function LeadDetailDrawer({ lead, open, onClose, onRefreshLead, isArchived = false, highlightTarget, onTargetHandled, onNavigate }: Props) {
  const { user } = useAuth();
  const { limitData } = useMemoryLimit();
  const [aiCredits, setAiCredits] = useState<number>(limitData.ai_connects ?? 0);
  const [generatingAction, setGeneratingAction] = useState<string | null>(null);
  useEffect(() => { setAiCredits(limitData.ai_connects ?? 0); }, [limitData.ai_connects]);
  const [currentStatus, setCurrentStatus] = useState<'hot' | 'warm' | 'cold' | 'visited' | 'sold' | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [via, setVia] = useState<Via>('email');
  const viaRef = useRef<Via>('email');
  viaRef.current = via;
  // Once the rep has left Website chat for any reason (a 409 visitor_offline, or picking any
  // channel by hand — including Website chat itself, which puts the rep in control) the
  // auto-engage effect below stops re-selecting chat on its own; only a different lead resets it.
  const autoChatBlockedRef = useRef(false);
  // Website chat: whether the visitor's widget checked in within the last 20 s (the thread's
  // visitor_online, re-read on the 5 s refresh), and the one-line notice after they left.
  const [visitorOnline, setVisitorOnline] = useState(false);
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showViaDropdown, setShowViaDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showShareCars, setShowShareCars] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composeInputRef = useRef<HTMLTextAreaElement>(null);
  // Idempotency keys: one per compose site, regenerated only after a confirmed
  // send, reused on failure/retry so a duplicate request dedupes server-side.
  // Backend dedup is keyed (lead_id, idempotency_key) — NOT channel-scoped —
  // so SMS and Email need separate refs; sharing one ref lets an ambiguous
  // SMS failure's key collide with a later, different-content Email send on
  // the same lead (the server replays the old SMS row as a 200 for the new
  // Email request and the new content is silently dropped).
  const smsIdemKeyRef = useRef<string>(crypto.randomUUID());
  const emailIdemKeyRef = useRef<string>(crypto.randomUUID());
  const chatIdemKeyRef = useRef<string>(crypto.randomUUID());
  // Inline Reply (the reply box under a single message, as opposed to the main composer above)
  // can send on a different channel each attempt: the visitor can go offline between a first
  // try (byChat) and a retry (falls through to sms/email), or the lead's phone/email can change.
  // One shared key across channels would hit the same (lead_id, idempotency_key) collision the
  // comment above warns about for the main composer — a retry on a new channel could be answered
  // with the old channel's stored row instead of actually sending. So this is a key per channel
  // kind, not one ref; getReplyIdemKey() below mints one lazily and only that channel's key is
  // rotated on a confirmed send.
  const replyIdemKeysRef = useRef<Record<string, string>>({});
  const getReplyIdemKey = (channelKind: string): string => {
    const existing = replyIdemKeysRef.current[channelKind];
    if (existing) return existing;
    const key = crypto.randomUUID();
    replyIdemKeysRef.current[channelKind] = key;
    return key;
  };
  const [replyingToMsgId, setReplyingToMsgId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showAiSuggest, setShowAiSuggest] = useState(false);
  const [lastAiAction, setLastAiAction] = useState<string | null>(null);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);
  // True once the current lead's messages have been fetched at least once, so the
  // open-at-newest scroll waits for real content instead of firing on mount.
  const messagesFetched = useRef(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  // True while the reader is at (or near) the bottom of the thread — new messages only
  // auto-scroll then, so someone reading older messages isn't yanked down.
  const stickToBottomRef = useRef(true);
  // Our own smooth auto-scroll fires scroll events mid-animation (still "far" from the bottom);
  // those must not be mistaken for the reader scrolling away.
  const autoScrollUntilRef = useRef(0);
  const messagesRef = useRef<LeadMessage[]>([]);
  const handleThreadScroll = () => {
    if (Date.now() < autoScrollUntilRef.current) return;
    const el = scrollBodyRef.current;
    if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  // Refs to each message/comment row, keyed "message-<id>" / "comment-<id>",
  // used to scroll-to + highlight a row when jumping in from Search Group.
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  // UsersPage only mounts this drawer while the right-hand panel is open
  // (see pages/UsersPage.tsx ~:2721), so `open` is always true here — the
  // hook's open/close transition is this component's own mount/unmount.
  const { panelRef, dialogProps } = useDialogBehavior({
    open: true,
    onClose,
    labelledBy: 'lead-drawer-title',
  });

  useEffect(() => {
    if (open && lead) {
      setCurrentStatus(lead.status ?? null);
      setMessage('');
      setSubject('');
      setReplyingToMsgId(null);
      setReplyText('');
      setShowSearch(false);
      setChatSearch('');
      setShowAiSuggest(false);
      setLastAiAction(null);
      setHighlightedKey(null);
      setShowEmojiPicker(false);
      setAttachments([]);
      isInitialLoad.current = true;
      messagesFetched.current = false;
      stickToBottomRef.current = true;
      // Fresh compose session for this lead — new idempotency keys.
      smsIdemKeyRef.current = crypto.randomUUID();
      emailIdemKeyRef.current = crypto.randomUUID();
      chatIdemKeyRef.current = crypto.randomUUID();
      replyIdemKeysRef.current = {};
      setVisitorOnline(false);
      setChatNotice(null);
      autoChatBlockedRef.current = false;
      if (scrollBodyRef.current) scrollBodyRef.current.scrollTop = 0;
      fetchMessages(lead.id);
      const hasEmail = !!lead.user?.email;
      const hasPhone = !!(lead.user?.phone_number || lead.user?.phone);
      setVia(hasEmail ? 'email' : hasPhone ? 'sms' : 'email');
    } else {
      setMessages([]);
      setReplyingToMsgId(null);
      setReplyText('');
      setReplyingToCommentId(null);
      setShowEmojiPicker(false);
      setAttachments([]);
    }
  }, [open, lead]);

  // Open on the newest message/comment (not the middle of the thread), then follow
  // new messages smoothly. A Search Group jump (highlightTarget) scrolls to its own
  // row instead. Scrolls the thread container directly so the page never moves.
  // Layout effect: runs after the DOM commits but before paint, so the thread never
  // flashes at the top first (and, unlike requestAnimationFrame, it still runs in a
  // background tab).
  useLayoutEffect(() => {
    const el = scrollBodyRef.current;
    if (!el || isLoadingMessages || !messagesFetched.current) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      if (highlightTarget) return;
      el.scrollTop = el.scrollHeight;
    } else if (messages.length > 0 && stickToBottomRef.current) {
      autoScrollUntilRef.current = Date.now() + 900;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoadingMessages]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Live updates: a customer's reply should appear in an already-open thread without
  // pressing Refresh (Chris, 2026-09-21: the sidebar badge showed his SMS but the open
  // conversation didn't). Polls every 5s while the tab is visible; only touches state when
  // something changed (no re-render/scroll jump otherwise) and marks new incoming messages
  // read, since the reader is looking right at them. Never touches the composer draft.
  useEffect(() => {
    if (!open || !lead) return;
    const leadId = lead.id;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || cancelled || document.visibilityState !== 'visible') return;
      if (!messagesFetched.current) return; // initial load still running
      inFlight = true;
      try {
        const res = await leadsAPI.getMessages(leadId, true);
        if (cancelled || !res.success || !res.data?.messages) return;
        setVisitorOnline(!!res.data.visitor_online);
        const next = res.data.messages;
        const prev = messagesRef.current;
        const unchanged = next.length === prev.length
          && next.every((m, i) => m.id === prev[i].id && m.status === prev[i].status);
        if (unchanged) return;
        const known = new Set(prev.map((m) => m.id));
        const hasNewIncoming = next.some((m) => m.direction === 'inbound' && !known.has(m.id));
        setMessages(next);
        if (hasNewIncoming) {
          leadsAPI.markRead(leadId);
          window.dispatchEvent(new CustomEvent('leads-unread-count-refresh'));
          // A reply changes the lead itself (Last engaged, status) — re-fetch it so the
          // details sidebar doesn't keep showing the old date.
          onRefreshLead?.();
        }
      } catch {
        // transient — try again on the next tick
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(poll, 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, lead?.id]);

  // Jump-to-row: when opened from Search Group with a target, wait for the
  // thread to render, then scroll the matched message/comment into view and
  // briefly highlight it.
  useEffect(() => {
    if (!open || !highlightTarget || isLoadingMessages) return;
    const key = `${highlightTarget.kind}-${highlightTarget.id}`;
    const t = setTimeout(() => {
      const el = rowRefs.current[key];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedKey(key);
        setTimeout(() => setHighlightedKey(null), 2500);
      }
      onTargetHandled?.();
    }, 200);
    return () => clearTimeout(t);
  }, [open, highlightTarget, isLoadingMessages, messages, lead?.id]);

  const fetchMessages = async (leadId: number) => {
    setIsLoadingMessages(true);
    try {
      const res = await leadsAPI.getMessages(leadId, true);
      if (res.success && res.data?.messages) {
        setMessages(res.data.messages);
        setVisitorOnline(!!res.data.visitor_online);
      }
      // mark-read also clears this user's bell notifications for the lead.
      leadsAPI.markRead(leadId).then(() => window.dispatchEvent(new CustomEvent('notifications-count-refresh')));
      leadsAPI.markCommentsRead(leadId);
      window.dispatchEvent(new CustomEvent('leads-unread-count-refresh'));
    } catch {
      // silently fail
    } finally {
      messagesFetched.current = true;
      setIsLoadingMessages(false);
    }
  };

  const handleStatusChange = async (val: string) => {
    if (lead?.is_rollup) return; // read-only — backend also 403s this for rollup leads
    const newStatus = val === 'none' ? null : val as 'hot' | 'warm' | 'cold' | 'visited' | 'sold';
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
    stickToBottomRef.current = true; // the user just acted — show the result
    try {
      await Promise.all([
        fetchMessages(lead.id),
        onRefreshLead?.(),
      ]);
    } catch {
      // silently ignore refresh errors — the user action already succeeded
    }
  };

  // Same email/phone facts the via-dropdown uses to disable an option
  // (:~1174-1176) — covers guest leads too, since the backend nests guest
  // contact info straight into `user` (F5). A lead with neither is not
  // reachable over any channel, so the whole composer gets replaced by a note.
  const hasAnyContact = !!lead?.user?.email || !!(lead?.user?.phone_number || lead?.user?.phone);
  // Website chat is offered only on leads that came from the Contact Us widget (spec 2026-09-29).
  const isWidgetLead = lead?.source === 'widget';
  const leadHasPhone = !!(lead?.user?.phone_number || lead?.user?.phone);

  // Both channels may carry attachments (texts go as MMS), so a bare attachment
  // with no words can be sent either way.
  const hasAttachments = attachments.length > 0;
  const canSend = (!!message.trim() || hasAttachments) && hasAnyContact;

  const handleSend = async () => {
    if (isSending) return; // handler-level guard against double-send races
    if (!canSend) return;
    if (!hasAnyContact) return; // no contact info — composer is hidden, this is a backstop
    if (lead?.is_rollup) return; // read-only — composer is hidden, this is a backstop
    setIsSending(true);
    try {
      // Per-channel keys — the backend dedupes on (lead_id, idempotency_key)
      // with no channel dimension, so SMS, Email and chat must never share one.
      const key = via === 'sms' ? smsIdemKeyRef.current : via === 'chat' ? chatIdemKeyRef.current : emailIdemKeyRef.current;
      const encoded = await Promise.all(
        attachments.map(async (f) => ({ filename: f.name, data: await fileToDataUrl(f) })),
      );
      const res = via === 'chat'
        ? await leadsAPI.sendChat(lead!.id, message.trim(), key, encoded)
        : via === 'sms'
          ? await leadsAPI.sendSMS(lead!.id, message.trim(), key, encoded)
          : await leadsAPI.sendEmail(lead!.id, subject.trim() || 'Following up', message.trim(), encoded, key);
      if (res.success) {
        // confirmed success → fresh key for the next compose on THIS channel only
        if (via === 'sms') smsIdemKeyRef.current = crypto.randomUUID();
        else if (via === 'chat') chatIdemKeyRef.current = crypto.randomUUID();
        else emailIdemKeyRef.current = crypto.randomUUID();
        setMessage('');
        setSubject('');
        setAttachments([]);
        setShowEmojiPicker(false);
        setLastAiAction(null);
        setChatNotice(null);
        toast.success(via === 'chat' ? 'Sent to their website chat.' : `${via === 'email' ? 'Email' : 'SMS'} sent successfully.`);
        await refreshAll();
      } else if (via === 'chat' && (res as any)?.code === 'visitor_offline') {
        // They left just as the rep hit Send: nothing went out — keep the draft, move to text/email.
        setVisitorOnline(false);
        leaveChat();
      } else {
        toast.error((res as any)?.message || 'Failed to send message.');
        // failure → key intentionally kept so a retry dedupes with this attempt
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message.');
      // unknown outcome → key intentionally kept so a retry dedupes with this attempt
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

  // Validate picked files (images/PDF, ≤2 MB each; texts: JPG/PNG/GIF/PDF and
  // 5 MB in total, Twilio's MMS limit) and queue the valid ones.
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    let total = attachments.reduce((sum, f) => sum + f.size, 0);
    for (const f of picked) {
      const isImage = f.type.startsWith('image/');
      const isPdf = f.type === 'application/pdf';
      if (!isImage && !isPdf) {
        toast.error(`${f.name}: only images and PDF files are allowed.`);
        continue;
      }
      if (via === 'sms' && !MMS_TYPES.includes(f.type)) {
        toast.error(`${f.name}: texts can carry JPG, PNG or GIF photos and PDF files only.`);
        continue;
      }
      if (via === 'chat' && !CHAT_TYPES.includes(f.type)) {
        toast.error(`${f.name}: website chat carries JPG, PNG, GIF or WebP photos and PDF files only.`);
        continue;
      }
      if (via === 'chat' && attachments.length + valid.length >= CHAT_MAX_FILES) {
        toast.error('Website chat messages can carry up to 3 files.');
        continue;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} is too large (max 2 MB).`);
        continue;
      }
      if (via === 'sms' && total + f.size > MAX_MMS_TOTAL_BYTES) {
        toast.error(`${f.name}: attachments on a text can be 5 MB in total at most.`);
        continue;
      }
      total += f.size;
      valid.push(f);
    }
    if (valid.length) setAttachments((prev) => [...prev, ...valid]);
    e.target.value = ''; // allow re-picking the same file
  };

  // Switching to SMS keeps the files a text can carry and drops the rest.
  const switchToSms = () => {
    setSubject('');
    const kept: File[] = [];
    let total = 0;
    for (const f of attachments) {
      if (MMS_TYPES.includes(f.type) && total + f.size <= MAX_MMS_TOTAL_BYTES) {
        kept.push(f);
        total += f.size;
      }
    }
    if (kept.length < attachments.length) {
      toast.message(`${attachments.length - kept.length} attachment(s) removed — texts carry JPG, PNG, GIF or PDF, 5 MB in total.`);
    }
    setAttachments(kept);
  };

  // Chat carries up to 3 photos/PDFs (JPG, PNG, GIF, WebP, PDF); keep those, drop the rest.
  const switchToChat = () => {
    setSubject('');
    const kept = attachments.filter((f) => CHAT_TYPES.includes(f.type)).slice(0, CHAT_MAX_FILES);
    if (kept.length < attachments.length) {
      toast.message(`${attachments.length - kept.length} attachment(s) removed — website chat carries up to 3 photos or PDFs.`);
    }
    setAttachments(kept);
  };

  // The visitor left (or the API answered visitor_offline): keep the draft, move to text (or email).
  // Also blocks the auto-engage effect below from picking chat again on its own — the rep chooses
  // the channel from here (Website chat stays available, just not auto-selected).
  const leaveChat = () => {
    autoChatBlockedRef.current = true;
    if (leadHasPhone) switchToSms();
    setVia(leadHasPhone ? 'sms' : 'email');
    setChatNotice(`${CHAT_OFFLINE_HINT}.`);
  };

  // Website chat follows the visitor (spec 2026-09-29 §3): picked automatically when they arrive on
  // the site; when they leave, a chat draft moves to text/email with a one-line notice. Only a
  // change of visitorOnline triggers the auto-select, so a rep who picks SMS, Email or Website chat
  // by hand keeps it — autoChatBlockedRef (set by leaveChat and by any manual via pick) stops this
  // effect from re-selecting chat once the rep has taken control, even if the visitor comes back
  // online moments later (e.g. right after a 409 visitor_offline on Send).
  useEffect(() => {
    if (!isWidgetLead) return;
    if (visitorOnline) {
      if (autoChatBlockedRef.current) return;
      if (viaRef.current !== 'chat') switchToChat();
      setVia('chat');
      setChatNotice(null);
    } else if (viaRef.current === 'chat') {
      leaveChat();
    }
  }, [visitorOnline, isWidgetLead]);

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAiAction = async (action: string, noCredit = false) => {
    if (!lead || generatingAction) return;
    if (lead.is_rollup) return; // read-only — AI Suggest is disabled, this is a backstop
    setGeneratingAction(action);
    try {
      const res = await leadsAPI.aiSuggest(lead.id, action, noCredit);
      if (res.success && res.data?.message) {
        setMessage(res.data.message);
        setLastAiAction(action); // enables the Retry button
        if (typeof res.data.credits_remaining === 'number') setAiCredits(res.data.credits_remaining);
        recheckMemoryLimit();
        setShowAiSuggest(false);
      } else {
        const msg = ((res as any).message || res.error || '').toString();
        if (/out of credits/i.test(msg)) {
          setAiCredits(0); // surfaces the orange "Buy" banner
          toast.error('Out of credits');
        } else {
          toast.error(msg || 'Failed to generate suggestion.');
        }
      }
    } catch {
      toast.error('Failed to generate suggestion.');
    } finally {
      setGeneratingAction(null);
    }
  };

  const handleCommentReplySubmit = async (comment: { id: number; image_id: number }) => {
    if (isSendingReply) return; // handler-level guard against double-send races
    if (!replyText.trim()) return;
    if (lead?.is_rollup) return; // read-only — reply UI is hidden, this is a backstop
    setIsSendingReply(true);
    try {
      // NOTE: replyToComment has no server-side idempotency support (non-lead
      // endpoint) — this is a client-side double-send guard only, no key.
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

  // Website-widget forms can hide the Name field, so fall back to how the lead can be reached.
  const leadName = lead.user?.name || lead.user?.email || lead.user?.phone_number || 'Guest';
  const firstName = leadName.split(' ')[0];
  const daysAsLead = getDaysAsLead(lead.first_seen_at);
  const unreadCount = lead.unread_count ?? 0;

  const rowHl = (key: string) =>
    highlightedKey === key
      ? 'rounded-xl ring-2 ring-[#6C60FF] bg-purple-50 transition-all duration-500 -mx-2 px-2'
      : '';

  const renderMessage = (msg: LeadMessage, isChild = false): React.ReactNode => {
    const isOutbound = msg.direction === 'outbound';
    const channelLabel = messageChannelLabel(msg.channel);
    const isReplying = replyingToMsgId === msg.id;
    const children = messages
      .filter((m) => m.parent_message_id === msg.id)
      .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

    const handleReplySubmit = async () => {
      if (isSendingReply) return; // handler-level guard against double-send races
      if (!replyText.trim()) return;
      if (lead?.is_rollup) return; // read-only — reply UI is hidden, this is a backstop
      setIsSendingReply(true);
      try {
        // A website-chat message is answered in the chat while the visitor is on the site (spec
        // 2026-09-29 decision 2). Otherwise: email replies thread onto the parent email; SMS and
        // website-widget messages have no email thread to reply into, so answer them by SMS. A widget
        // lead may have left only an email (the widget's form fields are configurable), in which case
        // the reply goes by email.
        const byChat = msg.channel === 'widget' && visitorOnline;
        const channelKind = byChat
          ? 'chat'
          : msg.channel === 'sms' || (msg.channel === 'widget' && leadHasPhone)
            ? 'sms'
            : msg.channel === 'widget'
              ? 'email'
              : 'threadReply';
        // Its own key per channel kind (see replyIdemKeysRef above) — a retry that falls through
        // to a different channel (e.g. chat → sms once the visitor left) never reuses a key an
        // earlier channel already claimed on the server.
        const key = getReplyIdemKey(channelKind);
        const res = byChat
          ? await leadsAPI.sendChat(lead!.id, replyText.trim(), key)
          : channelKind === 'sms'
            ? await leadsAPI.sendSMS(lead!.id, replyText.trim(), key)
            : channelKind === 'email'
              ? await leadsAPI.sendEmail(lead!.id, 'Re: Your message', replyText.trim(), undefined, key)
              : await leadsAPI.replyToMessage(lead!.id, msg.id, replyText.trim(), key);
        if (res.success) {
          delete replyIdemKeysRef.current[channelKind]; // confirmed success → fresh key next time
          setReplyingToMsgId(null);
          setReplyText('');
          toast.success('Reply sent.');
          await refreshAll();
        } else if (byChat && (res as any)?.code === 'visitor_offline') {
          // Nothing went out; the reply stays in the box and goes by text/email on the next Send.
          setVisitorOnline(false);
          toast.message(`${CHAT_OFFLINE_HINT}.`);
        } else {
          toast.error((res as any)?.message || 'Failed to send reply.');
          // failure → key intentionally kept for retry
        }
      } catch {
        toast.error('Failed to send reply.');
        // unknown outcome → key intentionally kept for retry
      } finally {
        setIsSendingReply(false);
      }
    };

    if (isOutbound) {
      return (
        <div
          key={`msg-${msg.id}`}
          ref={(el) => { rowRefs.current[`message-${msg.id}`] = el; }}
          className={`${isChild ? 'ml-4 mt-3' : 'py-3'} ${rowHl(`message-${msg.id}`)}`}
        >
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm text-gray-600">{formatShortDate(msg.sent_at)}</span>
              <span className="text-sm text-gray-600">· via {channelLabel}</span>
              {msg.is_ai ? (
                // The website widget's after-hours AI (spec 2026-09-29 part 2 §4.4): its replies and its
                // after-hours notices carry the badge. A rep's reply takes over from it.
                <>
                  <span className="text-base font-semibold text-gray-900">AI assistant</span>
                  <span data-ai-badge className="inline-flex items-center rounded-md bg-[#6C60FF]/10 px-1.5 py-0.5 text-xs font-bold tracking-wide text-[#4a40d4]">
                    AI
                  </span>
                  <span className="h-8 w-8 rounded-full bg-[#6C60FF]/10 text-[#6C60FF] flex items-center justify-center" aria-hidden="true">
                    <Sparkles className="w-4 h-4" />
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base font-semibold text-gray-900">You</span>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} alt={user?.name || 'You'} />
                    <AvatarFallback className="bg-[#6C60FF] text-white text-sm font-bold">
                      {getInitials(user?.name || 'You')}
                    </AvatarFallback>
                  </Avatar>
                </>
              )}
            </div>
            {msg.subject && msg.subject !== 'Following up' && (
              <p className="text-sm font-semibold text-[#6C60FF] mb-1">{msg.subject}</p>
            )}
            {msg.body && (
              <div className="max-w-[560px] bg-[#6C60FF] text-white rounded-2xl rounded-tr-sm px-5 py-3">
                <p className="text-base leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]"><LinkifiedText text={msg.body} linkClassName="text-white" /></p>
              </div>
            )}
            {msg.attachments && msg.attachments.length > 0 && (
              <MessageAttachments attachments={msg.attachments} align="right" />
            )}
          </div>
          {children.map((child) => renderMessage(child, true))}
        </div>
      );
    }

    return (
      <div
        key={`msg-${msg.id}`}
        ref={(el) => { rowRefs.current[`message-${msg.id}`] = el; }}
        className={`${isChild ? 'ml-14 mt-3' : 'py-3'} ${rowHl(`message-${msg.id}`)}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar with channel badge */}
          <div className="relative shrink-0 mt-0.5">
            <Avatar className="h-10 w-10">
              <AvatarImage src={lead.user?.profile_image} alt={leadName} />
              <AvatarFallback className="bg-[#6C60FF] text-white text-sm font-semibold">
                {getInitials(leadName)}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0">
            {/* Name · channel  +  date */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold text-gray-900">
                {firstName}
                <span className="text-sm font-normal text-gray-600"> via {channelLabel}</span>
              </span>
              <span className="text-sm text-gray-600 shrink-0">{formatShortDate(msg.sent_at)}</span>
            </div>

            {/* Subject above bubble */}
            {msg.subject && msg.subject !== 'Following up' && (
              <p className="text-base font-semibold text-gray-900 mt-1">{msg.subject}</p>
            )}
            {/* Bubble */}
            {msg.body && (
              <div className="w-fit max-w-[560px] bg-gray-100 rounded-2xl rounded-tl-sm px-5 py-3 mt-1">
                <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">{msg.body}</p>
              </div>
            )}
            {msg.attachments && msg.attachments.length > 0 && (
              <MessageAttachments attachments={msg.attachments} />
            )}

            {/* Reply button */}
            {!isReplying && !isArchived && !lead.is_rollup && (
              <button
                onClick={() => {
                  setReplyingToMsgId(msg.id);
                  setReplyingToCommentId(null);
                  setReplyText('');
                  setTimeout(() => replyInputRef.current?.focus(), 50);
                }}
                className="mt-2 text-sm text-[#6C60FF] hover:underline font-medium"
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
                  className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent px-3 pt-2.5 pb-1 leading-relaxed focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6C60FF]"
                />
                <div className="flex items-center justify-end gap-2 px-3 pb-2">
                  <button
                    onClick={() => { setReplyingToMsgId(null); setReplyText(''); }}
                    className="text-sm text-gray-600 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReplySubmit}
                    disabled={!replyText.trim() || isSendingReply}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-40 transition-colors"
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
    <div ref={panelRef} {...dialogProps} className="h-full flex flex-col overflow-hidden bg-white">
      {/* Header bar — breadcrumb, AI Suggest, Call, close (Chris design) */}
      <div className="shrink-0 flex items-center justify-between gap-3 h-[72px] px-4 sm:px-6 xl:px-8 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2.5 min-w-0 text-base">
          <button
            onClick={onClose}
            aria-label="Back to Leads"
            className="flex items-center gap-1 shrink-0 text-gray-600 hover:text-gray-900 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Leads</span>
          </button>
          <span className="hidden sm:inline text-gray-400" aria-hidden="true">/</span>
          <h2 id="lead-drawer-title" className="text-lg font-semibold text-gray-900 truncate">{leadName}</h2>
          {!lead.user?.id && (
            <span className="flex items-center gap-1 px-2.5 h-7 rounded-md bg-blue-50 text-blue-500 border border-blue-200 text-sm font-medium shrink-0">
              <UserRound className="w-3.5 h-3.5" /> Guest
            </span>
          )}
          {isWidgetLead && visitorOnline && (
            <span className="flex items-center gap-1.5 px-2.5 h-7 rounded-md bg-green-50 text-green-700 border border-green-200 text-sm font-medium shrink-0">
              <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
              On your website now
            </span>
          )}
          {currentStatus && <span className="hidden sm:inline-flex"><StatusChip status={currentStatus} /></span>}
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[26px] h-6 px-2 rounded-lg bg-red-500 text-white text-sm font-bold shrink-0">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => { if (!lead.is_rollup) setShowAiSuggest((v) => !v); }}
              disabled={lead.is_rollup}
              title={lead.is_rollup ? 'View only — managed by the property owner' : undefined}
              className={`flex items-center justify-center gap-2 h-11 px-3 sm:px-4 rounded-lg whitespace-nowrap transition-opacity ${lead.is_rollup ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-90'}`}
              style={{
                border: '1.5px solid transparent',
                backgroundImage: 'linear-gradient(white, white), linear-gradient(to right, #6C60FF, #FF5FAD)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <Sparkles className="w-5 h-5 shrink-0 text-[#6C60FF]" />
              <span className="hidden sm:inline bg-gradient-to-r from-[#6C60FF] to-[#FF5FAD] bg-clip-text text-transparent text-base font-medium">AI Suggest</span>
            </button>

            {/* AI Suggest panel */}
            {showAiSuggest && !lead.is_rollup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAiSuggest(false)} />
                <div className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] z-50 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[70vh]">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100">
                          <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-[#6C60FF] to-[#FF5FAD]">
                            <Sparkles className="w-5 h-5 text-white" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900">AI Suggest</p>
                            <p className="text-xs text-gray-600 truncate">Smart tools for {firstName}</p>
                          </div>
                          {aiCredits > 0 && (
                            <span className="flex items-center gap-1 px-2 h-6 rounded-full bg-purple-100 text-[#6C60FF] text-[12px] font-semibold shrink-0">
                              <Sparkles className="w-3 h-3" /> 1 credit
                            </span>
                          )}
                        </div>

                        <div className="overflow-y-auto">
                          {/* Credits banner — only when the user is out of credits */}
                          {aiCredits === 0 && (
                            <div className="mx-4 my-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 flex items-center gap-2.5">
                              <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900">0 credits</p>
                                <p className="text-[12px] text-gray-600">1 credit per suggestion</p>
                              </div>
                              <button
                                onClick={() => {
                                  sessionStorage.setItem('openPurchaseCreditsModal', 'true');
                                  onNavigate?.('billing');
                                }}
                                className="h-7 px-3 rounded-lg border border-orange-300 text-orange-600 text-xs font-semibold hover:bg-orange-100 transition-colors shrink-0"
                              >
                                Buy
                              </button>
                            </div>
                          )}

                          {/* Suggested Actions */}
                          <div className="px-4 pb-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Lightbulb className="w-3.5 h-3.5 text-[#6C60FF]" />
                              <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wider">Suggested Actions</p>
                            </div>
                            <div className="space-y-2">
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
                                      <p className="text-xs text-gray-600">{isGenerating ? 'Generating…' : a.desc}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
                          <p className="text-[12px] text-gray-600">AI suggestions based on engagement history</p>
                        </div>
                </div>
              </>
            )}
          </div>

          {(lead.user?.phone_number || lead.user?.phone) && (
            <button
              onClick={() => { const p = lead.user?.phone_number || lead.user?.phone; if (p) window.open(`tel:${p}`); }}
              aria-label="Call"
              className="flex items-center justify-center gap-2 h-11 px-3 sm:px-4 rounded-lg border border-gray-200 text-base text-gray-900 font-medium hover:bg-gray-50 transition-colors"
            >
              <Phone className="w-5 h-5 text-gray-900" />
              <span className="hidden sm:inline">Call</span>
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Body: thread column + details column */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="order-2 lg:order-1 flex-1 min-h-0 min-w-0 flex flex-col bg-gray-50">
          {/* Correspondence header — stays put; only the messages below scroll */}
          <div className="shrink-0 px-4 sm:px-6 xl:px-8 pt-4 pb-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-lg font-bold text-gray-900">
                Correspondence
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowSearch((v) => !v);
                    setChatSearch('');
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  aria-label="Search messages"
                  className={`h-10 w-10 flex items-center justify-center rounded-md border transition-colors ${showSearch ? 'border-[#6C60FF] text-[#6C60FF] bg-purple-50' : 'border-gray-200 text-gray-400 hover:text-[#6C60FF] hover:border-[#6C60FF]'}`}
                >
                  <Search className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fetchMessages(lead.id)}
                  disabled={isLoadingMessages}
                  aria-label="Refresh messages"
                  title="Refresh"
                  className="h-10 w-10 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-[#6C60FF] hover:border-[#6C60FF] disabled:opacity-40 transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoadingMessages ? 'animate-spin' : ''}`} />
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
                  className="w-full h-11 pl-10 pr-3 text-base border border-gray-200 rounded-lg bg-white outline-none focus:border-[#6C60FF] transition-colors placeholder:text-gray-400"
                />
                {chatSearch && (
                  <button onClick={() => setChatSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scrollable thread — key resets scroll on each new lead */}
          <div key={lead.id} ref={scrollBodyRef} onScroll={handleThreadScroll} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 xl:px-8 pb-2">

            {isLoadingMessages ? (
              <p className="text-sm text-gray-600 text-center py-10">Loading messages...</p>
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

                  {/* Campaign viewed — always first (a website lead never viewed a campaign) */}
                  {lead.source !== 'widget' && (
                    <div className="flex items-center gap-2 py-2.5">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-600 flex-1">
                        {firstName} viewed <span className="font-medium text-gray-600">"{lead.story?.title ?? 'a campaign'}"</span>
                      </span>
                      <span className="text-sm text-gray-600 shrink-0">{formatShortDate(lead.first_seen_at)}</span>
                    </div>
                  )}

                  {topLevel.map((item) => {
                      if (item._type === 'comment') {
                        const c = item.data;
                        const childComments = comments.filter((ch) => ch.parent_id === c.id);
                        return (
                          <div
                            key={`comment-${c.id}`}
                            ref={(el) => { rowRefs.current[`comment-${c.id}`] = el; }}
                            className={`py-3 ${rowHl(`comment-${c.id}`)}`}
                          >
                            {/* Parent comment row */}
                            <div className="flex items-start gap-3">
                              <div className="relative shrink-0 mt-0.5">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={c.user?.profile_image} alt={c.user?.name} />
                                  <AvatarFallback className="bg-[#6C60FF] text-white text-sm font-semibold">
                                    {getInitials(c.user?.name || firstName)}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-base font-semibold text-gray-900">
                                    {c.user?.name || firstName}
                                    <span className="font-normal text-gray-600"> · Comment</span>
                                  </span>
                                  <span className="text-sm text-gray-600 shrink-0">{formatShortDate(c.created_at)}</span>
                                </div>
                                <div className="w-fit max-w-[560px] bg-gray-100 rounded-2xl rounded-tl-sm px-5 py-3 mt-1">
                                  <p className="text-base text-gray-700 leading-relaxed [overflow-wrap:anywhere]">{c.description}</p>
                                </div>

                                {/* Reply button */}
                                {replyingToCommentId !== c.id && !isArchived && !lead.is_rollup && (
                                  <button
                                    onClick={() => {
                                      setReplyingToCommentId(c.id);
                                      setReplyingToMsgId(null);
                                      setReplyText('');
                                      setTimeout(() => replyInputRef.current?.focus(), 50);
                                    }}
                                    className="mt-1.5 text-sm text-[#6C60FF] hover:underline font-medium"
                                  >
                                    Reply
                                  </button>
                                )}

                                {/* Inline reply box */}
                                {replyingToCommentId === c.id && (
                                  <div className="mt-2 flex items-start gap-2">
                                    <Avatar className="h-9 w-9 shrink-0 mt-1">
                                      <AvatarImage src={user?.avatar} alt={user?.name || 'You'} />
                                      <AvatarFallback className="bg-[#6C60FF] text-white text-sm font-bold">
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
                                        className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent px-3 pt-2.5 pb-1 leading-relaxed focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6C60FF]"
                                      />
                                      <div className="flex items-center justify-end gap-2 px-3 pb-2">
                                        <button
                                          onClick={() => { setReplyingToCommentId(null); setReplyText(''); }}
                                          className="text-sm text-gray-600 hover:text-gray-700"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleCommentReplySubmit(c)}
                                          disabled={!replyText.trim() || isSendingReply}
                                          className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-40 transition-colors"
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
                              const isMyReply = child.user?.id !== lead.user?.id;
                              return (
                              <div key={`comment-${child.id}`} className="ml-14 mt-3 flex items-start gap-2.5">
                                <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                                  <AvatarImage src={child.user?.profile_image} alt={child.user?.name} />
                                  <AvatarFallback className="bg-[#6C60FF] text-white text-sm font-semibold">
                                    {getInitials(child.user?.name || firstName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-base font-semibold text-gray-800">
                                      {child.user?.name || firstName}
                                      <span className="font-normal text-gray-600"> · Reply</span>
                                    </span>
                                    <span className="text-sm text-gray-600 shrink-0">{formatShortDate(child.created_at)}</span>
                                  </div>
                                  <div className={`inline-block rounded-2xl rounded-tl-sm px-4 py-2.5 mt-1 max-w-[90%] ${isMyReply ? 'bg-[#6C60FF]' : 'bg-gray-100'}`}>
                                    <p className={`text-base leading-relaxed [overflow-wrap:anywhere] ${isMyReply ? 'text-white' : 'text-gray-700'}`}>{child.description}</p>
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

        {/* Compose box — pinned to bottom. Precedence when more than one applies:
            rollup (backend also 403s writes for it) > archived (reversible by
            the user) > no-contact (nothing to fix from this drawer) — each
            state fully replaces the composer with a single note. */}
        {lead.is_rollup ? (
          // Read-only for this user. An unclaimed lead can be accepted right here;
          // one owned by a teammate just says so (spec 2026-09-23).
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-center gap-3 text-sm text-gray-700">
            {lead.assignee ? (
              <span>This lead is assigned to {lead.assignee.name ?? 'a teammate'}.</span>
            ) : (
              <>
                <span>Nobody has this lead yet.</span>
                <AssigneeControl lead={lead} onChanged={() => { onRefreshLead?.(); }} />
              </>
            )}
          </div>
        ) : isArchived ? (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-center text-sm text-gray-600">
            This lead is archived. Unarchive to send messages.
          </div>
        ) : !hasAnyContact && (
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-center text-sm text-gray-600">
            No contact info on file for this lead.
          </div>
        )}
        <div className={`px-4 sm:px-6 xl:px-8 pt-4 pb-5 bg-white border-t border-gray-200 ${(isArchived || lead.is_rollup || !hasAnyContact) ? 'hidden' : ''}`}>
          <div className="border border-gray-200 rounded-2xl bg-white px-5 pt-4 pb-4 shadow-sm">
            <textarea
              ref={composeInputRef}
              value={message}
              onChange={(e) => { setMessage(e.target.value); if (e.target.value === '') setLastAiAction(null); }}
              onKeyDown={handleKeyDown}
              placeholder={`Type a message to ${firstName}...`}
              rows={3}
              maxLength={via === 'sms' ? SMS_MAX_BODY : via === 'chat' ? CHAT_MAX_BODY : undefined}
              className="w-full max-sm:h-16 text-base text-gray-700 placeholder:text-gray-400 resize-none rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 leading-relaxed outline-none transition-colors focus:bg-white focus:border-[#6C60FF]/60 focus:ring-4 focus:ring-[#6C60FF]/15"
            />

            {/* SMS character counter — only when via === 'sms' */}
            {via === 'sms' && (() => {
              const info = smsSegmentInfo(message);
              const isOverLimit = info.chars > SMS_MAX_BODY;
              const isAmber = info.segments > 3;
              const textColor = isOverLimit ? 'text-red-500' : isAmber ? 'text-amber-500' : 'text-gray-600';
              const segmentLabel = info.segments === 1 ? 'SMS segment' : 'SMS segments';
              return (
                <p className={`text-sm ${textColor} mt-1.5`}>
                  {info.chars}/{SMS_MAX_BODY} · {attachments.length > 0 ? 'Picture message (MMS)' : `~${info.segments} ${segmentLabel}`}
                </p>
              );
            })()}

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1.5 max-w-[240px] bg-gray-100 rounded-lg px-2.5 py-1.5 text-sm text-gray-600"
                  >
                    <Paperclip className="w-3 h-3 shrink-0 text-gray-400" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-gray-600 shrink-0">{Math.ceil(f.size / 1024)} KB</span>
                    <button
                      onClick={() => removeAttachment(i)}
                      className="text-gray-400 hover:text-gray-600 shrink-0"
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* After the visitor left the site: the chat draft moved to text/email (spec 2026-09-29 §3). */}
            {chatNotice && via !== 'chat' && (
              <p className="text-sm text-amber-700 mt-1.5" role="status">{chatNotice}</p>
            )}

            {/* Hidden file input — images & PDF, ≤2 MB each (texts: JPG/PNG/GIF/PDF; chat: + WebP, 3 files) */}
            <input
              ref={fileInputRef}
              type="file"
              accept={via === 'sms' ? MMS_TYPES.join(',') : via === 'chat' ? CHAT_TYPES.join(',') : 'image/*,application/pdf'}
              multiple
              hidden
              onChange={handleFilesSelected}
            />

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                title={via === 'sms' ? 'Attach photo (JPG, PNG, GIF) or PDF — 5 MB in total' : via === 'chat' ? 'Attach up to 3 photos or PDFs (max 2 MB each)' : 'Attach image or PDF (max 2 MB)'}
                aria-label="Attach file"
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* "＋ Campaign" pill (Chris's design) — opens the car picker directly, no
                  intermediate menu. Same action the mobile app's "+" reaches on SMS threads. */}
              <button
                onClick={() => setShowShareCars(true)}
                title="Share a campaign"
                aria-label="Share a campaign"
                className="flex items-center gap-1.5 h-10 px-4 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#5A4FE5] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Campaign
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  className={`p-1.5 transition-colors ${showEmojiPicker ? 'text-[#6C60FF]' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Insert emoji"
                  aria-label="Insert emoji"
                >
                  <Smile className="w-5 h-5" />
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

              <div className="relative">
                <button
                  onClick={() => setShowViaDropdown((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-2 transition-colors"
                >
                  via {VIA_LABELS[via]}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showViaDropdown && (
                  <div className={`absolute bottom-10 left-0 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10 ${isWidgetLead ? 'w-64' : 'w-28'}`}>
                    {((isWidgetLead ? ['chat', 'sms', 'email'] : ['email', 'sms']) as Via[]).map((option) => {
                      const isDisabled = option === 'chat'
                        ? !visitorOnline
                        : option === 'email'
                          ? !lead?.user?.email
                          : !(lead?.user?.phone_number || lead?.user?.phone);
                      return (
                        <button
                          key={option}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            // A manual pick — including Website chat — puts the rep in control:
                            // stop auto-selecting chat on its own from here (see autoChatBlockedRef).
                            autoChatBlockedRef.current = true;
                            if (option === 'sms' && via !== 'sms') switchToSms();
                            if (option === 'chat' && via !== 'chat') switchToChat();
                            setVia(option);
                            setChatNotice(null);
                            setShowViaDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm ${isDisabled ? `cursor-not-allowed text-gray-400 ${option === 'chat' ? '' : 'opacity-40'}` : via === option ? 'text-[#6C60FF] font-medium hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {VIA_LABELS[option]}
                          {option === 'chat' && isDisabled && (
                            <span className="block text-xs text-gray-500 mt-0.5">{CHAT_OFFLINE_HINT}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Retry — regenerates the AI message without spending a credit */}
              {lastAiAction && (
                <button
                  onClick={() => handleAiAction(lastAiAction, true)}
                  disabled={generatingAction !== null}
                  title="Regenerate (free)"
                  className="ml-auto flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#6C60FF] text-[#6C60FF] bg-purple-50 hover:bg-purple-100 text-sm font-medium disabled:opacity-50 transition-colors"
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
                disabled={!canSend || isSending}
                className={`${lastAiAction ? '' : 'ml-auto'} flex items-center gap-2 h-10 px-5 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-base font-medium disabled:opacity-50 transition-colors`}
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
        </div>

        <aside className="order-1 lg:order-2 shrink-0 lg:w-[280px] xl:w-[380px] max-h-[26vh] lg:max-h-none overflow-y-auto border-b lg:border-b-0 lg:border-l border-gray-200">
          <LeadDetailsSidebar
            lead={lead}
            leadName={leadName}
            initials={getInitials(leadName)}
            lastEngaged={getTimeAgo(lead.last_engaged_at)}
            daysAsLead={daysAsLead}
            currentStatus={currentStatus}
            isUpdatingStatus={isUpdatingStatus}
            onStatusChange={handleStatusChange}
            onAssigneeChanged={() => { onRefreshLead?.(); }}
            isArchived={isArchived}
            onNotesSaved={() => { onRefreshLead?.(); }}
          />
        </aside>
      </div>

        <ShareCarsDialog
          open={showShareCars}
          onClose={() => setShowShareCars(false)}
          leadId={lead.id}
          leadName={leadName}
          onShared={() => { refreshAll(); }}
        />
    </div>
  );
}
