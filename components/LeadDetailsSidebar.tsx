import { MapPin, CheckCircle2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from './ui/select';
import type { Lead } from '../services/leadsAPI';

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

interface LeadDetailsSidebarProps {
  lead: Lead;
  leadName: string;
  initials: string;
  lastEngaged: string;
  daysAsLead: number;
  currentStatus: LeadStatus | null;
  isUpdatingStatus: boolean;
  onStatusChange: (val: string) => void;
}

// Right-hand column of the lead detail view: Contact Details + Engagement.
// Presentational only — all state/handlers live in LeadDetailDrawer.
export default function LeadDetailsSidebar({
  lead, leadName, initials, lastEngaged, daysAsLead, currentStatus, isUpdatingStatus, onStatusChange,
}: LeadDetailsSidebarProps) {
  const email = lead.user?.email;
  const phone = lead.user?.phone_number || lead.user?.phone;
  const location = lead.user?.location || [lead.user?.city, lead.user?.country].filter(Boolean).join(', ');

  return (
    <div>
      <section className="p-5 xl:p-6">
        <h3 className="text-lg font-bold text-gray-900">Contact Details</h3>

        <div className="mt-4 flex items-center gap-3.5">
          <Avatar className="h-14 w-14 shrink-0">
            <AvatarImage src={lead.user?.profile_image} alt={leadName} />
            <AvatarFallback className="bg-[#6C60FF] text-white text-lg font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{leadName}</p>
            <p className="text-sm text-gray-600 truncate">Via: {lead.story.title}</p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {email && (
            <Field label="Email">
              <a href={`mailto:${email}`} className="hover:text-[#6C60FF] hover:underline">{email}</a>
            </Field>
          )}
          {phone && (
            <Field label="Phone">
              <a href={`tel:${phone}`} className="hover:text-[#6C60FF] hover:underline">{phone}</a>
            </Field>
          )}
          {location && <Field label="Location">{location}</Field>}
          <Field label="Last engaged">{lastEngaged}</Field>
          <Field label="Status">
            <Select
              value={currentStatus ?? 'none'}
              disabled={isUpdatingStatus || lead.is_rollup}
              onValueChange={onStatusChange}
            >
              <SelectTrigger
                aria-label="Lead status"
                className={`h-8 text-sm font-semibold rounded-md px-3 w-auto min-w-[80px] gap-1.5 border shadow-none focus:ring-0 focus:outline-none outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF] focus-visible:ring-offset-1 ${
                  currentStatus ? STATUS_STYLES[currentStatus] : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {currentStatus ? <StatusLabel status={currentStatus} /> : <SelectValue />}
              </SelectTrigger>
              <SelectContent>
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
    </div>
  );
}
