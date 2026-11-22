import { useCallback, useRef, useState } from 'react';
import { Code, Loader2 } from 'lucide-react';
import type { NewsletterDraft } from './lib/draft';
import { initialsFrom, type SenderProfile } from './lib/profile';
import type { HtmlDocumentPreviewState } from './hooks/useHtmlDocumentPreview';
import type { PreviewDevice } from './DeviceToggle';
import InboxRow from './InboxRow';
import { LINK_BUTTON } from './lib/ui';

/**
 * Chris 22 Nov 2026 (Q4): the EMAIL PREVIEW in HTML mode, in the editor's frame (Inbox line, grey page, phone frame for
 * Phone view). It shows the API's own email (the cleaned template with our footer and unsubscribe link, fetched after
 * each save: useHtmlDocumentPreview) in a frame that runs no scripts, sized to its content. Nothing is edited here.
 */
export default function HtmlDocumentPreview({ draft, profile, device, preview, saved, saving }: {
  draft: NewsletterDraft;
  profile: SenderProfile | null;
  device: PreviewDevice;
  preview: HtmlDocumentPreviewState;
  /** The draft exists on the server (the preview is drawn from the saved copy). */
  saved: boolean;
  /** A save is on its way: the preview is about to change. */
  saving: boolean;
}) {
  const phone = device === 'phone';
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  // Fit the frame to the email once it (and its pictures) have loaded.
  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) setHeight(Math.max(240, Math.ceil(doc.documentElement.scrollHeight)));
  }, []);
  const pasted = draft.content.html_document.trim() !== '';

  let body;
  if (!pasted) {
    body = (
      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-white px-4 py-12 text-center">
        <Code className="h-6 w-6 text-[#6C60FF]" aria-hidden="true" />
        <p className="text-sm text-gray-600">Paste your HTML to see your email here.</p>
      </div>
    );
  } else if (!saved || (preview.html === null && !preview.error)) {
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
        {preview.error && preview.html !== null ? (
          <p role="alert" className="mt-3 text-center text-xs text-red-600">{preview.error} <button type="button" onClick={preview.reload} className={LINK_BUTTON}>Try again</button></p>
        ) : null}
      </div>
    </div>
  );
}
