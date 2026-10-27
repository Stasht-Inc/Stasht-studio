// components/newsletters/lib/ui.ts
// Look and feel shared by the newsletter screens (Chris's prototype). Class strings live here so every
// step card, dialog and popover uses the same buttons and inputs.

export const PURPLE = '#6C60FF';

/** Create Campaign is a portal at z-index 99999 (CreateMemory.tsx); everything the composer opens sits above it. */
export const LAYER = { composer: 99999, popover: 100005, dialog: 100010 } as const;

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40';

export const BUTTON_OUTLINE = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-5 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 ${FOCUS}`;
export const BUTTON_SECONDARY = `inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BUTTON_PRIMARY = `inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#6C60FF] px-5 text-sm font-medium text-white hover:bg-[#5B50E6] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BUTTON_SMALL = `inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 ${FOCUS}`;
export const LINK_BUTTON = `inline-flex items-center gap-1.5 rounded text-sm font-medium text-[#6C60FF] hover:underline disabled:opacity-50 ${FOCUS}`;
export const LABEL = 'mb-1.5 block text-sm font-medium text-gray-900';

const INPUT_BASE = 'w-full h-9 rounded-lg border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 disabled:bg-gray-50 disabled:text-gray-500';
export const inputClass = (invalid = false): string => `${INPUT_BASE} ${invalid ? 'border-red-400' : 'border-gray-200'}`;

const TEXTAREA_BASE = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-[#6C60FF] focus:ring-2 focus:ring-[#6C60FF]/20 disabled:bg-gray-50 disabled:text-gray-500';
export const textareaClass = (invalid = false): string => `${TEXTAREA_BASE} ${invalid ? 'border-red-400' : 'border-gray-200'}`;
