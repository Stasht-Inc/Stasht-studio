// components/widgets/LeadRecipientsPanel.tsx
// "Who gets this widget's leads" (spec 2026-09-30-widget-lead-recipients-design.md §5), rendered
// in ContactWidgetManager's preview column under "This is how visitors will see the widget on
// your site." Ticking/unticking a row only edits WidgetBuilder's form.excludedRecipients; the
// builder sends that as excluded_recipients on save, following its existing dirty-state pattern —
// this component holds no state of its own (its only local state is per-avatar broken-image
// tracking, below).
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import type { LeadRecipient, LeadRecipientRole, LeadRecipientStatus } from '../../services/widgetsAPI';
import { contrastInk, safeColor, safeHttpsUrl } from './widgetHelpers';

const ROLE_LABELS: Record<LeadRecipientRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  partial_admin: 'Partial Admin',
  property_owner: 'Property owner',
  property_admin: 'Property admin',
  rep: 'Rep',
};

// Same colours, case and compact size as the Users tab's status badge (UsersPage getStatusColor),
// so a person reads the same in both places.
const STATUS_BADGES: Record<LeadRecipientStatus, { label: string; className: string; title?: string }> = {
  active: { label: 'ACTIVE', className: 'bg-green-100 text-green-800' },
  pending: { label: 'PENDING', className: 'bg-orange-100 text-orange-800', title: 'Invite sent — gets leads once they accept' },
};

function StatusBadge({ status }: { status: LeadRecipientStatus }) {
  // An API from before statuses existed sends none: show nothing rather than guess.
  const badge = STATUS_BADGES[status];
  if (!badge) return null;
  return (
    <span
      className={`text-[12px] leading-4 font-medium px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap ${badge.className}`}
      title={badge.title}
    >
      {badge.label}
    </span>
  );
}

function RecipientAvatar({ recipient }: { recipient: LeadRecipient }) {
  const photo = safeHttpsUrl(recipient.avatar_url);
  const [broken, setBroken] = useState(false);
  // A row can be re-rendered in place (same key, new photo) after a save; don't keep an old
  // broken-image flag pinned once the underlying URL actually changes.
  useEffect(() => { setBroken(false); }, [photo]);
  const color = safeColor(recipient.color, '#6C60FF');
  const showPhoto = !!photo && !broken;
  return (
    <span className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-white border border-gray-100" aria-hidden="true">
      {showPhoto ? (
        <img src={photo!} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center text-[11px] font-semibold"
          style={{ background: color, color: contrastInk(color) }}
        >
          {recipient.initials}
        </span>
      )}
    </span>
  );
}

function RecipientRow({
  recipient,
  excluded,
  onToggle,
}: {
  recipient: LeadRecipient;
  excluded: boolean;
  onToggle: (key: string, connected: boolean) => void;
}) {
  // Locked (owner) rows are always connected and can't be unticked; everyone else follows the
  // form's local excluded-keys list, which starts from the row's last-saved `connected` state.
  const connected = recipient.locked || !excluded;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <RecipientAvatar recipient={recipient} />
      <div className="flex-1 min-w-0">
        {/* Wraps instead of squeezing: in a narrow column a long name keeps the line and the role
            and status drop below it, rather than the name collapsing to a couple of letters. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate max-w-full" title={recipient.name}>{recipient.name}</span>
          {/* Role and status wrap as one unit, so a badge never sits alone on a line. */}
          <span className="inline-flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400 whitespace-nowrap">{ROLE_LABELS[recipient.role]}</span>
            {/* The owner row is always on; its status adds nothing. */}
            {!recipient.locked && <StatusBadge status={recipient.status} />}
          </span>
        </div>
        {recipient.email && <p className="text-xs text-gray-500 truncate" title={recipient.email}>{recipient.email}</p>}
      </div>
      {recipient.locked ? (
        // A real disabled+checked <input> renders its check mark almost invisibly in Chrome
        // (disabled controls drop accent-color), so the always-on owner row gets a static,
        // unambiguous "checked" badge instead of a checkbox nobody can see is ticked.
        <span className="inline-flex items-center gap-1.5 shrink-0" aria-label={`${recipient.name} always gets this widget's leads`}>
          <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: '#6C60FF' }} aria-hidden="true">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
          <span className="text-xs text-gray-400 whitespace-nowrap">Always gets leads</span>
        </span>
      ) : (
        <label className="inline-flex items-center gap-1.5 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={connected}
            onChange={(e) => onToggle(recipient.key, e.target.checked)}
            aria-label={`Send ${recipient.name} this widget's leads`}
            className="w-4 h-4 accent-[#6C60FF]"
          />
        </label>
      )}
    </li>
  );
}

export function LeadRecipientsPanel({
  hasWidget,
  recipients,
  loading,
  loadError,
  excludedRecipients,
  onToggle,
  onInviteAdmin,
}: {
  // Whether the widget has been saved at least once; an unsaved widget has no recipients yet.
  hasWidget: boolean;
  // undefined while loading/not yet fetched; an array (possibly just the owner row) once loaded.
  recipients?: LeadRecipient[];
  loading: boolean;
  loadError: boolean;
  excludedRecipients: string[];
  onToggle: (key: string, connected: boolean) => void;
  onInviteAdmin: () => void;
}) {
  const excludedSet = new Set(excludedRecipients);
  const rows = recipients || [];
  const onlyOwner = rows.length === 1;

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-800">Who gets this widget's leads</h3>
      <p className="text-xs text-gray-400 mt-1">
        Ticked people get an email for every new lead and reply. Partial Admins can see these leads, and team members can accept them. Pending people get leads once they accept the invite.
      </p>

      {!hasWidget ? (
        <p className="text-sm text-gray-500 mt-3">Save the widget to choose who gets its leads.</p>
      ) : loading ? (
        <p className="text-sm text-gray-500 mt-3 flex items-center gap-2" role="status">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading...
        </p>
      ) : loadError || !recipients ? (
        <p className="text-sm text-gray-500 mt-3">Couldn't load who gets this widget's leads. Reopen this widget to try again.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100">
            {rows.map((r) => (
              <RecipientRow key={r.key} recipient={r} excluded={excludedSet.has(r.key)} onToggle={onToggle} />
            ))}
          </ul>
          {onlyOwner && (
            <p className="text-xs text-gray-400 mt-2">No other admins yet — invite one from the Users tab.</p>
          )}
          <button
            type="button"
            onClick={onInviteAdmin}
            className="mt-3 text-sm font-semibold hover:underline"
            style={{ color: '#5A4FE5' }}
          >
            Invite admin
          </button>
        </>
      )}
    </div>
  );
}
