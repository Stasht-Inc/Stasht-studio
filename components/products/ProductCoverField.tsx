// components/products/ProductCoverField.tsx — "Cover photo (optional) or Intro Video (optional)" for products, the same
// look as Create Campaign's step 1 (CreateMemory.tsx). Chris 21 Nov 2026: products need an Intro Video.
// UI ONLY for now: the picked file is held in this component and not saved yet; it is wired to the API next.
import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Video, X } from 'lucide-react';

type Kind = 'photo' | 'video';
type Choice = { kind: Kind; name: string; previewUrl?: string } | null;

export default function ProductCoverField({ disabled = false }: { disabled?: boolean }) {
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState<Choice>(null);

  const pick = (kind: Kind, file: File | null | undefined) => {
    if (!file) return;
    if (choice?.previewUrl) URL.revokeObjectURL(choice.previewUrl);
    setChoice({ kind, name: file.name, previewUrl: kind === 'photo' ? URL.createObjectURL(file) : undefined });
  };
  const clear = () => {
    if (choice?.previewUrl) URL.revokeObjectURL(choice.previewUrl);
    setChoice(null);
  };

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3" data-testid="product-cover-field">
      <input ref={photoInput} type="file" accept="image/*" className="hidden" data-testid="product-cover-photo-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick('photo', f); }} />
      <input ref={videoInput} type="file" accept="video/*,video/quicktime,.mov,.mp4,.m4v" className="hidden" data-testid="product-intro-video-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick('video', f); }} />
      {(['photo', 'video'] as const).map((kind, i) => {
        const chosen = choice?.kind === kind;
        const label = kind === 'photo' ? 'Cover photo' : 'Intro Video';
        return (
          <React.Fragment key={kind}>
            {i === 1 && <span className="flex h-12 md:h-10 items-center text-sm text-gray-400" aria-hidden="true">or</span>}
            <div className="min-w-0">
              <label className="flex items-center gap-2 text-base md:text-sm font-medium text-gray-700 mb-1">
                {kind === 'photo' ? <ImageIcon className="w-4 h-4 text-black flex-shrink-0" /> : <Video className="w-4 h-4 text-black flex-shrink-0" />}
                <span className="truncate">{label}</span>
                <span className="hidden md:inline text-gray-400 font-normal">(optional)</span>
              </label>
              {chosen ? (
                <div className="flex h-12 md:h-10 items-center justify-between gap-2 px-3 border border-gray-200 rounded-lg bg-gray-50" data-testid={`product-cover-choice-${kind}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {kind === 'photo' && choice?.previewUrl
                      ? <img src={choice.previewUrl} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                      : <Video className="w-4 h-4 text-[#6C60FF] flex-shrink-0" />}
                    <span className="text-sm text-gray-700 truncate">{choice?.name}</span>
                  </div>
                  <button type="button" aria-label={`Remove ${label.toLowerCase()}`} onClick={clear} disabled={disabled}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button type="button" disabled={disabled}
                  onClick={() => (kind === 'photo' ? photoInput : videoInput).current?.click()}
                  className="w-full h-12 md:h-10 px-2 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors truncate disabled:opacity-50">
                  {kind === 'photo' ? 'Add Cover Photo' : 'Add Intro Video'}
                </button>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
