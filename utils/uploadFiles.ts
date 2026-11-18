// Photos and videos picked for an upload (Chris, 19 Nov 2026: "make this mac compatible").
//
// iPhone / Mac Photos pictures are HEIC. Only Safari can show a HEIC, and the web API's image steps (cover check, GD
// compression) can't read one unless the server has a HEIC-capable ImageMagick — not guaranteed on Plesk. So every
// Studio photo upload turns a HEIC into a JPEG in the browser first (heic-to, loaded only when a HEIC is picked).
//
// iPhone videos are QuickTime .mov, often HEVC. Chrome can't always read their length from <video> metadata, which
// used to stop the cover upload with "Unable to validate video duration". The length is now checked when the browser
// can read it; when it can't, the upload goes ahead and the web API checks it (ffprobe) instead.

const HEIC_EXTENSIONS = ['heic', 'heif', 'hif'];
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v', '3gp', '3g2', 'webm', 'mkv', 'avi', 'mpeg', 'mpg', 'qt'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'avif', ...HEIC_EXTENSIONS];

const DESKTOP_IMAGE_ACCEPT = 'image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.gif,.webp';
const DESKTOP_MEDIA_ACCEPT = `${DESKTOP_IMAGE_ACCEPT},video/*,video/quicktime,video/mp4,.mov,.mp4,.m4v,.3gp`;

/** An iPhone / iPad (iPadOS says "MacIntel" but has touch). */
export function isIosDevice(device: { userAgent?: string; platform?: string; maxTouchPoints?: number } | undefined): boolean {
  if (!device) return false;
  return /iPad|iPhone|iPod/.test(device.userAgent ?? '') || (device.platform === 'MacIntel' && (device.maxTouchPoints ?? 0) > 1);
}

/**
 * `accept` for a photo picker / a photo-or-video picker. On a Mac / PC image/* alone can grey out HEIC (and .mov) in
 * the file picker, so HEIC/HEIF and QuickTime are named. On an iPhone/iPad it stays image/* (video/*): iOS then
 * hands over a JPEG instead of the HEIC — less to convert.
 */
export function imageAcceptFor(device?: { userAgent?: string; platform?: string; maxTouchPoints?: number }): string {
  return isIosDevice(device) ? 'image/*' : DESKTOP_IMAGE_ACCEPT;
}
export function mediaAcceptFor(device?: { userAgent?: string; platform?: string; maxTouchPoints?: number }): string {
  return isIosDevice(device) ? 'image/*,video/*' : DESKTOP_MEDIA_ACCEPT;
}
const thisDevice = typeof navigator !== 'undefined' ? navigator : undefined;
export const IMAGE_ACCEPT = imageAcceptFor(thisDevice);
export const MEDIA_ACCEPT = mediaAcceptFor(thisDevice);
/** Cover videos may be up to 2 minutes (checked here when the browser can read the length, else by the web API). */
export const MAX_COVER_VIDEO_SECONDS = 120;
/** JPEG quality for a converted HEIC. */
export const HEIC_JPEG_QUALITY = 0.9;

type FileLike = { name: string; type: string };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** A HEIC/HEIF photo — by type, or by extension (some browsers give HEIC an empty or octet-stream type). */
export function isHeicFile(file: FileLike): boolean {
  const type = (file.type || '').toLowerCase();
  if (HEIC_TYPES.includes(type)) return true;
  if (type && type !== 'application/octet-stream' && !type.startsWith('image/')) return false;
  return HEIC_EXTENSIONS.includes(extensionOf(file.name));
}

/** A video — by type, or by extension when the browser gave no type. */
export function isVideoFile(file: FileLike): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return true;
  if (type && type !== 'application/octet-stream') return false;
  return VIDEO_EXTENSIONS.includes(extensionOf(file.name));
}

/** A photo — by type, or by extension when the browser gave no type (HEIC included). */
export function isImageFile(file: FileLike): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  if (type && type !== 'application/octet-stream') return false;
  return IMAGE_EXTENSIONS.includes(extensionOf(file.name));
}

/** "IMG_2901.HEIC" → "IMG_2901.jpg". */
export function jpegFileName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '');
  return `${base || 'photo'}.jpg`;
}

export class UploadFileError extends Error {}

export const HEIC_CONVERT_FAILED = "This photo couldn't be opened. Please try another photo.";

type HeicConverter = (args: { blob: Blob; type: 'image/jpeg'; quality: number }) => Promise<Blob>;

let converterForTests: HeicConverter | null = null;
/** Tests only: stand in for heic-to (it needs a browser with WebAssembly + OffscreenCanvas). */
export function setHeicConverterForTests(converter: HeicConverter | null): void {
  converterForTests = converter;
}

async function loadConverter(): Promise<HeicConverter> {
  if (converterForTests) return converterForTests;
  const mod = await import('heic-to');
  return mod.heicTo as HeicConverter;
}

/** A HEIC/HEIF photo as a JPEG File (same name, .jpg). Throws UploadFileError when it can't be decoded. */
export async function convertHeicToJpeg(file: File): Promise<File> {
  let blob: Blob;
  try {
    const heicTo = await loadConverter();
    blob = await heicTo({ blob: file, type: 'image/jpeg', quality: HEIC_JPEG_QUALITY });
  } catch (error) {
    console.error('HEIC conversion failed:', file.name, error);
    throw new UploadFileError(HEIC_CONVERT_FAILED);
  }
  if (!blob || blob.size === 0) throw new UploadFileError(HEIC_CONVERT_FAILED);
  return new File([blob], jpegFileName(file.name), { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
}

/** What every photo upload sends: a HEIC/HEIF becomes a JPEG; anything else goes as it is. */
export async function prepareImageForUpload<T extends File | Blob | null | undefined>(file: T): Promise<T | File> {
  if (!file || !(file instanceof File)) return file;
  if (!isHeicFile(file)) return file;
  return convertHeicToJpeg(file);
}

/** prepareImageForUpload for a list (keeps the order; videos and other files go as they are). */
export async function prepareImagesForUpload(files: readonly File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) out.push(await prepareImageForUpload(file));
  return out;
}

/**
 * A video's length in seconds, or null when this browser can't read it (an HEVC .mov in Chrome, a codec it doesn't
 * have, a file that never reports metadata) — never throws, never hangs (gives up after `timeoutMs`).
 */
export function readVideoDuration(file: Blob, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      resolve(null);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    let url = '';
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      try { video.load(); } catch { /* nothing to stop */ }
      if (url) URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    video.onloadedmetadata = () => {
      const d = video.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => finish(null);
    try {
      url = URL.createObjectURL(file);
      video.src = url;
    } catch {
      finish(null);
    }
  });
}

/** The "too long" message for a cover video, or null when it's fine or its length is unknown (the web API checks). */
export function coverVideoTooLongMessage(durationSeconds: number | null, maxSeconds = MAX_COVER_VIDEO_SECONDS): string | null {
  if (durationSeconds == null || !(durationSeconds > maxSeconds)) return null;
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `Video is too long (${minutes}m ${seconds}s). Maximum duration is ${Math.round(maxSeconds / 60)} minutes.`;
}

/**
 * A photo picked into a form (shown now, uploaded later): HEIC/HEIF → JPEG so the preview shows and the upload works.
 * null when nothing was picked or it couldn't be converted (onError gets the message to show).
 */
export async function toUploadableImage(picked: File | null | undefined, onError?: (message: string) => void): Promise<File | null> {
  if (!picked) return null;
  try {
    return (await prepareImageForUpload(picked)) as File;
  } catch (error) {
    onError?.(error instanceof UploadFileError ? error.message : HEIC_CONVERT_FAILED);
    return null;
  }
}
