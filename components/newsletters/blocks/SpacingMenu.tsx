import { useState } from 'react';
import { ChevronDown, UnfoldVertical } from 'lucide-react';
import type { LineSpacing, SectionPadding } from '../../../services/newslettersAPI';
import SegmentedSwitch from '../SegmentedSwitch';
import { LINE_SPACING_OPTIONS, PADDING_OPTIONS } from '../lib/sectionSpacing';
import { MenuChoice, ToolMenu } from './StyleToolbar';

// Chris (7 Nov, point 2): one "Spacing" button on the Title and Text toolbars, holding both choices so the toolbar
// stays uncluttered: Line spacing (the gaps between lines, paragraphs and list rows) and Padding (the room above and
// below the section). Normal is the section as it always was.

const HEADING = 'px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500';

export function SpacingMenu({ lineSpacing, padding, onLineSpacing, onPadding }: {
  lineSpacing: LineSpacing;
  padding: SectionPadding;
  onLineSpacing(value: LineSpacing): void;
  onPadding(value: SectionPadding): void;
}) {
  const [open, setOpen] = useState(false);
  const line = LINE_SPACING_OPTIONS.find((o) => o.value === lineSpacing)?.label ?? 'Normal';
  const room = PADDING_OPTIONS.find((o) => o.value === padding)?.label ?? 'Normal';
  return (
    // Stays open while choosing, so both can be set and seen in the preview behind it.
    <ToolMenu label={`Spacing: line spacing ${line}, padding ${room}`} open={open} onOpenChange={setOpen} list
      trigger={<><UnfoldVertical className="h-4 w-4" aria-hidden="true" /><ChevronDown className="hidden h-3 w-3 text-gray-500 sm:block" aria-hidden="true" /></>}>
      <div role="menu" aria-label="Spacing" className="min-w-[11rem]">
        <p id="nl-spacing-lines" className={HEADING} style={{ paddingTop: 4 }}>Line spacing</p>
        <div role="group" aria-labelledby="nl-spacing-lines">
          {LINE_SPACING_OPTIONS.map((o) => (
            <MenuChoice key={o.value} label={o.label} checked={o.value === lineSpacing} onPick={() => onLineSpacing(o.value)} />
          ))}
        </div>
        <p id="nl-spacing-padding" className={HEADING}>Padding (top and bottom)</p>
        <div role="group" aria-labelledby="nl-spacing-padding">
          {PADDING_OPTIONS.map((o) => (
            <MenuChoice key={o.value} label={o.label} checked={o.value === padding} onPick={() => onPadding(o.value)} />
          ))}
        </div>
      </div>
    </ToolMenu>
  );
}

/** Button, Divider and Campaigns (Chris, 7 Nov): the room above and below, a small switch with their other controls. */
export function PaddingSwitch({ value, onChange, className = '' }: { value: SectionPadding; onChange(value: SectionPadding): void; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      <span className="text-sm text-gray-700">Padding</span>
      <SegmentedSwitch label="Padding (top and bottom)" options={PADDING_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
