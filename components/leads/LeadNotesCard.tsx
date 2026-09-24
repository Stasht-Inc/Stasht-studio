import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { leadsAPI, type Lead } from '../../services/leadsAPI';
import { formatInboxDateShort } from '../../utils/leadInbox';

// "Notes" card from Chris's lead-detail Figma (ClickUp wdy2xh13mn): one note per
// lead, shared with everyone who can see the lead. Editable by the assignee,
// admins and the campaign owner (can_message); read-only otherwise and on Closed.

const MAX = 2000;

interface Props {
  lead: Lead;
  readOnly: boolean;
  onSaved?: () => void;
}

export default function LeadNotesCard({ lead, readOnly, onSaved }: Props) {
  const saved = lead.notes ?? '';
  const [text, setText] = useState(saved);
  const [meta, setMeta] = useState({ at: lead.notes_updated_at ?? null, by: lead.notes_updated_by?.name ?? null });
  const [busy, setBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState(saved);

  // Another lead opened, or the list refreshed with a newer note: take it —
  // unless the user is mid-edit here.
  useEffect(() => {
    setText((current) => (current === lastSaved ? saved : current));
    setLastSaved(saved);
    setMeta({ at: lead.notes_updated_at ?? null, by: lead.notes_updated_by?.name ?? null });
  }, [lead.id, saved, lead.notes_updated_at]);

  const dirty = text.trim() !== lastSaved.trim();
  const tooLong = text.length > MAX;

  const save = async () => {
    if (!dirty || tooLong || busy) return;
    setBusy(true);
    try {
      const res = await leadsAPI.updateNotes(lead.id, text);
      if (res.success && res.data) {
        const next = res.data.notes ?? '';
        setText(next);
        setLastSaved(next);
        setMeta({ at: res.data.notes_updated_at, by: res.data.notes_updated_by?.name ?? null });
        toast.success(next ? 'Note saved' : 'Note cleared');
        onSaved?.();
      } else {
        toast.error(res.error || 'Could not save the note');
      }
    } catch {
      toast.error('Could not save the note');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="p-5 xl:p-6 border-t border-gray-200">
      <h3 className="text-lg font-bold text-gray-900">Notes</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }}
        readOnly={readOnly}
        placeholder={readOnly ? 'No notes yet.' : 'Add a note about this lead…'}
        rows={4}
        aria-label="Notes about this lead"
        className={`mt-3 w-full resize-y rounded-lg border px-3 py-2.5 text-base text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6C60FF] ${readOnly ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'} ${tooLong ? 'border-red-400' : ''}`}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600 min-w-0">
          {tooLong
            ? <span className="text-red-600 font-medium">{text.length}/{MAX} — too long</span>
            : meta.at
              ? <>Updated{meta.by ? ` by ${meta.by}` : ''} · {formatInboxDateShort(meta.at)}</>
              : null}
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={save}
            disabled={!dirty || tooLong || busy}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#6C60FF] hover:bg-[#5A4FE5] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Saving…' : 'Update'}
          </button>
        )}
      </div>
    </section>
  );
}
