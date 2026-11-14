import { useEffect, useRef, useState } from 'react';
import { MapPin, CheckCircle2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import { leadViaLabel, leadsAPI } from '../services/leadsAPI';
import type { Lead } from '../services/leadsAPI';
import AssigneeControl from './leads/AssigneeControl';
import LeadNotesCard from './leads/LeadNotesCard';
import CampaignDeletedTag from './leads/CampaignDeletedTag';
import LeadBusinessTag from './leads/LeadBusinessTag';

export type LeadStatus = 'hot' | 'warm' | 'cold' | 'visited' | 'sold';

export const STATUS_STYLES: Record<LeadStatus, string> = {
  hot: 'bg-red-100 text-red-600 border-red-200',
  warm: 'bg-orange-100 text-orange-500 border-orange-200',
  cold: 'bg-blue-100 text-blue-500 border-blue-200',
  visited: 'bg-purple-100 text-purple-600 border-purple-200',
  sold: 'bg-green-100 text-green-600 border-green-200',
};

function StatusLabel({ status }: { status: LeadStatus }) {
  switch (status) {
    case 'hot': return <span className="flex items-center gap-1"><img src="/hot-icon.svg" alt="" className="w-3.5 h-4" />Hot</span>;
    case 'warm': return <span className="flex items-center gap-1"><img src="/warm-icon.svg" alt="" className="w-2.5 h-4" />Warm</span>;
    case 'cold': return <span className="flex items-center gap-1"><img src="/cold-icon.svg" alt="" className="w-4 h-4" />Cold</span>;
    case 'visited': return <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />Visited</span>;
    case 'sold': return <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Sold</span>;
  }
}

// Read-only status pill — the header breadcrumb's "Hot" chip in the design.
export function StatusChip({ status }: { status: LeadStatus }) {
  return (
    <span className={`inline-flex items-center h-8 px-3 rounded-md border text-sm font-semibold ${STATUS_STYLES[status]}`}>
      <StatusLabel status={status} />
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{label}</p>
      <div className="mt-1 text-base text-gray-900 break-words">{children}</div>
    </div>
  );
}

// The lead's name, editable in place (Chris 14 Nov 2026: "edit name with a simple hover and retype").
// Desktop: hover shows a pencil, click to edit. Phones: tap the name. Enter or leaving the field saves, Esc cancels,
// blank can't be saved. Guests only — a registered Stasht user's name is their own account name.
export function LeadNameEditor({ lead, leadName, canEdit, onSaved }: {
  lead: Lead;
  leadName: string;
  canEdit: boolean;
  onSaved?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  // Another lead opened: leave edit mode.
  useEffect(() => { setEditing(false); setError(null); }, [lead.id]);

  // Esc cancels the edit only — a native listener on the field, so it runs before the drawer's own Escape-to-close
  // (hooks/useDialogBehavior listens on the panel, ahead of React's handlers).
  useEffect(() => {
    const input = inputRef.current;
    if (!editing || !input) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      cancelledRef.current = true;
      setEditing(false);
      setError(null);
    };
    input.addEventListener('keydown', onKey);
    return () => input.removeEventListener('keydown', onKey);
  }, [editing]);

  const start = () => {
    if (!canEdit) return;
    cancelledRef.current = false;
    setValue(lead.user?.name?.trim() ?? '');
    setError(null);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };

  const save = async () => {
    if (saving) return;
    const name = value.trim();
    if (!name) {
      setError('Enter a name');
      return;
    }
    if (name === (lead.user?.name?.trim() ?? '')) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await leadsAPI.updateName(lead.id, name);
      if (res.success && res.data) {
        setEditing(false);
        setError(null);
        onSaved?.(res.data.name);
        toast.success('Name saved');
      } else {
        setError(res.error || 'Could not save the name');
      }
    } catch {
      setError('Could not save the name');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="min-w-0">
        <input
          ref={inputRef}
          value={value}
          maxLength={255}
          disabled={saving}
          onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save(); }
          }}
          onBlur={() => { if (!cancelledRef.current && !error) save(); }}
          aria-label="Lead name"
          aria-invalid={!!error}
          aria-describedby={error ? `lead-name-error-${lead.id}` : undefined}
          data-testid="lead-name-input"
          className={`w-full h-9 px-2 -ml-2 rounded-md border bg-white text-lg font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-300 ${error ? 'border-red-400' : 'border-gray-300'}`}
        />
        {error && <p id={`lead-name-error-${lead.id}`} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
      </div>
    );
  }

  if (!canEdit) {
    return <p className="text-lg font-semibold text-gray-900 truncate">{leadName}</p>;
  }
  return (
    <button
      type="button"
      onClick={start}
      title="Edit name"
      aria-label={`Edit name: ${leadName}`}
      data-testid="lead-name-edit"
      className="group/name max-w-full flex items-center gap-1.5 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
    >
      <span className="text-lg font-semibold text-gray-900 truncate">{leadName}</span>
      <Pencil
        className="w-4 h-4 shrink-0 text-gray-500 opacity-0 group-hover/name:opacity-100 group-focus-visible/name:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </button>
  );
}

interface LeadDetailsSidebarProps {
  lead: Lead;
  leadName: string;
  initials: string;
  lastEngaged: string;
  daysAsLead: number;
  currentStatus: LeadStatus | null;
  isUpdatingStatus: boolean;
  onStatusChange: (val: string) => void;
  // Accept / assign changed who owns the lead — the drawer re-fetches it.
  onAssigneeChanged?: () => void;
  // Closed (archived) leads are view-only, like the composer.
  isArchived?: boolean;
  onNotesSaved?: () => void;
  // The phone details sheet shows its own "Contact Details" title bar.
  showTitle?: boolean;
  // The name was edited here (Chris 14 Nov 2026) — the drawer updates the header, list row and avatar.
  onNameSaved?: (name: string) => void;
}

// Right-hand column of the lead detail view: Contact Details + Engagement.
// Presentational only — all state/handlers live in LeadDetailDrawer.
export default function LeadDetailsSidebar({
  lead, leadName, initials, lastEngaged, daysAsLead, currentStatus, isUpdatingStatus, onStatusChange, onAssigneeChanged, isArchived = false, onNotesSaved, showTitle = true, onNameSaved,
}: LeadDetailsSidebarProps) {
  // Anyone who can open and answer the lead (owner, admins, partial admins, its salesperson); not a Stasht user's own name.
  const canEditName = !lead.user?.id && !lead.is_rollup && lead.can_message !== false && !isArchived;
  const email = lead.user?.email;
  const phone = lead.user?.phone_number || lead.user?.phone;
  const location = lead.user?.location || [lead.user?.city, lead.user?.country].filter(Boolean).join(', ');

  return (
    <div>
      <section className="p-5 xl:p-6">
        {showTitle && <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Details</h3>}

        <div className="flex items-center gap-3.5">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={lead.user?.profile_image} alt={leadName} />
            <AvatarFallback className="bg-[#E5E7EB] text-[#202224] text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <LeadNameEditor lead={lead} leadName={leadName} canEdit={canEditName} onSaved={onNameSaved} />
            <p className="text-sm text-gray-600 truncate">{leadViaLabel(lead)}</p>
            <LeadBusinessTag lead={lead} className="mt-1" />
            {lead.campaign_deleted && <CampaignDeletedTag className="mt-1" />}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {email && (
            <Field label="Email">
              <a href={`mailto:${email}`} className="hover:text-gray-900 hover:underline">{email}</a>
            </Field>
          )}
          {phone && (
            <Field label="Phone">
              <a href={`tel:${phone}`} className="hover:text-gray-900 hover:underline">{phone}</a>
            </Field>
          )}
          {location && <Field label="Location">{location}</Field>}
          <Field label="Last engaged">{lastEngaged}</Field>
          <Field label="Assigned to">
            <AssigneeControl lead={lead} size="md" onChanged={() => onAssigneeChanged?.()} />
          </Field>
          <Field label="Status">
            <Select
              value={currentStatus ?? 'none'}
              disabled={isUpdatingStatus || lead.is_rollup}
              onValueChange={onStatusChange}
            >
              <SelectTrigger
                aria-label="Lead status"
                className={`h-8 text-sm font-semibold rounded-md px-3 w-auto min-w-[80px] gap-1.5 border shadow-none focus:ring-0 focus:outline-none outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1 ${
                  currentStatus ? STATUS_STYLES[currentStatus] : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {currentStatus ? <StatusLabel status={currentStatus} /> : <SelectValue />}
              </SelectTrigger>
              <SelectContent className="z-[10003]">
                <SelectItem value="none">Set status</SelectItem>
                <SelectItem value="hot"><span className="flex items-center gap-1.5"><img src="/hot-icon.svg" alt="" className="w-3 h-3.5" />Hot</span></SelectItem>
                <SelectItem value="warm"><span className="flex items-center gap-1.5"><img src="/warm-icon.svg" alt="" className="w-2 h-3.5" />Warm</span></SelectItem>
                <SelectItem value="cold"><span className="flex items-center gap-1.5"><img src="/cold-icon.svg" alt="" className="w-3.5 h-3.5" />Cold</span></SelectItem>
                <SelectSeparator />
                <SelectItem value="visited"><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />Visited</span></SelectItem>
                <SelectItem value="sold"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" />Sold</span></SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className="p-5 xl:p-6 border-t border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Engagement</h3>
        <div className="mt-4 grid grid-cols-3 gap-2 xl:gap-3">
          {[
            { value: lead.engagement, label: 'Campaigns viewed' },
            { value: lead.sent_count ?? 0, label: 'Messages sent' },
            { value: `${daysAsLead}d`, label: 'Days as lead' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-100 rounded-xl px-2 xl:px-3 py-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <LeadNotesCard lead={lead} readOnly={!!lead.is_rollup || isArchived} onSaved={onNotesSaved} />
    </div>
  );
}
