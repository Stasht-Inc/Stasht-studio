import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// The first-time explainer (ClickUp wdy2xh28hf, Chris): a small popover pointing at the Alvin AI
// button the first time someone opens Studio with Alvin switched on. Shown once (remembered per
// account in this browser) and never to people who have already used Alvin. On phones, where Alvin
// lives in the account menu, it points at the account avatar. Not in the Figma: built in the
// panel's style for Chris to review.

const GRADIENT = 'linear-gradient(135deg, #ff60e0 0%, #6c60ff 100%)';
const AVATAR = 'linear-gradient(160deg, #ff60e0 15.959%, #6c60ff 57.472%)';

export function introSeenKey(userId: string | number | undefined) {
  return `stasht_alvin_intro_seen_${userId ?? 'anon'}`;
}

export function introSeen(userId: string | number | undefined): boolean {
  try {
    return localStorage.getItem(introSeenKey(userId)) === '1';
  } catch {
    return true; // no storage: don't risk showing it on every visit
  }
}

export function markSeen(userId: string | number | undefined) {
  try {
    localStorage.setItem(introSeenKey(userId), '1');
  } catch {
    // nothing to remember it in; it simply may show again
  }
}

type Spot = { top: number; right: number; arrowRight: number };

/** Where to point, or null when there's nothing visible to point at (e.g. the header is hidden). */
function anchor(): Spot | null {
  const button = document.querySelector<HTMLElement>('[data-name="AlvinAIButton"]');
  const rect = button && button.offsetParent !== null ? button.getBoundingClientRect() : null;
  const width = window.innerWidth;
  if (rect) {
    const right = Math.max(12, width - rect.right - 40);
    return { top: rect.bottom + 12, right, arrowRight: Math.max(16, width - right - rect.left - rect.width / 2 - 7) };
  }
  // Phones: Alvin is in the account menu, under the avatar at the top right.
  const header = document.querySelector<HTMLElement>('[data-name="Main Nav"]');
  if (!header || header.offsetParent === null) return null;
  return { top: header.getBoundingClientRect().bottom - 8, right: 12, arrowRight: 22 };
}

export default function AlvinIntroPopover({ userId, onTry, onDone }: { userId?: string | number; onTry: () => void; onDone: () => void }) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  useEffect(() => {
    // A moment after Studio opens, so it doesn't land on top of the page still loading; and not
    // over another open window (it waits until that closes).
    const t = window.setInterval(() => {
      if (document.querySelector('[role="dialog"][aria-modal="true"], [data-state="open"][role="dialog"]')) return;
      const s = anchor();
      if (s) {
        setSpot(s);
        window.clearInterval(t);
      }
    }, 1200);
    const onResize = () => setSpot((s) => (s ? anchor() : s));
    window.addEventListener('resize', onResize);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const close = () => {
    markSeen(userId);
    onDone();
  };
  const tryIt = () => {
    markSeen(userId);
    onTry();
  };

  useEffect(() => {
    if (!spot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!spot) return null;

  return createPortal(
    <div
      role="dialog"
      aria-labelledby="alvin-intro-title"
      aria-describedby="alvin-intro-body"
      data-name="AlvinIntroPopover"
      className="fixed z-[8500] w-[300px] max-w-[calc(100vw-24px)] rounded-[16px] border border-[#ede9ff] bg-white shadow-[0px_8px_40px_0px_rgba(108,96,255,0.22),0px_2px_12px_0px_rgba(0,0,0,0.1)]"
      style={{ top: spot.top, right: spot.right }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-[7px] size-[14px] rotate-45 border-l border-t border-[#ede9ff] bg-white"
        style={{ right: spot.arrowRight }}
      />
      <div className="relative px-[16px] pt-[16px] pb-[14px]">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-[10px] right-[10px] p-[6px] rounded-[8px] hover:bg-[#f4f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
        >
          <img src="/alvin/icon-close.svg" alt="" width={12} height={12} className="block size-[12px]" />
        </button>
        <div className="flex items-center gap-[10px] pr-[24px]">
          <span className="flex items-center justify-center size-[36px] rounded-full shrink-0" style={{ backgroundImage: AVATAR }}>
            <img src="/alvin/alvin-logo.svg" alt="" width={24} height={20} className="block w-6 h-5" />
          </span>
          <p id="alvin-intro-title" className="text-[14px] leading-[18px] font-semibold text-[#101828]">Meet Alvin, your AI assistant</p>
        </div>
        <p id="alvin-intro-body" aria-live="polite" className="mt-[10px] text-[12.25px] leading-[19px] text-[#4a5565]">
          Ask Alvin anything about Stasht and get step-by-step help. Alvin can also set things up for you, like a property, a
          campaign or your Contact Us widget, and read files you drop into the chat.
        </p>
        {phone && <p className="mt-[6px] text-[11.5px] leading-[16px] text-[#6a7282]">You'll find Alvin AI in your account menu.</p>}
        <div className="mt-[12px] flex items-center gap-[8px]">
          <button
            type="button"
            onClick={tryIt}
            className="h-[32px] px-[14px] rounded-[9px] text-white text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff] focus-visible:ring-offset-1"
            style={{ backgroundImage: GRADIENT }}
          >
            Try Alvin
          </button>
          <button
            type="button"
            onClick={close}
            className="h-[32px] px-[12px] rounded-[9px] border border-[#e0deff] bg-[#faf9ff] text-[12.5px] font-medium text-[#6c60ff] hover:bg-[#f0eeff]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
