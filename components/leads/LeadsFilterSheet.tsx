import { useId } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CheckCircle2, MapPin, MessageSquare, Search, X } from 'lucide-react';

// Phone-only bottom sheet for the Leads list (Chris: "far too busy"): the Status,
// Assigned to and Time filters that sit in the md+ filter bar, plus the two group
// tools (Message Group, Search Group) from that bar. Every control calls the same
// LeadsTab handler as its desktop twin, so the filtering itself is unchanged.
//
// Built on the Radix dialog directly (not ui/sheet) so it can sit above the bottom
// nav's floating + button (z-[10000]).

type TimeFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'annually';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  assignedFilter: string;
  onAssignedChange: (value: string) => void;
  assigneeOptions: { id: number; name: string | null }[];
  timeFilter: TimeFilter;
  onTimeChange: (value: TimeFilter) => void;
  // Only the sheet's own filters (status / assigned / first seen) — not the search box.
  canClear: boolean;
  onClear: () => void;
  onMessageGroup: () => void;
  onSearchGroup: () => void;
  // Lets LeadsTab open a group panel after the sheet closes, without focus jumping back.
  onCloseAutoFocus?: (e: Event) => void;
}

const STATUS_OPTIONS: { value: string; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: 'All' },
  { value: 'hot', label: 'Hot', icon: <img src="/hot-icon.svg" className="w-3 h-3.5" alt="" /> },
  { value: 'warm', label: 'Warm', icon: <img src="/warm-icon.svg" className="w-2 h-3.5" alt="" /> },
  { value: 'cold', label: 'Cold', icon: <img src="/cold-icon.svg" className="w-3.5 h-3.5" alt="" /> },
  { value: 'visited', label: 'Visited', icon: <MapPin className="w-3.5 h-3.5" /> },
  { value: 'sold', label: 'Sold', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

// Same cut-offs as LeadsTab's displayLeads (first seen within the last day/week/…).
const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'daily', label: 'Last 24 hours' },
  { value: 'weekly', label: 'Last 7 days' },
  { value: 'monthly', label: 'Last month' },
  { value: 'annually', label: 'Last year' },
];

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full border text-sm font-medium transition-colors max-w-full ${selected ? 'border-[#6C60FF] bg-[#6C60FF] text-white' : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50'}`}
    >
      {children}
    </button>
  );
}

// A labelled group of toggle chips (each chip is aria-pressed).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section>
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function ToolRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-200 bg-white text-left active:bg-gray-50">
      <span className="h-9 w-9 rounded-lg bg-purple-100 text-[#6C60FF] flex items-center justify-center shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        <span className="block text-xs text-gray-600">{subtitle}</span>
      </span>
    </button>
  );
}

export default function LeadsFilterSheet(props: Props) {
  const {
    open, onOpenChange, statusFilter, onStatusChange, assignedFilter, onAssignedChange, assigneeOptions,
    timeFilter, onTimeChange, canClear, onClear, onMessageGroup, onSearchGroup, onCloseAutoFocus,
  } = props;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="md:hidden fixed inset-0 z-[10001] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className="md:hidden fixed inset-x-0 bottom-0 z-[10002] flex flex-col max-h-[85dvh] bg-white rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden="true" />
          <div className="flex items-center justify-between px-4 pt-2 pb-3">
            <DialogPrimitive.Title className="text-lg font-semibold text-gray-900">Filters</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close" className="h-9 w-9 -mr-1.5 inline-flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100">
              <X className="w-5 h-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-5">
            <Section title="Status">
              {STATUS_OPTIONS.map((o) => (
                <Chip key={o.value} selected={statusFilter === o.value || (o.value === 'all' && !statusFilter)} onClick={() => onStatusChange(o.value)}>
                  {o.icon}{o.label}
                </Chip>
              ))}
            </Section>

            <Section title="Assigned to">
              <Chip selected={assignedFilter === 'all'} onClick={() => onAssignedChange('all')}>Anyone</Chip>
              <Chip selected={assignedFilter === 'me'} onClick={() => onAssignedChange('me')}>Me</Chip>
              <Chip selected={assignedFilter === 'unassigned'} onClick={() => onAssignedChange('unassigned')}>Unassigned</Chip>
              {assigneeOptions.map((a) => (
                <Chip key={a.id} selected={assignedFilter === String(a.id)} onClick={() => onAssignedChange(String(a.id))}>
                  <span className="truncate">{a.name ?? `Teammate #${a.id}`}</span>
                </Chip>
              ))}
            </Section>

            <Section title="First seen">
              {TIME_OPTIONS.map((o) => (
                <Chip key={o.value} selected={timeFilter === o.value} onClick={() => onTimeChange(o.value)}>{o.label}</Chip>
              ))}
            </Section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Group tools</h3>
              <div className="space-y-2">
                <ToolRow
                  icon={<MessageSquare className="w-4 h-4" />}
                  title="Message a group"
                  subtitle="Send one message to several leads"
                  onClick={onMessageGroup}
                />
                <ToolRow
                  icon={<Search className="w-4 h-4" />}
                  title="Search messages"
                  subtitle="Find words in the messages and comments of these leads"
                  onClick={onSearchGroup}
                />
              </div>
            </section>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClear}
              disabled={!canClear}
              className="flex-1 h-11 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 active:bg-gray-50 disabled:opacity-40"
            >
              Clear filters
            </button>
            <DialogPrimitive.Close className="flex-1 h-11 rounded-lg bg-[#6C60FF] active:bg-[#5A4FE5] text-white text-sm font-semibold">
              Done
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
