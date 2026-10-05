import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { alvinAPI, type AlvinMessage } from '../../services/alvinAPI';
import AlvinMessageText from './AlvinMessageText';

// Alvin AI chat panel — Figma "Alvin AI help" › AlvinAIPanel (node 14397:15290), 380 × 779.
// The user bubble, typing dots and error notes are not in the Figma frame; they follow Chris's
// prototype (stasht-studio-2025.figma.site) in the same palette.

const GRADIENT = 'linear-gradient(160deg, #ff60e0 15.959%, #6c60ff 57.472%)';
const SEND_GRADIENT = 'linear-gradient(135deg, #ff60e0 0%, #6c60ff 100%)';
const GREETING = "Hi! I'm Alvin, your AI assistant. Ask me anything about your campaigns, users, or content — I'm here to help.";
const MESSAGE_MAX = 2000;
const DEFAULT_SUGGESTIONS = [
  'How do I create a new campaign?',
  'How do I invite a team member?',
  'How do I set up a property?',
  'How do I embed the contact widget?',
];

// A note from Alvin that only lives in this browser (network errors, the daily limit).
type ChatItem = AlvinMessage & { local?: boolean; pending?: boolean };

// "08:50 AM", as in the design.
function timeLabel(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function AlvinAvatar({ size }: { size: 28 | 36 }) {
  const big = size === 36;
  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${big ? 'size-[36px]' : 'size-[28px]'}`}
      style={{ backgroundImage: GRADIENT }}
      data-name="AlvinAvatar"
    >
      <img
        src={big ? '/alvin/alvin-logo.svg' : '/alvin/alvin-logo-small.svg'}
        alt=""
        width={big ? 24 : 20}
        height={big ? 20 : 17}
        className={big ? 'block w-6 h-5' : 'block w-5 h-[17px]'}
      />
    </div>
  );
}

function UserAvatar({ user }: { user?: any }) {
  const initial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase() || 'U';
  if (user?.profile_image) {
    return <img src={user.profile_image} alt="" className="size-[28px] rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="size-[28px] rounded-full shrink-0 flex items-center justify-center bg-[#6c60ff] text-white text-[11px] font-semibold">
      {initial}
    </div>
  );
}

function AlvinBubble({ children, time }: { children: React.ReactNode; time?: string }) {
  return (
    <div className="flex gap-[10.5px] items-start w-full">
      <AlvinAvatar size={28} />
      <div className="flex flex-col items-start min-w-0 flex-1">
        <div className="bg-[#f4f3ff] px-[14px] py-[10.5px] rounded-[14px] rounded-tl-[4.75px] max-w-[275px] text-[#1e2939] text-[12.25px] leading-[19.906px] tracking-[-0.018px] break-words">
          {children}
        </div>
        {time !== undefined && (
          <div className="pl-[3.5px] pt-[3.5px] text-[#99a1af] text-[11px] leading-[16.5px] tracking-[0.0645px]">{time}</div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ text, time, user }: { text: string; time: string; user?: any }) {
  return (
    <div className="flex gap-[10.5px] items-start justify-end w-full">
      <div className="flex flex-col items-end min-w-0 flex-1">
        <div className="bg-[#6c60ff] px-[14px] py-[10.5px] rounded-[14px] rounded-tr-[4.75px] max-w-[275px] text-white text-[12.25px] leading-[19.906px] tracking-[-0.018px] whitespace-pre-wrap break-words">
          {text}
        </div>
        <div className="pr-[3.5px] pt-[3.5px] text-[#99a1af] text-[11px] leading-[16.5px] tracking-[0.0645px]">{time}</div>
      </div>
      <UserAvatar user={user} />
    </div>
  );
}

function TypingDots() {
  return (
    <AlvinBubble>
      <span className="flex items-center gap-[4px] h-[19.906px]" role="status" aria-label="Alvin is typing">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-[6px] rounded-full bg-[#a29bff] animate-bounce motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </AlvinBubble>
  );
}

export default function AlvinPanel({
  open,
  onClose,
  currentPage,
  user,
}: {
  open: boolean;
  onClose: () => void;
  currentPage?: string | null;
  user?: any;
}) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [greetingTime, setGreetingTime] = useState(() => timeLabel(null));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load the saved chat the first time the panel opens.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    alvinAPI
      .getConversation()
      .then((conv) => {
        if (cancelled || !conv) return;
        setMessages(conv.messages);
        if (conv.suggestions.length) setSuggestions(conv.suggestions);
        if (conv.messages[0]?.created_at) setGreetingTime(timeLabel(conv.messages[0].created_at));
      })
      .catch(() => {
        // No saved chat to show: start from the greeting and the starter questions.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  // Keep the newest message in view; focus the box when the panel opens.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Esc closes Alvin unless something on top of it (a dialog, a dropdown) already handled the key.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The message box grows with its text, up to about five lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '18px';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [draft]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || sending) return;

      const tempId = `pending-${Date.now()}`;
      const now = new Date().toISOString();
      setMessages((prev) => [...prev, { id: tempId, role: 'user', body: text, meta: {}, created_at: now, pending: true }]);
      setDraft('');
      setSending(true);

      const result = await alvinAPI.send(text, currentPage ?? null);
      const failure = result.ok ? null : result.message;

      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId);
        if (result.ok && result.data) return [...rest, result.data.question, result.data.answer];
        // Not saved on the server: keep the question on screen with Alvin's note under it.
        return [
          ...rest,
          { id: tempId, role: 'user', body: text, meta: {}, created_at: now, local: true },
          { id: `${tempId}-note`, role: 'assistant', body: failure ?? '', meta: { failed: true }, created_at: new Date().toISOString(), local: true },
        ];
      });
      setSending(false);
      inputRef.current?.focus();
    },
    [sending, currentPage],
  );

  const startOver = async () => {
    if (sending) return;
    if (!(await alvinAPI.startOver())) {
      setMessages((prev) => [
        ...prev,
        { id: `reset-${Date.now()}`, role: 'assistant', body: "Sorry, I couldn't start over just now. Please try again.", meta: { failed: true }, created_at: new Date().toISOString(), local: true },
      ]);
      return;
    }
    setMessages([]);
    setGreetingTime(timeLabel(null));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  };

  if (!open) return null;

  const canSend = draft.trim().length > 0 && !sending;
  const showSuggestions = loaded && messages.length === 0 && !sending;

  return (
    <div
      role="dialog"
      aria-label="Alvin AI"
      data-name="AlvinAIPanel"
      className="fixed z-[60] flex flex-col overflow-hidden bg-white border border-[#ede9ff] rounded-[16px] shadow-[0px_8px_40px_0px_rgba(108,96,255,0.18),0px_2px_12px_0px_rgba(0,0,0,0.1)]
        left-2 right-2 top-[72px] bottom-2
        md:left-auto md:right-4 md:top-[64px] md:bottom-auto md:w-[380px] md:h-[min(779px,calc(100vh-80px))]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-[17.5px] py-[14px] border-b border-[#f0f0f5] shrink-0">
        <div className="flex items-center gap-[10.5px]">
          <AlvinAvatar size={36} />
          <div className="flex flex-col">
            <p className="text-[15px] leading-[18.75px] font-semibold tracking-[-0.2344px] text-[#101828]">Alvin AI</p>
            <div className="flex items-center gap-[3.5px] h-[14px]">
              <span className="size-[5px] rounded-full bg-[#00c950]" />
              <span className="text-[10.5px] leading-[14px] font-medium tracking-[0.0923px] text-[#00c950]">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[3.5px]">
          <button
            type="button"
            onClick={startOver}
            disabled={sending}
            title="Start over"
            aria-label="Start over"
            className="p-[7px] rounded-[8.75px] hover:bg-[#f4f3ff] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
          >
            <img src="/alvin/icon-start-over.svg" alt="" width={14} height={14} className="block size-[14px]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close Alvin"
            className="p-[7px] rounded-[8.75px] hover:bg-[#f4f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
          >
            <img src="/alvin/icon-close.svg" alt="" width={14} height={14} className="block size-[14px]" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-[14px] py-[17.5px]" aria-live="polite">
        <div className="flex flex-col gap-[14px]">
          <AlvinBubble time={greetingTime}>{GREETING}</AlvinBubble>
          {messages.map((m) =>
            m.role === 'user' ? (
              <UserBubble key={m.id} text={m.body} time={timeLabel(m.created_at)} user={user} />
            ) : (
              <AlvinBubble key={m.id} time={timeLabel(m.created_at)}>
                <AlvinMessageText text={m.body} />
              </AlvinBubble>
            ),
          )}
          {sending && <TypingDots />}
        </div>
      </div>

      {/* Suggested questions */}
      {showSuggestions && (
        <div className="flex flex-col items-start gap-[6.5px] px-[14px] pb-[12px] shrink-0">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="h-[34px] px-[14px] py-[7px] rounded-full bg-[#faf9ff] border border-[#e0deff] text-[12.25px] leading-[17.5px] font-medium tracking-[-0.018px] text-[#6c60ff] whitespace-nowrap hover:bg-[#f0eeff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[#f0f0f5] p-[14px] shrink-0">
        <div className="flex items-center gap-[7px] px-[10.5px] py-[8.75px] rounded-[14px] bg-[#faf9ff] border-[1.5px] border-[#e0deff] focus-within:border-[#b9b2ff]">
          <button
            type="button"
            disabled
            title="Attaching files is coming soon"
            aria-label="Attach a file (coming soon)"
            className="size-[25px] flex items-center justify-center rounded-[8.75px] border border-[#d4c9ff] shrink-0 cursor-not-allowed"
          >
            <img src="/alvin/icon-attach.svg" alt="" width={14} height={14} className="block size-[14px]" />
          </button>
          <label htmlFor="alvin-message" className="sr-only">Ask Alvin anything</label>
          <textarea
            id="alvin-message"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Alvin anything…"
            className="flex-1 min-w-0 h-[18px] resize-none bg-transparent border-0 p-0 outline-none focus:ring-0 text-[12.25px] leading-[18px] tracking-[-0.018px] text-[#1e2939] placeholder:text-[#99a1af]"
          />
          <button
            type="button"
            onClick={() => send(draft)}
            disabled={!canSend}
            aria-label="Send"
            className={`size-[28px] flex items-center justify-center rounded-[12.75px] shrink-0 transition-opacity ${canSend ? 'opacity-100 hover:opacity-90' : 'opacity-40 cursor-not-allowed'}`}
            style={{ backgroundImage: SEND_GRADIENT }}
          >
            <img src="/alvin/icon-send.svg" alt="" width={12.25} height={12.25} className="block size-[12.25px]" />
          </button>
        </div>
        <p className="pt-[7px] text-center text-[11px] leading-[16.5px] tracking-[0.0645px] text-[#99a1af]">Alvin AI · Powered by Stasht</p>
      </div>
    </div>
  );
}
