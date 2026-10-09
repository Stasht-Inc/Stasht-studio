import type { AlvinAttachmentInfo } from '../../services/alvinAPI';

// Files people can give Alvin (mirrors app/Services/Alvin/AlvinFiles.php in the web API, which
// checks again from the file's bytes). Photos up to 10 MB are accepted here because shrinkImage()
// makes them smaller before sending; the server's 5 MB image limit applies to what arrives.
export const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const DOC_EXT = ['pdf', 'docx', 'csv', 'txt', 'md'];

export const ACCEPT = [...IMAGE_EXT, ...DOC_EXT].map((e) => `.${e}`).join(',');
export const SUPPORTED = 'Alvin can read images (JPG, PNG, GIF, WebP), PDF, Word (.docx), CSV and text files.';

const ext = (name: string) => (name.split('.').pop() || '').toLowerCase();
export const isImageFile = (f: File) => IMAGE_EXT.includes(ext(f.name));

/** Why these files can't be sent (alongside `existing`), or null when they're fine. */
export function fileProblem(files: File[], existing = 0): string | null {
  if (files.length + existing > MAX_FILES) return `You can attach up to ${MAX_FILES} files at a time.`;
  for (const f of files) {
    const e = ext(f.name);
    if (!IMAGE_EXT.includes(e) && !DOC_EXT.includes(e)) return `“${f.name}” can't be read. ${SUPPORTED}`;
    if (f.size > MAX_BYTES) return `“${f.name}” is larger than 10 MB.`;
  }
  return null;
}

/**
 * Photos are made smaller before they're sent (longest side 2048 px, JPEG): phone photos are often
 * 4–8 MB, and the AI doesn't need more. GIFs and images already small enough are sent as they are.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!isImageFile(file) || ext(file.name) === 'gif' || file.size <= 1.5 * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function attachmentInfo(f: File): AlvinAttachmentInfo {
  return { name: f.name, mime: f.type, size: f.size, kind: isImageFile(f) ? 'image' : 'document' };
}

function FileIcon({ image, className }: { image: boolean; className?: string }) {
  return image ? (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
    </svg>
  ) : (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

/** A sent file inside the user's bubble (prototype: icon, name, size). Images show their preview when we still have it. */
export function SentFile({ info, preview }: { info: AlvinAttachmentInfo; preview?: string }) {
  if (info.kind === 'image' && preview) {
    return <img src={preview} alt={info.name} className="block max-w-[200px] max-h-[180px] rounded-[9px] object-cover" />;
  }
  return (
    <div className="flex items-center gap-[8px] min-w-0">
      <FileIcon image={info.kind === 'image'} className="shrink-0 text-white/90" />
      <div className="min-w-0">
        <p className="font-semibold leading-[17px] truncate">{info.name}</p>
        <p className="text-[11px] leading-[14px] text-white/80">{sizeLabel(info.size)}</p>
      </div>
    </div>
  );
}

/** A file waiting to be sent, above the message box. */
export function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-[6px] max-w-full h-[28px] pl-[8px] pr-[4px] rounded-[8px] bg-white border border-[#e0deff] text-[11.5px] text-[#1e2939]">
      <FileIcon image={isImageFile(file)} className="shrink-0 text-[#6c60ff]" />
      <span className="truncate max-w-[150px]">{file.name}</span>
      <span className="text-[#99a1af] shrink-0">{sizeLabel(file.size)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="size-[20px] flex items-center justify-center rounded-[6px] text-[#99a1af] hover:bg-[#f4f3ff] hover:text-[#1e2939] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </span>
  );
}

/** "Drop to send" over the whole panel while files are dragged over it (Chris's prototype). */
export function DropOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-[10px] bg-white/70 backdrop-blur-[3px] border-2 border-dashed border-[#8b7bff] md:rounded-[16px] pointer-events-none">
      <div className="size-[56px] rounded-[14px] flex items-center justify-center shadow-md" style={{ backgroundImage: 'linear-gradient(135deg, #ff60e0 0%, #6c60ff 100%)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-[#6c60ff]">Drop to send</p>
      <p className="text-[12px] text-[#99a1af]">Images and files supported</p>
    </div>
  );
}
