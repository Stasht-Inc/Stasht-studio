import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { ContactList } from '../../../services/newslettersAPI';
import ComposerDialog from '../../newsletters/ComposerDialog';
import { peopleText } from '../../newsletters/lib/lists';
import { LIMITS } from '../../newsletters/lib/rules';
import { BUTTON_OUTLINE, BUTTON_PRIMARY, LABEL, inputClass } from '../../newsletters/lib/ui';

export const BUTTON_DANGER = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40';

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

/** Create a list, or rename one. onSubmit answers an error to show, or null when it worked (the dialog closes). */
export function NameDialog({ open, onOpenChange, title, description, submitLabel, initialName = '', onSubmit }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  onSubmit(name: string): Promise<string | null>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) { setName(initialName); setError(null); setBusy(false); }
  }, [open, initialName]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Give the list a name.'); return; }
    setBusy(true);
    const problem = await onSubmit(trimmed);
    setBusy(false);
    if (problem) setError(problem);
    else onOpenChange(false);
  };

  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }} title={title} description={description}
      footer={(
        <>
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Cancel</button>
          <button type="submit" form="lists-name-form" disabled={busy} className={BUTTON_PRIMARY}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{submitLabel}
          </button>
        </>
      )}>
      <form id="lists-name-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div>
          <label htmlFor="lists-name" className={LABEL}>List name</label>
          <input id="lists-name" type="text" value={name} maxLength={LIMITS.name} autoFocus placeholder="e.g. Open house sign-ups"
            aria-invalid={Boolean(error)} onChange={(e) => setName(e.target.value)} className={inputClass(Boolean(error))} />
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </form>
    </ComposerDialog>
  );
}

/** "Are you sure?" for deleting a list or removing people. onConfirm answers an error to show, or null (closes). */
export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, onConfirm }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm(): Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setError(null); setBusy(false); } }, [open]);
  const confirm = async () => {
    setBusy(true);
    const problem = await onConfirm();
    setBusy(false);
    if (problem) setError(problem);
    else onOpenChange(false);
  };
  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }} title={title}
      footer={(
        <>
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Cancel</button>
          <button type="button" onClick={() => void confirm()} disabled={busy} className={BUTTON_DANGER}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{confirmLabel}
          </button>
        </>
      )}>
      <div className="space-y-3 text-sm text-gray-700">
        {children}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
    </ComposerDialog>
  );
}

/** Copy the chosen people to another of the owner's lists. */
export function CopyToListDialog({ open, onOpenChange, lists, count, onCopy }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The other lists (not the one being viewed). */
  lists: ContactList[];
  count: number;
  onCopy(target: ContactList): Promise<string | null>;
}) {
  const [targetId, setTargetId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTargetId(null); setError(null); setBusy(false); } }, [open]);
  const target = lists.find((l) => l.id === targetId) ?? null;
  const copy = async () => {
    if (!target) { setError('Choose a list to copy them to.'); return; }
    setBusy(true);
    const problem = await onCopy(target);
    setBusy(false);
    if (problem) setError(problem);
    else onOpenChange(false);
  };
  return (
    <ComposerDialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }} title="Copy to another list"
      description={`${peopleText(count)} will be added to the list you choose. People already on it keep their details.`}
      footer={(
        <>
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={BUTTON_OUTLINE}>Cancel</button>
          <button type="button" onClick={() => void copy()} disabled={busy || !lists.length} className={BUTTON_PRIMARY}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Copy {peopleText(count)}
          </button>
        </>
      )}>
      <div className="space-y-3">
        {lists.length ? (
          <fieldset>
            <legend className={LABEL}>Copy to</legend>
            <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
              {lists.map((l) => (
                <label key={l.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                  <input type="radio" name="lists-copy-target" checked={targetId === l.id} onChange={() => { setTargetId(l.id); setError(null); }}
                    className="h-4 w-4 flex-shrink-0 accent-[#6C60FF]" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm text-gray-900">{l.name}</span>
                    <span className="block text-xs text-gray-500">{peopleText(l.member_count)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-gray-600">You have no other lists yet. Create one first, then copy people to it.</p>
        )}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
    </ComposerDialog>
  );
}
