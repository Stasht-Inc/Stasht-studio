import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Mail, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Conversation, ConversationMessage, leadsAPI } from '../services/leadsAPI';
import { useDialogBehavior } from '../hooks/useDialogBehavior';
import { toast } from 'sonner';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatShortDate(s: string): string {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function channelLabel(ch: string): string {
  const c = (ch || '').toLowerCase();
  if (c === 'sms') return 'SMS';
  if (c === 'app') return 'In-app';
  if (c === 'email') return 'Email';
  return ch ? ch.charAt(0).toUpperCase() + ch.slice(1) : '';
}

interface Props {
  conversation: Conversation | null;
  open: boolean;
  onClose: () => void;
}

export default function ConversationDrawer({ conversation, open, onClose }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const threadBottomRef = useRef<HTMLDivElement>(null);
  const fetchedIdRef = useRef<number | null>(null);

  // UsersPage only mounts this drawer while the right-hand panel is open
  // (see pages/UsersPage.tsx ~:2745), so `open` is always true here — the
  // hook's open/close transition is this component's own mount/unmount.
  const { panelRef, dialogProps } = useDialogBehavior({
    open: true,
    onClose,
    labelledBy: 'conversation-drawer-title',
  });

  useEffect(() => {
    if (open && conversation) {
      setReply('');
      if (fetchedIdRef.current !== conversation.lead_id) {
        fetchedIdRef.current = conversation.lead_id;
        setMessages([]);
        fetchMessages(conversation.lead_id);
      }
    } else {
      fetchedIdRef.current = null;
      setMessages([]);
      setReply('');
    }
  }, [open, conversation]);

  useEffect(() => {
    if (messages.length > 0) threadBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async (leadId: number, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await leadsAPI.getConversationMessages(leadId);
      if (res.success && res.data) {
        const data = res.data as { messages: ConversationMessage[] } | ConversationMessage[];
        setMessages(Array.isArray(data) ? data : (data.messages ?? []));
      }
      // The GET auto-marks owner messages read — refresh the list badges.
      window.dispatchEvent(new CustomEvent('my-conversations-refresh'));
    } catch {
      // silently ignore
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (isSending) return; // handler-level guard against double-send races
    const body = reply.trim();
    if (!conversation || !body) return;
    setIsSending(true);
    try {
      // NOTE: replyToConversation (/my-conversations/{id}/reply) is served by a
      // different controller than the lead-messaging endpoints and has no
      // server-side idempotency support — this is a client-side guard only.
      const res = await leadsAPI.replyToConversation(conversation.lead_id, body);
      if (res.success) {
        setReply('');
        await fetchMessages(conversation.lead_id, true);
      } else {
        toast.error('Failed to send reply.');
      }
    } catch {
      toast.error('Failed to send reply.');
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

  if (!conversation) return null;
  const owner = conversation.owner;
  const sorted = [...messages].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());

  return (
    <div ref={panelRef} {...dialogProps} className="h-full flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={owner.profile_image} alt={owner.name} />
            <AvatarFallback className="bg-[#6C60FF] text-white text-sm font-semibold">{getInitials(owner.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="conversation-drawer-title" className="text-base font-bold text-gray-900 leading-tight truncate">{owner.name}</h2>
                <p className="text-xs text-gray-600 mt-1 truncate">Re: {conversation.story.title}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <p className="text-sm text-gray-600 text-center py-10">Loading messages...</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-10">No messages yet.</p>
        ) : (
          sorted.map((m, idx) => {
            const isEmail = (m.channel || '').toLowerCase() === 'email';
            if (m.from_me) {
              return (
                <div key={m.id ?? idx} className="py-2 flex flex-col items-end">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs text-gray-600">{formatShortDate(m.sent_at)}</span>
                    <span className="text-xs font-semibold text-gray-700">You</span>
                  </div>
                  <div className="max-w-[82%] bg-[#6C60FF] text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <span className="text-[12px] text-gray-600 mt-1">via {channelLabel(m.channel)}</span>
                </div>
              );
            }
            return (
              <div key={m.id ?? idx} className="py-2">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={owner.profile_image} alt={owner.name} />
                      <AvatarFallback className="bg-[#6C60FF] text-white text-xs font-semibold">{getInitials(owner.name)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-[18px] w-[18px] rounded-full flex items-center justify-center border-2 border-white bg-[#6C60FF]">
                      {isEmail ? <Mail className="w-2.5 h-2.5 text-white" /> : <MessageSquare className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-800">
                        {owner.name}
                        <span className="font-normal text-gray-600"> · {channelLabel(m.channel)}</span>
                      </span>
                      <span className="text-xs text-gray-600 shrink-0">{formatShortDate(m.sent_at)}</span>
                    </div>
                    <div className="w-fit max-w-[90%] bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2.5 mt-1">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={threadBottomRef} />
      </div>

      {/* Reply box */}
      <div className="border-t border-gray-200 px-4 pt-3 pb-4 bg-white">
        <div className="border border-gray-200 rounded-2xl bg-white px-4 pt-3 pb-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Reply to ${owner.name.split(' ')[0]}...`}
            rows={3}
            className="w-full text-sm text-gray-700 placeholder:text-gray-400 resize-none border-none outline-none bg-transparent leading-relaxed focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-1"
          />
          <div className="flex items-center justify-end mt-2">
            <button
              onClick={handleSend}
              disabled={!reply.trim() || isSending}
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-medium disabled:opacity-50 transition-colors"
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
