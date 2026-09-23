import { useState } from 'react';
import { Archive, Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';

// Confirmation before a lead is deleted (permanent) or closed (reversible) —
// Deepak, 2026-09-24. The action runs inside the dialog so it stays open with a
// spinner until the request finishes, and a failure leaves it open to retry.

export type LeadConfirmKind = 'delete' | 'close';

interface Props {
  kind: LeadConfirmKind | null;
  leadName: string;
  onCancel: () => void;
  onConfirm: () => Promise<boolean>;
}

const COPY: Record<LeadConfirmKind, { title: string; body: string; points: string[]; action: string; busy: string }> = {
  delete: {
    title: 'Delete this lead?',
    body: 'This permanently removes the lead and everything in its conversation.',
    points: ['All texts, emails and attachments are deleted', 'It disappears from reports for your whole team', 'This can’t be undone'],
    action: 'Delete lead',
    busy: 'Deleting…',
  },
  close: {
    title: 'Close this lead?',
    body: 'The lead moves to the Closed tab. Nothing is deleted.',
    points: ['Its conversation and history are kept', 'You can reopen it any time from Closed'],
    action: 'Close lead',
    busy: 'Closing…',
  },
};

export default function LeadConfirmDialog({ kind, leadName, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const copy = kind ? COPY[kind] : null;
  const isDelete = kind === 'delete';

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={!!kind} onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <AlertDialogContent className="bg-white sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        {copy && (
          <>
            <AlertDialogHeader className="items-center sm:items-start">
              <span className={`mb-1 inline-flex h-12 w-12 items-center justify-center rounded-full ${isDelete ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-[#6C60FF]'}`}>
                {isDelete ? <Trash2 className="h-6 w-6" /> : <Archive className="h-6 w-6" />}
              </span>
              <AlertDialogTitle className="text-xl text-gray-900">{copy.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-left text-base text-gray-600">
                  <p>
                    <span className="font-semibold text-gray-900">{leadName}</span> — {copy.body}
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {copy.points.map((p) => (
                      <li key={p} className="flex items-start gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isDelete ? 'bg-red-500' : 'bg-[#6C60FF]'}`} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-2">
              <AlertDialogCancel disabled={busy} className="h-11 flex-1 sm:flex-none">Cancel</AlertDialogCancel>
              {/* A plain button, not AlertDialogAction: that one closes the dialog
                  immediately, before the request has finished. */}
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className={`inline-flex h-11 flex-1 sm:flex-none items-center justify-center gap-2 rounded-md px-5 text-sm font-semibold text-white disabled:opacity-70 ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-[#6C60FF] hover:bg-[#5A4FE5]'}`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? copy.busy : copy.action}
              </button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
