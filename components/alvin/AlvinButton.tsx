// Top-bar "Alvin AI" button — Figma "Alvin AI help" › AlvinAIButton (node 14397:15244).
// Gradient border + gradient text. `compact` (phone top bar, ClickUp wdy2xh2a35) keeps the same gradient-bordered
// button with the mascot only: "Alvin AI" stays as its accessible name, but there's no room for the words on a phone.

const GRADIENT_BORDER = 'linear-gradient(173.44deg, #ff60e0 15.959%, #6c60ff 57.472%)';
const GRADIENT_TEXT = 'linear-gradient(171deg, #ff60e0 15.959%, #6c60ff 57.472%)';

export default function AlvinButton({ open, onClick, compact = false }: { open: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Alvin AI"
      aria-expanded={open}
      aria-haspopup="dialog"
      data-name="AlvinAIButton"
      className={`flex items-center justify-center gap-[7px] ${compact ? 'h-[32px] px-[7px]' : 'h-[30px] px-[9px]'} rounded-[8px] border-2 border-solid border-transparent shrink-0 transition-shadow hover:shadow-[0_2px_10px_rgba(108,96,255,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff] focus-visible:ring-offset-1`}
      style={{ background: `linear-gradient(#ffffff, #ffffff) padding-box, ${GRADIENT_BORDER} border-box` }}
    >
      <img src="/alvin/alvin-logo-button.svg" alt="" width={24} height={20} className="block w-6 h-5 shrink-0" />
      {!compact && <span
        className="text-[13px] leading-[19.5px] font-semibold tracking-[-0.3762px] whitespace-nowrap bg-clip-text text-transparent"
        style={{ backgroundImage: GRADIENT_TEXT, WebkitBackgroundClip: 'text' }}
      >
        Alvin AI
      </span>}
    </button>
  );
}
