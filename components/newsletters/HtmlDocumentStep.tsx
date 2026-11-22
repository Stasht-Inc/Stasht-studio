import type { RemovedItem } from '../../services/newslettersAPI';
import { HTML_TOO_LONG, removedSummary } from './lib/htmlMode';
import { LIMITS } from './lib/rules';
import { previewSizeHint } from './lib/sendChecks';
import { formatCount } from './lib/audience';
import { LABEL, textareaClass } from './lib/ui';

/**
 * Chris 22 Nov 2026 (Q4, "Edit as HTML"): the Content step in HTML mode. One large code box for a whole email template
 * (Mailchimp, Canva … exports, <html><head><style> included), with Storeel's HTML block words ("HTML Content",
 * "Paste your HTML code here..."). Saved as typed by autosave; the API cleans it when it draws the email, and the
 * preview beside it shows that. Under the box: what the cleaning removed, and the Gmail size hint (from the preview).
 */
export default function HtmlDocumentStep({ value, readOnly, onChange, error, removed, sizeKb }: {
  value: string;
  readOnly: boolean;
  onChange(value: string): void;
  /** A save the API refused for this box (content.html_document). */
  error?: string | null;
  removed: readonly RemovedItem[];
  sizeKb: number | null;
}) {
  const tooLong = value.length > LIMITS.html_document;
  const message = tooLong ? HTML_TOO_LONG : error ?? null;
  const summary = removedSummary(removed);
  const sizeHint = previewSizeHint(sizeKb ?? undefined);
  return (
    <div>
      <label htmlFor="nl-html-document" className={LABEL}>HTML Content</label>
      <p id="nl-html-document-hint" className="-mt-0.5 mb-1.5 text-xs text-gray-500">
        Paste a whole email, for example from Mailchimp or Canva. Your footer with the unsubscribe link and business address is added at the bottom.
      </p>
      <textarea id="nl-html-document" value={value} readOnly={readOnly} spellCheck={false} autoCapitalize="off" autoCorrect="off" rows={16}
        placeholder="Paste your HTML code here..." aria-invalid={Boolean(message)} aria-describedby="nl-html-document-hint nl-html-document-help"
        onChange={(e) => onChange(e.target.value)}
        className={`${textareaClass(Boolean(message))} min-h-[12rem] resize-y font-mono text-xs leading-5`} />
      <div id="nl-html-document-help" className="mt-1.5 flex items-start justify-between gap-3 text-xs">
        <span role={message ? 'alert' : undefined} className={message ? 'text-red-600' : 'text-gray-500'}>
          {message ?? 'Scripts, forms and tracking pixels are removed — email apps don’t run them. The preview shows what people get.'}
        </span>
        <span className={`whitespace-nowrap ${tooLong ? 'text-red-600' : 'text-gray-500'}`}>{formatCount(value.length)} {value.length === 1 ? 'character' : 'characters'}</span>
      </div>
      {summary ? (
        <p role="status" data-nl-html-removed="" className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span className="font-medium text-gray-700">{summary.title}:</span> {summary.detail}.
        </p>
      ) : null}
      {sizeHint ? (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{sizeHint}</p>
      ) : null}
    </div>
  );
}
