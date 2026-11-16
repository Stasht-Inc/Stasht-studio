import { useCallback, useRef, useState, type ReactElement } from 'react';
import { Code } from 'lucide-react';
import type { HtmlBlockData } from '../../../services/newslettersAPI';
import { LABEL, textareaClass } from '../lib/ui';
import { useAutoGrow } from '../hooks/useAutoGrow';
import type { BlockEditorProps } from './types';

// The email's section text (emails/newsletter/body.blade.php's cell), so the preview reads like the email.
const FRAME_DOC = (html: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:26px;color:#374151;word-wrap:break-word;overflow-wrap:break-word;}
img{max-width:100%;height:auto;}
</style></head><body>${html}</body></html>`;

/**
 * The HTML section (Chris, 16 Nov 2026): Storeel's HTML block (MemoryDetailsPage "Add HTML": an "HTML Content" code box
 * with "Paste your HTML code here..." and a Preview under it), in the newsletter's inline-editor shape (the box opens
 * under the section when it is selected, like YouTube's link). The preview is the API's SAVED copy, cleaned for email
 * (NewsletterCustomHtml: no scripts, forms, iframes …), shown in a sandboxed frame that runs no scripts — so it shows
 * exactly what people will get, never the raw paste.
 */
export default function HtmlBlockEditor({ blockId, data, selected, readOnly, onChange, serverHtml }: BlockEditorProps<HtmlBlockData> & { serverHtml?: string }) {
  const boxRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(boxRef, data.html, 6, 16);
  const [height, setHeight] = useState(80);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Fit the frame to its content once it (and its pictures) have loaded.
  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) setHeight(Math.max(24, Math.ceil(doc.documentElement.scrollHeight)));
  }, []);

  const typed = data.html.trim() !== '';
  let preview: ReactElement;
  if (!typed) {
    preview = (
      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
        <Code className="h-6 w-6 text-[#6C60FF]" aria-hidden="true" />
        <p className="text-sm text-gray-600">{readOnly ? 'No HTML' : 'Paste your HTML below.'}</p>
      </div>
    );
  } else if (serverHtml === undefined) {
    preview = <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Saving… the preview shows once it is saved.</p>;
  } else if (serverHtml.trim() === '') {
    preview = <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">Nothing to show: email apps don’t run scripts, forms or embeds.</p>;
  } else {
    // pointer-events-none: a click selects the section (BlockFrame), as on every other section.
    preview = (
      <iframe ref={frameRef} title="HTML section preview" sandbox="allow-same-origin" srcDoc={FRAME_DOC(serverHtml)} onLoad={fit}
        data-nl-html-preview style={{ height }} className="pointer-events-none block w-full border-0 bg-transparent" />
    );
  }

  return (
    <div>
      {preview}
      {selected && !readOnly ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label htmlFor={`${blockId}-html`} className={LABEL}>HTML Content</label>
          <textarea id={`${blockId}-html`} ref={boxRef} value={data.html} spellCheck={false} placeholder="Paste your HTML code here..."
            aria-describedby={`${blockId}-html-help`} onChange={(e) => onChange({ html: e.target.value })}
            className={`${textareaClass()} resize-y font-mono`} />
          <p id={`${blockId}-html-help`} className="mt-1.5 text-xs text-gray-500">
            Scripts, forms, iframes and videos are removed — email apps don’t run them. The preview shows what people get.
          </p>
        </div>
      ) : null}
    </div>
  );
}
