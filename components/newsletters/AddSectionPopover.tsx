import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Heading, Image as ImageIcon, LayoutGrid, Minus, MousePointerClick, Plus, Type, Youtube } from 'lucide-react';
import type { BlockType } from '../../services/newslettersAPI';
import { LIMITS } from './lib/rules';
import { LAYER } from './lib/ui';

const ITEMS: Array<{ type: BlockType; label: string; desc: string; icon: ReactNode }> = [
  { type: 'image', label: 'Image', desc: 'A photo or graphic', icon: <ImageIcon className="h-5 w-5 text-[#6C60FF]" /> },
  { type: 'title', label: 'Title', desc: 'A heading', icon: <Heading className="h-5 w-5 text-[#6C60FF]" /> },
  { type: 'text', label: 'Text', desc: 'A paragraph with bold, italic and links', icon: <Type className="h-5 w-5 text-[#009689]" /> },
  { type: 'youtube', label: 'YouTube', desc: 'A video people tap to watch', icon: <Youtube className="h-5 w-5 text-[#FF4444]" /> },
  { type: 'button', label: 'Button', desc: 'A button with a link', icon: <MousePointerClick className="h-5 w-5 text-[#6C60FF]" /> },
  { type: 'divider', label: 'Divider', desc: 'A line or space between sections', icon: <Minus className="h-5 w-5 text-[#F59E0B]" /> },
  { type: 'campaigns', label: 'Campaigns', desc: 'Show your campaigns', icon: <LayoutGrid className="h-5 w-5 text-[#6C60FF]" /> },
];

/** The dashed line with a "+" from the Storeel timeline (MemoryDetailsPage "Add Widget"), here "Add section". */
export default function AddSectionPopover({ label, onAdd, disabled = false, alwaysVisible = false }: {
  label: string;
  onAdd(type: BlockType): void;
  disabled?: boolean;
  alwaysVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // To the side on wide screens (as on a Storeel); below the "+" on phones, where there is no room beside it.
  const [side, setSide] = useState<'right' | 'bottom'>('right');
  const openChange = (next: boolean) => {
    if (next) setSide(window.matchMedia('(min-width: 768px)').matches ? 'right' : 'bottom');
    setOpen(next);
  };
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onItemKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = (index + 1) % ITEMS.length;
    else if (e.key === 'ArrowUp') next = (index + ITEMS.length - 1) % ITEMS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ITEMS.length - 1;
    if (next === null) return;
    e.preventDefault();
    itemRefs.current[next]?.focus();
  };
  // Hidden until hover / focus on wide screens (as in the Storeel timeline); always shown on touch screens.
  const visibility = alwaysVisible || open
    ? 'opacity-100'
    : 'opacity-100 md:opacity-0 md:group-hover/add:opacity-100 md:group-focus-within/add:opacity-100';

  return (
    <div className="group/add relative h-7">
      <div className={`absolute inset-x-6 top-1/2 border-b border-dashed border-[#6C60FF]/40 transition-opacity ${visibility}`} />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ${visibility}`}>
        <Popover.Root open={open} onOpenChange={openChange}>
          <Popover.Trigger asChild>
            <button type="button" aria-label={label} disabled={disabled} title={disabled ? `You can add up to ${LIMITS.blocks} sections.` : label}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#6C60FF] bg-white text-[#6C60FF] transition-colors hover:bg-[#6C60FF]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40 disabled:opacity-40">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side={side} align="center" sideOffset={8} collisionPadding={12} style={{ zIndex: LAYER.popover }}
              onOpenAutoFocus={(e) => { e.preventDefault(); itemRefs.current[0]?.focus(); }}
              className="w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-gray-200 bg-white p-0 shadow-lg outline-none">
              <div className="p-4 pb-2">
                <h4 className="text-base font-semibold text-gray-900">Add section</h4>
                <p className="text-sm text-gray-500">Choose what to add to your email</p>
              </div>
              <div role="menu" aria-label="Sections" className="max-h-[min(320px,60vh)] overflow-y-auto pb-2">
                {ITEMS.map((item, index) => (
                  <button key={item.type} ref={(el) => { itemRefs.current[index] = el; }} type="button" role="menuitem"
                    onKeyDown={(e) => onItemKeyDown(e, index)} onClick={() => { setOpen(false); onAdd(item.type); }}
                    className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                    <span aria-hidden="true" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">{item.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{item.label}</span>
                      <span className="block text-xs text-gray-500">{item.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}
