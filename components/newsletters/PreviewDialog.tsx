import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { NlResult } from './lib/apiResult';
import ComposerDialog from './ComposerDialog';
import DeviceToggle, { type PreviewDevice } from './DeviceToggle';

/**
 * The server's exact email HTML (POST /newsletters/{id}/preview, tracking links off). The ONLY place server HTML
 * is shown, and only inside a fully sandboxed iframe (no scripts, no same-origin access).
 */
export default function PreviewDialog({ open, onOpenChange, load }: {
  open: boolean;
  onOpenChange(open: boolean): void;
  load(): Promise<NlResult<{ html: string }>>;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setHtml(null);
    setError(null);
    loadRef.current().then((res) => {
      if (cancelled) return;
      if (res.ok && typeof res.data?.html === 'string') setHtml(res.data.html);
      else setError(res.error ?? 'The preview could not be made. Try again.');
    });
    return () => { cancelled = true; };
  }, [open]);

  return (
    <ComposerDialog open={open} onOpenChange={onOpenChange} wide title="Exact email preview"
      description="The email exactly as people will get it. Links are switched off here.">
      {/* On a phone the dialog is already phone width. */}
      <div className="mb-3 hidden justify-end sm:flex"><DeviceToggle value={device} onChange={setDevice} /></div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : html === null ? (
        <div className="flex h-[40vh] items-center justify-center gap-2 text-sm text-gray-600"><Loader2 className="h-5 w-5 animate-spin text-[#6C60FF]" aria-hidden="true" />Making the preview…</div>
      ) : (
        <iframe title="Exact email preview" sandbox="" srcDoc={html}
          className={`mx-auto block h-[65vh] rounded-lg border border-gray-200 bg-white ${device === 'phone' ? 'w-[375px] max-w-full' : 'w-full'}`} />
      )}
    </ComposerDialog>
  );
}
