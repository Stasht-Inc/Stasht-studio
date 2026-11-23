import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import type { RemovedItem } from '../../services/newslettersAPI';
import { DATA_PICTURES_HINT, HTML_TOO_LONG, OWN_UNSUBSCRIBE_NOTE, hasOwnUnsubscribe, imageTag, insertSnippet, removedSummary, switchedNote } from './lib/htmlMode';
import { useImageUpload } from './hooks/useImageUpload';
import { LIMITS } from './lib/rules';
import { previewSizeHint } from './lib/sendChecks';
import { formatCount } from './lib/audience';
import { BUTTON_SMALL, LABEL, textareaClass } from './lib/ui';

/**
 * Chris 22 Nov 2026 (Q4, "Edit as HTML"): the Content step in HTML mode. One large code box for a whole email template
 * (Mailchimp, Canva … exports, <html><head><style> included), with Storeel's HTML block words ("HTML Content",
 * "Paste your HTML code here..."). Saved as typed by autosave; the API cleans it when it draws the email, and the
 * preview beside it shows that. Under the box: what the cleaning removed, and the Gmail size hint (from the preview).
 *
 * Add image (Q4 follow-up): uploads a picture with the composer's own image upload (POST /newsletters/images, as the
 * Image section's "choose a file") and puts an <img> for it where the cursor is in the box (or at the end). It is typed
 * in with the browser's insertText where it can, so Undo (Cmd+Z) takes it out again. Problems show at the bottom of
 * the card. http pictures the API switched to https are noted; pictures it removed are listed.
 */
export default function HtmlDocumentStep({ value, readOnly, onChange, error, removed, sizeKb, switched = 0, removedPictures = [] }: {
  value: string;
  readOnly: boolean;
  onChange(value: string): void;
  /** A save the API refused for this box (content.html_document). */
  error?: string | null;
  removed: readonly RemovedItem[];
  sizeKb: number | null;
  /** http pictures switched to https (info). */
  switched?: number;
  /** Addresses of the pictures the cleaning removed. */
  removedPictures?: readonly string[];
}) {
  const boxRef = useRef<HTMLTextAreaElement>(null);
  // Where the cursor was when Add image was tapped (the file chooser takes the focus away).
  const caretRef = useRef<{ start: number; end: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const insertImage = (url: string) => {
    const box = boxRef.current;
    const tag = imageTag(url);
    const caret = caretRef.current;
    caretRef.current = null;
    if (box && !box.readOnly) {
      box.focus();
      if (caret) box.setSelectionRange(caret.start, caret.end);
      else box.setSelectionRange(box.value.length, box.value.length);
      const atEnd = !caret;
      const text = atEnd && box.value !== '' && !box.value.endsWith('\n') ? `\n${tag}` : tag;
      // insertText keeps the browser's undo history; it fires the input event React's onChange listens to.
      if (document.execCommand?.('insertText', false, text) && box.value.includes(tag)) return;
    }
    const next = insertSnippet(value, tag, caret?.start ?? null, caret?.end ?? null);
    onChange(next.value);
    window.requestAnimationFrame(() => boxRef.current?.setSelectionRange(next.cursor, next.cursor));
  };
  const upload = useImageUpload(insertImage, 'nl-html-image-input', setUploadError);
  const chooseImage = () => {
    const box = boxRef.current;
    caretRef.current = box && document.activeElement === box ? { start: box.selectionStart, end: box.selectionEnd } : null;
    upload.choose();
  };
  const switchedInfo = switchedNote(switched);
  const hasDataPictures = removed.some((r) => r.type === 'data' && r.count > 0);
  const tooLong = value.length > LIMITS.html_document;
  const message = tooLong ? HTML_TOO_LONG : error ?? null;
  const summary = removedSummary(removed);
  const sizeHint = previewSizeHint(sizeKb ?? undefined);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor="nl-html-document" className={LABEL}>HTML Content</label>
        {!readOnly ? (
          <button type="button" onClick={chooseImage} disabled={upload.uploading} aria-busy={upload.uploading}
            onMouseDown={(e) => e.preventDefault() /* keep the cursor in the box */} className={`${BUTTON_SMALL} mb-1.5 flex-shrink-0`}>
            {upload.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6C60FF]" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5 text-[#6C60FF]" aria-hidden="true" />}
            {upload.uploading ? 'Uploading…' : 'Add image'}
          </button>
        ) : null}
      </div>
      {upload.input}
      <p id="nl-html-document-hint" className="-mt-0.5 mb-1.5 text-xs text-gray-500">
        Paste a whole email from Mailchimp or Canva.
      </p>
      <textarea ref={boxRef} id="nl-html-document" value={value} readOnly={readOnly} spellCheck={false} autoCapitalize="off" autoCorrect="off" rows={16}
        placeholder="Paste your HTML code here..." aria-invalid={Boolean(message)} aria-describedby="nl-html-document-hint nl-html-document-help"
        onChange={(e) => onChange(e.target.value)}
        className={`${textareaClass(Boolean(message))} min-h-[12rem] resize-y font-mono text-xs leading-5 transition-shadow duration-300 data-[nl-flash]:ring-4 data-[nl-flash]:ring-[#6C60FF]/30`} />
      <div id="nl-html-document-help" className="mt-1.5 flex items-start justify-between gap-3 text-xs">
        <span role={message ? 'alert' : undefined} className={message ? 'text-red-600' : 'text-gray-500'}>
          {message ?? 'Scripts, forms and tracking pixels are removed — email apps don’t run them. The preview shows what people get.'}
        </span>
        <span className={`whitespace-nowrap ${tooLong ? 'text-red-600' : 'text-gray-500'}`}>{formatCount(value.length)} {value.length === 1 ? 'character' : 'characters'}</span>
      </div>
      {summary ? (
        <p role="status" data-nl-html-removed="" className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span className="font-medium text-gray-700">{summary.title}:</span> {summary.detail}.
          {removedPictures.length ? (
            <span data-nl-html-removed-pictures="" className="mt-1 block break-all text-gray-500">Pictures removed: {removedPictures.join(', ')}</span>
          ) : null}
          {hasDataPictures ? <span className="mt-1 block text-gray-600">{DATA_PICTURES_HINT}</span> : null}
        </p>
      ) : null}
      {hasOwnUnsubscribe(value) ? (
        <p role="status" data-nl-html-own-unsubscribe="" className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{OWN_UNSUBSCRIBE_NOTE}</p>
      ) : null}
      {switchedInfo ? (
        <p role="status" data-nl-html-switched="" className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{switchedInfo}.</p>
      ) : null}
      {sizeHint ? (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{sizeHint}</p>
      ) : null}
      {uploadError ? <p role="alert" data-nl-html-image-error="" className="mt-3 text-xs text-red-600">{uploadError}</p> : null}
    </div>
  );
}
