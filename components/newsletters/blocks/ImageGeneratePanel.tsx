import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { newslettersAPI } from '../../../services/newslettersAPI';
import { IMAGE_CREDITS, IMAGE_PROMPT_MAX, imageGenerateError } from '../lib/imagePrompt';
import { BUTTON_SMALL, BUTTON_SMALL_PRIMARY, textareaClass } from '../lib/ui';

/**
 * "Generate image" (Chris, 13 Nov): an editable prompt (prefilled from the newsletter), Generate, then a preview with
 * Use image / Try again. The picture is already in our S3 when it shows; Use image puts it in the section. Problems
 * (no credits, a refused prompt, a failure) show under the prompt. An answer that arrives after the panel was closed
 * is dropped.
 */
export default function ImageGeneratePanel({ blockId, seed, onUse, onClose }: {
  blockId: string;
  seed: string;
  onUse(url: string): void;
  onClose(): void;
}) {
  const [prompt, setPrompt] = useState(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const askRef = useRef(0);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { fieldRef.current?.focus(); return () => { askRef.current += 1; }; }, []);

  const generate = async () => {
    const text = prompt.trim();
    if (busy) return;
    if (text.length < 3) { setError('Describe the image first.'); fieldRef.current?.focus(); return; }
    const ask = ++askRef.current;
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await newslettersAPI.generateImage(text);
    if (ask !== askRef.current) return;
    setBusy(false);
    const url = res.ok ? res.data?.url : '';
    if (url) setResult(url);
    else setError(imageGenerateError(res));
  };

  const errorId = `${blockId}-gen-error`;
  return (
    <div className="grid gap-2 rounded-lg border border-gray-200 bg-white p-3" data-testid={`${blockId}-gen-panel`}>
      <label htmlFor={`${blockId}-gen-prompt`} className="text-sm font-medium text-gray-900">Describe the image</label>
      <textarea id={`${blockId}-gen-prompt`} ref={fieldRef} rows={3} value={prompt} maxLength={IMAGE_PROMPT_MAX} disabled={busy}
        placeholder="e.g. Oak dining table in a bright room"
        aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
        onChange={(e) => { setPrompt(e.target.value); if (error) setError(null); }}
        className={`${textareaClass(!!error)} resize-y`} />
      {error ? <p id={errorId} role="alert" className="-mt-1 text-xs text-red-600">{error}</p> : null}

      {busy ? (
        <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-100 text-gray-500" aria-live="polite">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-xs">Creating… up to a minute</span>
        </div>
      ) : result ? (
        <img src={result} alt="" className="block w-full rounded-lg border border-gray-200" data-testid={`${blockId}-gen-result`} />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {result && !busy ? (
          <>
            <button type="button" onClick={() => onUse(result)} className={BUTTON_SMALL_PRIMARY}>Use image</button>
            <button type="button" onClick={() => { void generate(); }} className={BUTTON_SMALL}>Try again</button>
          </>
        ) : (
          <button type="button" onClick={() => { void generate(); }} disabled={busy} aria-busy={busy} className={BUTTON_SMALL_PRIMARY}>
            {busy ? 'Generating…' : 'Generate'}
          </button>
        )}
        <button type="button" onClick={onClose} className={BUTTON_SMALL}>Cancel</button>
        <span className="ml-auto text-xs text-gray-500">{IMAGE_CREDITS} AI credits</span>
      </div>
    </div>
  );
}
