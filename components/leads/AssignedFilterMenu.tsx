import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import {
  ALL_LEADS, assignedLabel, assignedOptions, offersAllLeads, ticksOf, toggleAssigned, type TeamLeads, type Teammate,
} from '../../utils/leadsAssignedFilter';

// Desktop "Assigned to" filter (Chris 11 Nov 2026 (d)): a checkbox per choice, unioned; the menu stays open while
// ticking. Selected / hover states are Studio's darker gray, never purple (Chris's design rule).

export function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-filter-checkbox=""
      className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-300 bg-white'}`}
    >
      {checked && <Check className="size-3" strokeWidth={3} />}
    </span>
  );
}

const ITEM = 'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-gray-900 outline-none cursor-default select-none data-[highlighted]:bg-gray-100';

export default function AssignedFilterMenu({ value, onChange, teamLeads, teammates }: {
  value: string;
  onChange: (value: string) => void;
  teamLeads: TeamLeads;
  teammates: Teammate[];
}) {
  const options = assignedOptions(teamLeads, teammates);
  const ticks = new Set(ticksOf(value, teamLeads, options));
  const fixed = options.filter((o) => !(Number(o.value) > 0));
  const people = options.filter((o) => Number(o.value) > 0);
  const item = (key: string, label: string, checked: boolean) => (
    <DropdownMenuPrimitive.CheckboxItem
      key={key}
      checked={checked}
      // Keep the menu open so several choices can be ticked in a row.
      onSelect={(e) => { e.preventDefault(); onChange(toggleAssigned(value, key, teamLeads, options)); }}
      className={ITEM}
    >
      <FilterCheckbox checked={checked} />
      <span className="truncate">{label}</span>
    </DropdownMenuPrimitive.CheckboxItem>
  );

  return (
    <DropdownMenuPrimitive.Root modal={false}>
      <DropdownMenuPrimitive.Trigger
        aria-label="Assigned to"
        data-assigned-filter=""
        className="hidden md:flex items-center justify-between gap-2 w-auto min-w-[9rem] h-9 px-3 whitespace-nowrap rounded-md border border-gray-200 bg-white text-sm text-gray-900 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 data-[state=open]:bg-gray-50"
      >
        <span className="truncate">{assignedLabel(value, teamLeads, options)}</span>
        <ChevronDown className="size-4 opacity-50 shrink-0" />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[12rem] max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-md"
        >
          {offersAllLeads(teamLeads) && (
            <>
              {item(ALL_LEADS, 'All leads', value === ALL_LEADS)}
              <DropdownMenuPrimitive.Separator className="-mx-1 my-1 h-px bg-gray-200" />
            </>
          )}
          {fixed.map((o) => item(o.value, o.label, ticks.has(o.value)))}
          {people.length > 0 && <DropdownMenuPrimitive.Separator className="-mx-1 my-1 h-px bg-gray-200" />}
          {people.map((o) => item(o.value, o.label, ticks.has(o.value)))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
