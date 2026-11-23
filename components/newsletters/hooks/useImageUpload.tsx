import { useCallback, useRef, useState } from 'react';
import { composerToast } from '../ComposerToaster';
import { newslettersAPI } from '../../../services/newslettersAPI';
import { PICK_ACCEPT, imageFileProblem, prepareImage } from '../lib/images';
import { httpsUrl } from '../lib/urls';

/** A hidden file input plus upload to /newsletters/images. Render `input` once; call `choose()` from a button.
 *  onError: show problems yourself (e.g. at the bottom of the card; called with null when an upload starts) instead of a toast. */
export function useImageUpload(onUploaded: (url: string) => void, testId?: string, onError?: (message: string | null) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const fail = (message: string) => (onErrorRef.current ? onErrorRef.current(message) : composerToast.error(message));

  // One upload at a time: a second file chosen or dropped while one is on its way is ignored.
  const busyRef = useRef(false);

  const upload = useCallback(async (picked: File) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setUploading(true);
    onErrorRef.current?.(null);
    // Phone photos: shrunk and saved as JPEG in the browser first (HEIC too, where the browser can open it).
    const prepared = await prepareImage(picked);
    const problem = 'error' in prepared ? prepared.error : imageFileProblem(prepared.file);
    if (problem || 'error' in prepared) {
      busyRef.current = false;
      setUploading(false);
      fail(problem ?? 'The image could not be uploaded. Try again.');
      return;
    }
    const res = await newslettersAPI.uploadImage(prepared.file);
    busyRef.current = false;
    setUploading(false);
    const url = res.ok ? httpsUrl(res.data?.url) : null;
    if (url) onUploadedRef.current(url);
    else fail(res.fieldErrors.file ?? res.error ?? 'The image could not be uploaded. Try again.');
  }, []);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={PICK_ACCEPT}
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      data-testid={testId}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void upload(file);
      }}
    />
  );

  return { uploading, upload, choose: () => inputRef.current?.click(), input };
}
