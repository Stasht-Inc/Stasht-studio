import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { alvinAPI, type AlvinMessage, type AlvinPageLink, type AlvinSendResult } from '../../services/alvinAPI';
import AlvinMessageText from './AlvinMessageText';
import AlvinActionCard from './AlvinActionCard';
import { refreshAlvinStatus, type AlvinSetupStep } from './useAlvinEnabled';
import { ACCEPT, DropOverlay, PendingFile, SentFile, attachmentInfo, fileProblem, isImageFile, shrinkImage } from './alvinFiles';

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

// "Take me there": opens the Studio page through App's app-navigate event. On phones the panel
// covers the screen, so it closes to show the page.
function PageLinks({ links, onNavigate }: { links: AlvinPageLink[]; onNavigate: () => void }) {
  return (
    <div className="flex flex-wrap gap-[6px] pt-[7px]">
      {links.map((l) => (
        <button
          key={l.page}
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('app-navigate', { detail: l.page }));
            onNavigate();
          }}
          className="inline-flex items-center gap-[5px] h-[30px] px-[12px] rounded-full bg-[#faf9ff] border border-[#e0deff] text-[12px] leading-[17.5px] font-medium tracking-[-0.018px] text-[#6c60ff] hover:bg-[#f0eeff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
        >
          Take me to {l.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      ))}
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

function AlvinBubble({ children, time, after }: { children: React.ReactNode; time?: string; after?: React.ReactNode }) {
  return (
    <div className="flex gap-[10.5px] items-start w-full">
      <AlvinAvatar size={28} />
      <div className="flex flex-col items-start min-w-0 flex-1">
        <div className="bg-[#f4f3ff] px-[14px] py-[10.5px] rounded-[14px] rounded-tl-[4.75px] max-w-[275px] text-[#1e2939] text-[12.25px] leading-[19.906px] tracking-[-0.018px] break-words">
          {children}
        </div>
        {after}
        {time !== undefined && (
          <div className="pl-[3.5px] pt-[3.5px] text-[#99a1af] text-[11px] leading-[16.5px] tracking-[0.0645px]">{time}</div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ message, time, user, previews }: { message: ChatItem; time: string; user?: any; previews?: string[] }) {
  const files = message.meta?.attachments ?? [];
  let image = 0;
  return (
    <div className="flex gap-[10.5px] items-start justify-end w-full">
      <div className="flex flex-col items-end min-w-0 flex-1">
        <div className="flex flex-col gap-[8px] bg-[#6c60ff] px-[14px] py-[10.5px] rounded-[14px] rounded-tr-[4.75px] max-w-[275px] text-white text-[12.25px] leading-[19.906px] tracking-[-0.018px] whitespace-pre-wrap break-words">
          {files.map((f, i) => (
            <SentFile key={i} info={f} preview={f.kind === 'image' ? previews?.[image++] : undefined} />
          ))}
          {message.body !== '' && <span>{message.body}</span>}
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
  ask,
  onAsked,
  setup = [],
}: {
  open: boolean;
  onClose: () => void;
  currentPage?: string | null;
  user?: any;
  // A question to ask as soon as the chat is ready (e.g. a Get Started step); onAsked clears it.
  ask?: string | null;
  onAsked?: () => void;
  // The account's "Getting started" checklist (web API AlvinSetup), shown in an empty chat.
  setup?: AlvinSetupStep[];
}) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [suggestionsByPage, setSuggestionsByPage] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [greetingTime, setGreetingTime] = useState(() => timeLabel(null));
  const [pending, setPending] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  // Image previews for questions sent from this browser (the server doesn't keep the files).
  const [previews, setPreviews] = useState<Record<string, string[]>>({});
  const dragDepth = useRef(0);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  // Free the image previews when the panel goes away.
  useEffect(() => () => Object.values(previewsRef.current).flat().forEach((u) => URL.revokeObjectURL(u)), []);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        if (conv.suggestions_by_page) setSuggestionsByPage(conv.suggestions_by_page);
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

  // A note from Alvin that only lives in this browser.
  const note = (body: string, links?: AlvinPageLink[]) =>
    setMessages((prev) => [
      ...prev,
      { id: `note-${Date.now()}`, role: 'assistant', body, meta: { failed: true, links }, created_at: new Date().toISOString(), local: true },
    ]);

  const send = useCallback(
    async (raw: string, files: File[] = [], fromOutside = false) => {
      const text = raw.trim();
      if ((!text && files.length === 0) || sending) return;
      const problem = files.length ? fileProblem(files) : null;
      if (problem) {
        note(problem);
        return;
      }

      const tempId = `pending-${Date.now()}`;
      const now = new Date().toISOString();
      const meta = files.length ? { attachments: files.map(attachmentInfo) } : {};
      const imageUrls = files.filter(isImageFile).map((f) => URL.createObjectURL(f));
      if (imageUrls.length) setPreviews((prev) => ({ ...prev, [tempId]: imageUrls }));
      setMessages((prev) => [...prev, { id: tempId, role: 'user', body: text, meta, created_at: now, pending: true }]);
      if (!fromOutside) {
        // A question handed over (Ask Alvin) leaves what the person was typing alone.
        setDraft('');
        setPending([]);
      }
      setSending(true);

      const result: AlvinSendResult = files.length
        ? await alvinAPI.sendWithFiles(text, currentPage ?? null, await Promise.all(files.map(shrinkImage)))
        : await alvinAPI.send(text, currentPage ?? null);
      const failure = result.ok ? null : result.message;
      // Not sent: put the files back so they don't have to be attached again.
      if (!result.ok && files.length) setPending(files);

      if (result.ok && result.data && imageUrls.length) {
        const questionId = String(result.data.question.id);
        setPreviews((prev) => ({ ...prev, [questionId]: imageUrls }));
      }
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId);
        if (result.ok && result.data) return [...rest, result.data.question, result.data.answer];
        // Not saved on the server: keep the question on screen with Alvin's note under it.
        const links = result.code === 'no_credits' ? [{ page: 'billing', label: 'Billing & Payment' }] : undefined;
        return [
          ...rest,
          { id: tempId, role: 'user', body: text, meta, created_at: now, local: true },
          { id: `${tempId}-note`, role: 'assistant', body: failure ?? '', meta: { failed: true, links }, created_at: new Date().toISOString(), local: true },
        ];
      });
      setSending(false);
      if (result.ok) refreshAlvinStatus();
      inputRef.current?.focus();
    },
    [sending, currentPage],
  );

  // A question handed over by the Get Started checklist: ask it once the saved chat has loaded
  // (the same question twice within a few seconds, e.g. a double-click, is asked once).
  const lastAsk = useRef<{ text: string; at: number } | null>(null);
  useEffect(() => {
    if (open && loaded && ask && !sending) {
      onAsked?.();
      const recent = lastAsk.current && lastAsk.current.text === ask && Date.now() - lastAsk.current.at < 5000;
      if (!recent) {
        lastAsk.current = { text: ask, at: Date.now() };
        send(ask, [], true);
      }
    }
  }, [open, loaded, ask, sending, send, onAsked]);

  const addFiles = (files: File[]) => {
    const problem = fileProblem(files, pending.length);
    if (problem) {
      note(problem);
      return;
    }
    setPending((prev) => [...prev, ...files]);
    inputRef.current?.focus();
  };

  // Dragging files over the panel shows "Drop to send"; dropping sends them with any typed text.
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    // While Alvin is answering, dropped files wait with the others instead of being lost.
    if (sending) addFiles(dropped);
    else send(draft, [...pending, ...dropped]);
  };

  const startOver = async () => {
    if (sending) return;
    if (!(await alvinAPI.startOver())) {
      setMessages((prev) => [
        ...prev,
        { id: `reset-${Date.now()}`, role: 'assistant', body: "Sorry, I couldn't start over just now. Please try again.", meta: { failed: true }, created_at: new Date().toISOString(), local: true },
      ]);
      return;
    }
    Object.values(previews).flat().forEach((u) => URL.revokeObjectURL(u));
    setPreviews({});
    setMessages([]);
    setPending([]);
    setGreetingTime(timeLabel(null));
    inputRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft, pending);
    }
  };

  if (!open) return null;

  // A confirmation card changed (confirmed, cancelled, details fixed); add Alvin's "done" message.
  const updateCard = (card: AlvinMessage, done?: AlvinMessage) => {
    if (done) refreshAlvinStatus(); // a property/campaign/invite may tick a setup step
    setMessages((prev) => {
      const next = prev.map((m) => (String(m.id) === String(card.id) ? card : m));
      return done && !next.some((m) => String(m.id) === String(done.id)) ? [...next, done] : next;
    });
  };

  const closeOnPhone = () => {
    if (window.matchMedia('(max-width: 767px)').matches) onClose();
  };
  const starterQuestions = (currentPage && suggestionsByPage[currentPage]) || suggestions;
  const canSend = (draft.trim().length > 0 || pending.length > 0) && !sending;
  const showSuggestions = loaded && messages.length === 0 && !sending;

  // Portal to <body>: inside the sticky header (its own stacking layer) the panel would sit under
  // the mobile bottom bar whatever its z-index.
  return createPortal(
    <div
      role="dialog"
      aria-label="Alvin AI"
      data-name="AlvinAIPanel"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="fixed z-[9000] flex flex-col overflow-hidden bg-white
        inset-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        md:inset-auto md:pt-0 md:pb-0 md:right-4 md:top-[64px] md:w-[380px] md:h-[min(779px,calc(100vh-80px))]
        md:border md:border-[#ede9ff] md:rounded-[16px] md:shadow-[0px_8px_40px_0px_rgba(108,96,255,0.18),0px_2px_12px_0px_rgba(0,0,0,0.1)]"
    >
      {dragging && <DropOverlay />}

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
              <UserBubble key={m.id} message={m} time={timeLabel(m.created_at)} user={user} previews={previews[String(m.id)]} />
            ) : (
              <AlvinBubble
                key={m.id}
                time={timeLabel(m.created_at)}
                after={
                  <>
                    {m.meta?.links?.length ? <PageLinks links={m.meta.links} onNavigate={closeOnPhone} /> : null}
                    {m.meta?.action && !m.local ? (
                      <AlvinActionCard
                        message={m}
                        onUpdate={updateCard}
                        onNavigate={(page) => {
                          window.dispatchEvent(new CustomEvent('app-navigate', { detail: page }));
                          closeOnPhone();
                        }}
                      />
                    ) : null}
                  </>
                }
              >
                <AlvinMessageText text={m.body} />
              </AlvinBubble>
            ),
          )}
          {sending && <TypingDots />}
        </div>
      </div>

      {/* Getting started (new accounts): each open step asks Alvin to help with it */}
      {showSuggestions && setup.some((s) => !s.done) && (
        <div className="px-[14px] pb-[12px] shrink-0" data-name="AlvinSetup">
          <div className="rounded-[14px] border border-[#e0deff] bg-[#faf9ff] px-[12px] py-[10px]">
            <div className="flex items-baseline justify-between gap-[8px]">
              <p className="text-[12.5px] font-semibold text-[#101828]">Let's get you set up</p>
              <span className="text-[11px] text-[#6a7282] tabular-nums">
                {setup.filter((s) => s.done).length} of {setup.length} done
              </span>
            </div>
            <ul className="mt-[6px] flex flex-col gap-[2px]">
              {setup.map((step) => (
                <li key={step.key}>
                  {step.done ? (
                    <span className="flex items-center gap-[8px] py-[4px] text-[12px] text-[#99a1af] line-through">
                      <span className="size-[16px] rounded-full bg-[#00c950] flex items-center justify-center shrink-0" aria-hidden="true">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                      </span>
                      {step.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => send(step.ask)}
                      className="group w-full flex items-center gap-[8px] py-[4px] text-left text-[12px] font-medium text-[#1e2939] hover:text-[#6c60ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff] rounded-[6px]"
                    >
                      <span className="size-[16px] rounded-full border-[1.5px] border-[#c9c3ff] shrink-0" aria-hidden="true" />
                      <span className="flex-1">{step.label}</span>
                      <span aria-hidden="true" className="text-[#8b7bff] group-hover:translate-x-[2px] transition-transform">→</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Suggested questions */}
      {showSuggestions && !setup.some((s) => !s.done) && (
        <div className="flex flex-col items-start gap-[6.5px] px-[14px] pb-[12px] shrink-0">
          {starterQuestions.map((s) => (
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
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-[6px] pb-[8px]" aria-label="Files to send">
            {pending.map((f, i) => (
              <PendingFile key={`${f.name}-${i}`} file={f} onRemove={() => setPending((prev) => prev.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
        <div className="flex items-center gap-[7px] px-[10.5px] py-[8.75px] rounded-[14px] bg-[#faf9ff] border-[1.5px] border-[#e0deff] focus-within:border-[#b9b2ff]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Attach images or files"
            aria-label="Attach images or files"
            className="size-[25px] flex items-center justify-center rounded-[8.75px] border border-[#d4c9ff] shrink-0 hover:bg-[#f0eeff] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
          >
            <img src="/alvin/icon-attach.svg" alt="" width={14} height={14} className="block size-[14px]" />
          </button>
          <input
            ref={fileInputRef}
            id="alvin-files"
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) addFiles(files);
            }}
          />
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
            onClick={() => send(draft, pending)}
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
    </div>,
    document.body,
  );
}
