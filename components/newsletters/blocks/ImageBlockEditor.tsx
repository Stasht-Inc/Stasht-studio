import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { newslettersAPI } from '../../../services/newslettersAPI';
import type { ImageBlockData } from '../../../services/newslettersAPI';
import { useImageUpload } from '../hooks/useImageUpload';
import { httpsUrl, toHttpsUrl } from '../lib/urls';
import { BUTTON_SMALL, LABEL, LINK_BUTTON, inputClass } from '../lib/ui';
import type { BlockEditorProps } from './types';
import { useUrlField } from './useUrlField';
import { smallImageWidth } from '../lib/imageWidth';

const ALT_MAX = 200; // NewsletterContent::ALT_MAX

/** padClass: the email column's side padding. With a picture the section is full-bleed (BlockFrame bleed), so only the
 *  controls under the picture take it. */
export default function ImageBlockEditor({ blockId, data, selected, readOnly, onChange, padClass = '' }: BlockEditorProps<ImageBlockData> & { padClass?: string }) {
  // A picture chosen here (uploaded or pasted) is measured once it loads: narrower than the card, it keeps its own width
  // (lib/imageWidth.ts). A new picture drops the old one's width until then. Pictures saved before are never measured
  // (opening a draft changes nothing), so they stay full-bleed.
  const measureRef = useRef<string | null>(null);
  const choosePicture = (url: string) => { measureRef.current = url; onChange({ url, width: undefined }); };
  const { uploading, upload, choose, input } = useImageUpload(choosePicture, `${blockId}-image-input`);
  const link = useUrlField(data.link ?? '', (next) => onChange({ link: next || null }), toHttpsUrl);
  const [pasteDraft, setPasteDraft] = useState('');
  const src = httpsUrl(data.url);
  const pasteInvalid = pasteDraft.trim() !== '' && toHttpsUrl(pasteDraft) === null;
  const alt = useAiAltText(src, (text) => onChange({ alt: text }));

  const applyPasted = () => {
    const value = toHttpsUrl(pasteDraft);
    if (value) { choosePicture(value); setPasteDraft(''); }
  };

  return (
    <div>
      {src ? (
        // As in the email (image-row.blade.php, Chris 6 Nov): edge to edge across the section, at the picture's own
        // height, square corners, nothing over it.
        // Never selectable or draggable: a text selection across the canvas (Cmd+A, a drag over sections) used to paint the
        // browser's highlight over the picture as a square lavender frame and a blue cast (Chris's 179/180 screenshots).
        <img src={src} alt={data.alt} data-nl-image="" draggable={false}
          onLoad={(e) => {
            if (measureRef.current !== src) return;
            measureRef.current = null;
            const width = smallImageWidth(e.currentTarget.naturalWidth);
            if (width !== data.width) onChange({ width });
          }}
          style={data.width ? { maxWidth: `${data.width}px` } : undefined}
          className={`block h-auto w-full select-none ${data.width ? 'mx-auto' : ''}`} />
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center"
          onDragOver={(e) => { if (!readOnly) e.preventDefault(); }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && !readOnly) void upload(file);
          }}
        >
          {uploading ? <Loader2 className="h-6 w-6 animate-spin text-[#6C60FF]" aria-hidden="true" /> : <ImageIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />}
          <p className="text-sm text-gray-600" aria-live="polite">{uploading ? 'Uploading…' : readOnly ? 'No image' : 'Drop an image here, or'}</p>
          {!uploading && !readOnly ? <button type="button" onClick={choose} className={LINK_BUTTON}>choose a file</button> : null}
          {!readOnly ? <p className="text-xs text-gray-500">JPG, PNG, GIF or WebP, up to 5 MB</p> : null}
        </div>
      )}
      {input}
      {selected && !readOnly ? (
        <div className={src ? padClass : undefined}>
        <div className="mt-3 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {src ? (
            <div><button type="button" onClick={choose} disabled={uploading} className={BUTTON_SMALL}>{uploading ? 'Uploading…' : 'Replace image'}</button></div>
          ) : (
            <div>
              <label htmlFor={`${blockId}-paste`} className={LABEL}>Or paste an image link</label>
              <div className="flex gap-2">
                <input id={`${blockId}-paste`} type="text" inputMode="url" value={pasteDraft} placeholder="https://…" aria-invalid={pasteInvalid}
                  onChange={(e) => setPasteDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPasted(); } }}
                  className={inputClass(pasteInvalid)} />
                <button type="button" onClick={applyPasted} disabled={!pasteDraft.trim() || pasteInvalid} className={`${BUTTON_SMALL} h-9 flex-shrink-0`}>Use</button>
              </div>
              {pasteInvalid ? <p role="alert" className="mt-1.5 text-xs text-red-600">Use a link that starts with https://.</p> : null}
            </div>
          )}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor={`${blockId}-alt`} className="min-w-0 text-sm font-medium text-gray-900">Describe the image (for screen readers)</label>
              {/* The moment "AI suggest" (AddMomentModal): sparkle + gradient words, 1 AI credit (Chris, 10 Nov). */}
              <button type="button" onClick={alt.suggest} disabled={!src || alt.busy || uploading} aria-busy={alt.busy}
                data-testid={`${blockId}-alt-ai`}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded text-sm disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C60FF]/40">
                {alt.busy ? <Loader2 className="h-4 w-4 animate-spin text-[#6C60FF]" aria-hidden="true" /> : <Sparkles className="h-4 w-4 text-[#6C60FF]" aria-hidden="true" />}
                <span style={AI_WORDS}>{alt.busy ? 'Suggesting…' : 'AI suggest'}</span>
              </button>
            </div>
            <input id={`${blockId}-alt`} type="text" value={data.alt} maxLength={ALT_MAX} placeholder="e.g. Red Jeep Grand Cherokee in the showroom"
              aria-invalid={alt.error ? true : undefined} aria-describedby={alt.error ? `${blockId}-alt-error` : undefined}
              onChange={(e) => { alt.clearError(); onChange({ alt: e.target.value }); }} className={inputClass(!!alt.error)} />
            {alt.error ? <p id={`${blockId}-alt-error`} role="alert" className="mt-1.5 text-xs text-red-600">{alt.error}</p> : null}
          </div>
          <div>
            <label htmlFor={`${blockId}-link`} className={LABEL}>Link when tapped (optional)</label>
            <input id={`${blockId}-link`} type="text" inputMode="url" value={link.draft} placeholder="https://yourwebsite.com" aria-invalid={link.invalid}
              onChange={(e) => link.change(e.target.value)} onBlur={link.blur} className={inputClass(link.invalid)} />
            {link.invalid ? <p role="alert" className="mt-1.5 text-xs text-red-600">Use a link that starts with https://.</p> : null}
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}

const AI_WORDS = {
  background: 'linear-gradient(90deg, rgb(108, 96, 255) 0%, rgb(255, 81, 226) 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
} as const;

/** "AI suggest" for the alt text: writes it from the picture (POST /newsletters/images/alt-text, 1 AI credit). The answer
 *  fills the field (still editable); a problem shows under the field. An answer for a picture that has since been
 *  replaced is dropped. */
function useAiAltText(src: string | null, fill: (text: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const srcRef = useRef(src);
  srcRef.current = src;
  const fillRef = useRef(fill);
  fillRef.current = fill;
  useEffect(() => { setError(null); }, [src]);

  const suggest = async () => {
    if (!src || busy) return;
    const asked = src;
    setBusy(true);
    setError(null);
    const res = await newslettersAPI.imageAltText(asked);
    setBusy(false);
    if (srcRef.current !== asked) return;
    const text = res.ok ? res.data?.alt?.trim() : '';
    if (text) { fillRef.current(text); return; }
    setError(res.code === 'no_credits' || res.status === 402
      ? (res.error || "You're out of AI credits. Add more to use AI suggest.")
      : res.planRequired ? (res.error || 'Newsletters are available on paid plans.')
      : res.rateLimited ? (res.error || 'Too many requests. Wait a minute and try again.')
      : (res.ok ? '' : res.error) || "We couldn't describe this image. Try again, or type a description.");
  };

  return { busy, error, suggest: () => { void suggest(); }, clearError: () => setError(null) };
}
