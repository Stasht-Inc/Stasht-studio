import { useState } from 'react';
import { alvinAPI, type AlvinActionCard as Card, type AlvinActionField, type AlvinMessage } from '../../services/alvinAPI';

// The confirmation card under Alvin's message when Alvin offers to do something (web API
// app/Services/Alvin/Actions). Nothing happens until the person clicks the confirm button; they can
// change the details first. Not in Chris's Figma: built in the panel's own style for review.

const GRADIENT = 'linear-gradient(135deg, #ff60e0 0%, #6c60ff 100%)';

type Values = Record<string, string | string[]>;

function initialValues(fields: AlvinActionField[]): Values {
  const v: Values = {};
  fields.forEach((f) => {
    v[f.key] = f.type === 'multiselect' ? (Array.isArray(f.value) ? f.value : []) : Array.isArray(f.value) ? f.value.join(', ') : f.value ?? '';
  });
  return v;
}

function shown(f: AlvinActionField, value: string | string[]): string {
  if (Array.isArray(value)) {
    const labels = value.map((v) => f.options?.find((o) => o.value === v)?.label ?? v);
    return labels.join(', ');
  }
  if (f.type === 'select') return f.options?.find((o) => o.value === value)?.label ?? value;
  return value;
}

function StatusPill({ status }: { status: Card['status'] }) {
  const map: Record<string, [string, string]> = {
    done: ['Done', 'bg-[#e8f8ef] text-[#0f8a4b]'],
    cancelled: ['Cancelled', 'bg-[#f2f2f5] text-[#6a7282]'],
    failed: ["Didn't work", 'bg-[#fff4e5] text-[#a15c00]'],
  };
  const entry = map[status];
  if (!entry) return null;
  return <span className={`shrink-0 px-[8px] py-[1px] rounded-full text-[10.5px] font-semibold ${entry[1]}`}>{entry[0]}</span>;
}

function FieldInput({ field, value, onChange }: { field: AlvinActionField; value: string | string[]; onChange: (v: string | string[]) => void }) {
  const id = `alvin-field-${field.key}`;
  const base = 'w-full rounded-[8px] border border-[#e0deff] bg-white px-[9px] py-[6px] text-[12.25px] text-[#1e2939] outline-none focus:border-[#8b7bff] focus:ring-0';
  if (field.type === 'select') {
    return (
      <select id={id} value={value as string} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Choose…</option>
        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === 'multiselect') {
    const chosen = Array.isArray(value) ? value : [];
    return (
      <div id={id} className="max-h-[132px] overflow-y-auto rounded-[8px] border border-[#e0deff] bg-white px-[9px] py-[5px] flex flex-col gap-[3px]">
        {(field.options ?? []).length === 0 && <span className="text-[12px] text-[#99a1af]">Nothing to choose from yet</span>}
        {field.options?.map((o) => (
          <label key={o.value} className="flex items-center gap-[7px] text-[12px] text-[#1e2939]">
            <input
              type="checkbox"
              checked={chosen.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...chosen, o.value] : chosen.filter((c) => c !== o.value))}
              className="rounded border-[#c9c3ff] text-[#6c60ff] focus:ring-[#6c60ff]"
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    );
  }
  if (field.type === 'textarea') {
    return <textarea id={id} rows={2} value={value as string} onChange={(e) => onChange(e.target.value)} className={`${base} resize-none`} />;
  }
  return <input id={id} type={field.type === 'email' ? 'email' : 'text'} value={value as string} onChange={(e) => onChange(e.target.value)} className={base} />;
}

export default function AlvinActionCard({
  message,
  onUpdate,
  onNavigate,
}: {
  message: AlvinMessage;
  onUpdate: (card: AlvinMessage, done?: AlvinMessage) => void;
  onNavigate: (page: string) => void;
}) {
  const card = message.meta.action as Card;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Values>(() => initialValues(card.fields));
  const [busy, setBusy] = useState<'' | 'confirm' | 'cancel'>('');
  const [error, setError] = useState<{ text: string; code?: string } | null>(null);

  const open = card.status === 'proposed' || card.status === 'failed';
  const missing = card.fields.filter((f) => f.required && (Array.isArray(values[f.key]) ? (values[f.key] as string[]).length === 0 : String(values[f.key] ?? '').trim() === ''));
  const shortOfCredits = card.credits_left !== undefined && card.credits_left !== null && card.credits_left < card.credits;
  const problem = error?.text ?? (card.status === 'failed' || card.problem ? card.problem : null);

  const run = async (kind: 'confirm' | 'cancel') => {
    setBusy(kind);
    setError(null);
    const res = kind === 'confirm' ? await alvinAPI.confirmAction(message.id, values) : await alvinAPI.cancelAction(message.id);
    setBusy('');
    if (res.card) {
      onUpdate(res.card, res.done);
      setValues(initialValues((res.card.meta.action as Card).fields));
    }
    if (!res.ok) {
      setError({ text: res.message ?? 'Something went wrong. Please try again.', code: res.code });
      if (res.code === 'invalid') setEditing(true);
      return;
    }
    setEditing(false);
  };

  return (
    <div className="mt-[7px] w-full max-w-[290px] rounded-[14px] border border-[#e0deff] bg-white shadow-[0_2px_10px_rgba(108,96,255,0.08)] px-[13px] py-[12px] text-[12.25px] leading-[18px] text-[#1e2939]" data-name="AlvinActionCard">
      <div className="flex items-center justify-between gap-[8px]">
        <p className="font-semibold text-[13px] text-[#101828]">{card.title}</p>
        <StatusPill status={card.status} />
      </div>

      <div className="mt-[8px] flex flex-col gap-[7px]">
        {card.fields.map((f) =>
          editing && open ? (
            <div key={f.key} className="flex flex-col gap-[3px]">
              <label htmlFor={`alvin-field-${f.key}`} className="text-[11px] font-medium text-[#6a7282]">
                {f.label}
                {f.required && <span className="text-[#e5484d]"> *</span>}
              </label>
              <FieldInput field={f} value={values[f.key]} onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))} />
              {f.help && <span className="text-[10.5px] text-[#99a1af]">{f.help}</span>}
            </div>
          ) : (
            <div key={f.key} className="flex flex-col">
              <span className="text-[11px] text-[#99a1af]">{f.label}</span>
              <span className={`break-words ${shown(f, values[f.key]) ? '' : 'text-[#c0c4cc]'}`}>
                {shown(f, values[f.key]) || (f.required ? 'Needed' : '—')}
              </span>
            </div>
          ),
        )}
      </div>

      {open && card.notes && card.notes.length > 0 && (
        <ul className="mt-[9px] flex flex-col gap-[3px] text-[11.5px] leading-[16px] text-[#6a7282]">
          {card.notes.map((n, i) => (
            <li key={i} className="flex gap-[6px]">
              <span aria-hidden="true" className="text-[#8b7bff]">•</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      {open && problem && (
        <p role="alert" className="mt-[9px] rounded-[8px] bg-[#fff4e5] px-[9px] py-[6px] text-[11.5px] leading-[16px] text-[#8a4b00]">{problem}</p>
      )}

      {open && (
        <>
          <p className={`mt-[9px] text-[11px] ${shortOfCredits ? 'text-[#c2410c]' : 'text-[#99a1af]'}`}>
            Uses {card.credits} AI credits
            {card.credits_left !== undefined && card.credits_left !== null ? ` · you have ${card.credits_left}` : ''}
          </p>
          {(shortOfCredits || error?.code === 'no_credits') && (
            <button type="button" onClick={() => onNavigate('billing')} className="mt-[3px] text-[11.5px] font-medium text-[#6c60ff] underline underline-offset-2">
              Buy AI credits in Billing & Payment
            </button>
          )}
          <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
            <button
              type="button"
              onClick={() => run('confirm')}
              disabled={busy !== '' || missing.length > 0}
              title={missing.length ? `Fill in: ${missing.map((m) => m.label).join(', ')}` : undefined}
              className="h-[30px] px-[13px] rounded-[9px] text-white text-[12px] font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff] focus-visible:ring-offset-1"
              style={{ backgroundImage: GRADIENT }}
            >
              {busy === 'confirm' ? 'Working…' : card.status === 'failed' ? 'Try again' : card.confirm_label}
            </button>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              disabled={busy !== ''}
              className="h-[30px] px-[11px] rounded-[9px] border border-[#e0deff] bg-[#faf9ff] text-[12px] font-medium text-[#6c60ff] hover:bg-[#f0eeff] disabled:opacity-50"
            >
              {editing ? 'Done editing' : 'Change details'}
            </button>
            <button
              type="button"
              onClick={() => run('cancel')}
              disabled={busy !== ''}
              className="h-[30px] px-[8px] rounded-[9px] text-[12px] font-medium text-[#6a7282] hover:text-[#1e2939] disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
