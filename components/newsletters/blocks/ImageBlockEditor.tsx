import { useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import type { ImageBlockData } from '../../../services/newslettersAPI';
import { useImageUpload } from '../hooks/useImageUpload';
import { httpsUrl, toHttpsUrl } from '../lib/urls';
import { BUTTON_SMALL, LABEL, LINK_BUTTON, inputClass } from '../lib/ui';
import type { BlockEditorProps } from './types';
import { useUrlField } from './useUrlField';

const ALT_MAX = 200; // NewsletterContent::ALT_MAX

export default function ImageBlockEditor({ blockId, data, selected, readOnly, onChange }: BlockEditorProps<ImageBlockData>) {
  const { uploading, upload, choose, input } = useImageUpload((url) => onChange({ url }), `${blockId}-image-input`);
  const link = useUrlField(data.link ?? '', (next) => onChange({ link: next || null }), toHttpsUrl);
  const [pasteDraft, setPasteDraft] = useState('');
  const src = httpsUrl(data.url);
  const pasteInvalid = pasteDraft.trim() !== '' && toHttpsUrl(pasteDraft) === null;

  const applyPasted = () => {
    const value = toHttpsUrl(pasteDraft);
    if (value) { onChange({ url: value }); setPasteDraft(''); }
  };

  return (
    <div>
      {src ? (
        // As in the email (blocks/image.blade.php): full column width, rounded 8 px.
        <img src={src} alt={data.alt} className="block h-auto w-full rounded-lg" />
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
            <label htmlFor={`${blockId}-alt`} className={LABEL}>Describe the image (for screen readers)</label>
            <input id={`${blockId}-alt`} type="text" value={data.alt} maxLength={ALT_MAX} placeholder="e.g. Red Jeep Grand Cherokee in the showroom"
              onChange={(e) => onChange({ alt: e.target.value })} className={inputClass()} />
          </div>
          <div>
            <label htmlFor={`${blockId}-link`} className={LABEL}>Link when tapped (optional)</label>
            <input id={`${blockId}-link`} type="text" inputMode="url" value={link.draft} placeholder="https://yourwebsite.com" aria-invalid={link.invalid}
              onChange={(e) => link.change(e.target.value)} onBlur={link.blur} className={inputClass(link.invalid)} />
            {link.invalid ? <p role="alert" className="mt-1.5 text-xs text-red-600">Use a link that starts with https://.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
