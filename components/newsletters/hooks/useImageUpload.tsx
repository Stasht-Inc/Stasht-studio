import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { newslettersAPI } from '../../../services/newslettersAPI';
import { IMAGE_ACCEPT, imageFileProblem } from '../lib/images';
import { httpsUrl } from '../lib/urls';

/** A hidden file input plus upload to /newsletters/images. Render `input` once; call `choose()` from a button. */
export function useImageUpload(onUploaded: (url: string) => void, testId?: string) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const upload = useCallback(async (file: File) => {
    const problem = imageFileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setUploading(true);
    const res = await newslettersAPI.uploadImage(file);
    setUploading(false);
    const url = res.ok ? httpsUrl(res.data?.url) : null;
    if (url) onUploadedRef.current(url);
    else toast.error(res.fieldErrors.file ?? res.error ?? 'The image could not be uploaded. Try again.');
  }, []);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_ACCEPT}
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
