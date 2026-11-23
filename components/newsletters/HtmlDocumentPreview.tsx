import { useCallback, useEffect, useRef, useState } from 'react';
import { Code, Loader2 } from 'lucide-react';
import type { NewsletterDraft } from './lib/draft';
import { initialsFrom, type SenderProfile } from './lib/profile';
import type { HtmlDocumentPreviewState } from './hooks/useHtmlDocumentPreview';
import type { PreviewDevice } from './DeviceToggle';
import InboxRow from './InboxRow';
import { BUTTON_SMALL, LINK_BUTTON } from './lib/ui';
import { brokenPicturesNote } from './lib/htmlMode';

/**
 * Chris 22 Nov 2026 (Q4): the EMAIL PREVIEW in HTML mode, in the editor's frame (Inbox line, grey page, phone frame for
 * Phone view). It shows the API's own email (the cleaned template with our footer and unsubscribe link, fetched after
 * each save: useHtmlDocumentPreview) in a frame that runs no scripts, sized to its content. Nothing is edited here.
 *
 * Q4 follow-up: the frame loads the template's web fonts (font services only, from the API) and pictures; it is fitted
 * again once the fonts are in. Pictures that fail to load are listed at the bottom of the card ("2 pictures didn't load").
 */
/** How long "Saving…" may show while no save is running before it says the HTML was not kept (23 Nov: it spun forever). */
export const STUCK_SAVE_MS = 12000;

export default function HtmlDocumentPreview({ draft, profile, device, preview, saved, saving, saveBusy = false, onRetrySave, onGoToBox }: {
  draft: NewsletterDraft;
  profile: SenderProfile | null;
  device: PreviewDevice;
  preview: HtmlDocumentPreviewState;
  /** The draft exists on the server (the preview is drawn from the saved copy). */
  saved: boolean;
  /** A save is on its way: the preview is about to change. */
  saving: boolean;
  /** A save request is running right now. */
  saveBusy?: boolean;
  /** Save again (offered when the HTML was not kept). */
  onRetrySave?: () => void;
  /** Take the user to the HTML box (the empty preview is not where you paste). */
  onGoToBox?: () => void;
}) {
  const phone = device === 'phone';
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const [broken, setBroken] = useState<string[]>([]);
  // Fit the frame to the email once it (and its pictures) have loaded, and again when its web fonts are in (text set in
  // a web font takes another height). The frame's pictures that failed are listed under it.
  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const measure = () => setHeight(Math.max(240, Math.ceil(doc.documentElement.scrollHeight)));
    measure();
    setBroken([...doc.images].filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src')).map((img) => img.getAttribute('src') as string));
    void doc.fonts?.ready.then(measure).catch(() => undefined);
  }, []);
  // A new email: what failed before is for the old one.
  useEffect(() => setBroken([]), [preview.html]);
  const brokenNote = preview.html !== null ? brokenPicturesNote(broken) : null;
  const pasted = draft.content.html_document.trim() !== '';
  const waiting = pasted && (!saved || (preview.html === null && !preview.error));
  // Waiting with no save running for STUCK_SAVE_MS: the saved copy came back without this HTML (e.g. an API that does
  // not know HTML mode), so say so instead of spinning forever. Any edit or save starts the wait again.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    setStuck(false);
    if (!waiting || saveBusy) return undefined;
    const timer = window.setTimeout(() => setStuck(true), STUCK_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [waiting, saveBusy, draft.content.html_document]);

  let body;
  if (!pasted) {
    body = (
      <div className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-white px-4 py-12 text-center${onGoToBox ? ' cursor-pointer hover:border-[#6C60FF]/40' : ''}`}
        onClick={onGoToBox} data-testid="nl-html-empty-preview">
        <Code className="h-6 w-6 text-[#6C60FF]" aria-hidden="true" />
        <p className="text-sm text-gray-600">Paste your HTML in step 4, Content.<br />Your email shows here.</p>
        {onGoToBox ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onGoToBox(); }} className={`${BUTTON_SMALL} mt-1`} data-testid="nl-html-go-to-box">
            Go to HTML box
          </button>
        ) : null}
      </div>
    );
  } else if (waiting && stuck) {
    body = (
      <div role="alert" className="rounded-lg bg-white px-4 py-8 text-center text-sm text-red-700" data-testid="nl-html-save-stuck">
        <p>Your HTML wasn't saved, so the preview can't show yet.</p>
        {onRetrySave ? <button type="button" onClick={() => { setStuck(false); onRetrySave(); }} className={`${LINK_BUTTON} mt-2`}>Try again</button> : null}
      </div>
    );
  } else if (waiting) {
    body = (
      <p className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-12 text-center text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" />Saving… the preview shows once it is saved.
      </p>
    );
  } else if (preview.html === null) {
    body = (
      <div role="alert" className="rounded-lg bg-white px-4 py-8 text-center text-sm text-red-700">
        <p>{preview.error}</p>
        <button type="button" onClick={preview.reload} className={`${LINK_BUTTON} mt-2`}>Try again</button>
      </div>
    );
  } else {
    // Sized to the email (the column scrolls, not the frame); pointer-events-none: links are off, as in the exact
    // preview, so a click never takes the frame away from the email.
    body = (
      <iframe ref={frameRef} title="HTML email preview" sandbox="allow-same-origin" srcDoc={preview.html} onLoad={fit}
        data-nl-html-document-preview="" style={{ height }} className="pointer-events-none block w-full border-0 bg-white" />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <p className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">
        Inbox
        {pasted && saved && (saving || preview.loading) ? (
          <span role="status" className="flex items-center gap-1.5 font-medium normal-case tracking-normal text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Updating…
          </span>
        ) : null}
      </p>
      <InboxRow fromName={draft.from_name.trim() || profile?.name?.trim().slice(0, 80) || ''} subject={draft.subject} previewText={draft.preview_text}
        initial={initialsFrom(profile?.name || draft.from_name).slice(0, 1)} photoUrl={profile?.photoUrl ?? null} color={profile?.color ?? null} />
      <div className={`bg-[#F3F4F8] ${phone ? 'px-2 py-5 sm:px-4' : 'px-2 py-6 sm:px-4'}`}>
        <div className={phone ? 'mx-auto w-[375px] max-w-full overflow-hidden rounded-[2rem] border-[6px] border-gray-900 bg-white' : 'overflow-hidden rounded-lg bg-white'}>
          {body}
        </div>
        {brokenNote ? (
          <div role="status" data-nl-html-broken-pictures="" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p className="font-medium">{brokenNote.title}</p>
            <ul className="mt-1 list-none space-y-0.5 break-all">
              {brokenNote.urls.map((url) => <li key={url}>{url}</li>)}
            </ul>
          </div>
        ) : null}
        {preview.error && preview.html !== null ? (
          <p role="alert" className="mt-3 text-center text-xs text-red-600">{preview.error} <button type="button" onClick={preview.reload} className={LINK_BUTTON}>Try again</button></p>
        ) : null}
      </div>
    </div>
  );
}
