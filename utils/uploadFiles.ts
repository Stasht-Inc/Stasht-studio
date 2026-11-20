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

export const PHOTO_READ_FAILED = "This photo couldn't be read. Please pick it again.";
export const VIDEO_READ_FAILED = "This video couldn't be read. Please pick it again.";
/** The "couldn't be read" message for this pick (a video says video). */
export function readFailedMessage(file: FileLike | null | undefined): string {
  return file && isVideoFile(file) ? VIDEO_READ_FAILED : PHOTO_READ_FAILED;
}
/**
 * Picks up to this size are copied into memory (Chris 20 Nov 2026: Mac Photos videos). The web API takes videos up to
 * 500 MB (memories/upload-video max:512000 KB); a bigger file goes as it is (the web API refuses it with its own message).
 */
export const MAX_IN_MEMORY_BYTES = 500 * 1024 * 1024;

/**
 * The picked file copied into memory (Chris 19 Nov 2026, Mac Photos). A photo picked from the Photos section of the Mac
 * file window is a file macOS writes at that moment (a HEIC comes out as a JPEG; an iCloud photo is downloaded first).
 * When it changes after Chrome has looked at it, Chrome won't send it: the upload request just fails ("Failed to upload
 * cover photo") after the web API already said OK. Reading it once, right after the pick, gives a copy that can't
 * change; `reread` (a fresh copy from the file handle, Chrome's new picker) is tried again for up to ~5 s.
 */
export async function materializeFile(
  file: File,
  reread?: () => Promise<File>,
  attempts = 10,
  waitMs = 500,
): Promise<File> {
  let current = file;
  for (let i = 0; i < Math.max(1, attempts); i++) {
    try {
      const bytes = await current.arrayBuffer();
      if (bytes.byteLength > 0 || current.size === 0) {
        return new File([bytes], current.name, { type: current.type, lastModified: current.lastModified || Date.now() });
      }
    } catch (error) {
      console.warn('Picked file not readable yet:', current.name, error);
    }
    if (!reread) break;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    try { current = await reread(); } catch { break; }
  }
  throw new UploadFileError(readFailedMessage(file));
}

/** Copy a picked file (photo or video) into memory once, without any retry source (the classic file input). */
const materialized = new WeakSet<File>();
export async function ensureInMemory(file: File): Promise<File> {
  if (materialized.has(file)) return file;
  if (file.size > MAX_IN_MEMORY_BYTES) return file; // too big to hold in memory: sent as it is
  const copy = await materializeFile(file);
  materialized.add(copy);
  return copy;
}
/** Marks a File as already in memory (from pickFiles), so it isn't copied twice. */
export function markInMemory(file: File): File {
  materialized.add(file);
  return file;
}

/**
 * What every upload sends: every photo AND video is copied into memory first (a Mac Photos pick is written by macOS at
 * pick time and Chrome won't send it once it changed — Chris 19/20 Nov 2026); a HEIC/HEIF photo becomes a JPEG.
 */
export async function prepareImageForUpload<T extends File | Blob | null | undefined>(file: T): Promise<T | File> {
  if (!file || !(file instanceof File)) return file;
  const copy = await ensureInMemory(file);
  if (isVideoFile(copy)) return copy;
  if (!isHeicFile(copy)) return copy;
  return convertHeicToJpeg(copy);
}

type PickerHandle = { getFile: () => Promise<File> };
type OpenFilePicker = (options: {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<PickerHandle[]>;

/**
 * Studio opened as the installed app (its own window, not a browser tab). Deepak 19 Nov 2026: in the installed app on a
 * Mac, a photo from Photos picked with showOpenFilePicker could never be read (NotReadableError on every re-read),
 * while the same photo read fine in a Chrome tab with either picker — so the installed app keeps the file input.
 */
export function isInstalledApp(win: any = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win) return false;
  if (win.navigator?.standalone === true) return true;
  const mm = typeof win.matchMedia === 'function' ? win.matchMedia.bind(win) : null;
  if (!mm) return false;
  return ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'].some((mode) => {
    try { return mm(`(display-mode: ${mode})`).matches; } catch { return false; }
  });
}

/** Chrome / Edge in a browser tab on a computer: the file window whose files can be read again. */
export function canUseHandlePicker(win: any = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win || typeof win.showOpenFilePicker !== 'function') return false;
  if (win.self !== win.top) return false; // not allowed in iframes
  if (isInstalledApp(win)) return false;
  return !isIosDevice(win.navigator) && !/Android/i.test(win.navigator?.userAgent ?? '');
}

const PICKER_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
const PICKER_VIDEO_EXTS = ['.mov', '.mp4', '.m4v', '.3gp', '.webm'];

/**
 * Open the file window and return the picked files, copied into memory. Chrome / Edge on a computer use the picker
 * whose files can be re-read (so a Mac Photos pick that is still being written is read again, see materializeFile);
 * other browsers use a normal file input. [] = cancelled. Throws UploadFileError when a pick can't be read.
 */
export async function pickFiles(opts: { kind: 'image' | 'media'; multiple?: boolean; win?: any; doc?: Document }): Promise<File[]> {
  const win = opts.win ?? (typeof window !== 'undefined' ? window : undefined);
  if (canUseHandlePicker(win)) {
    const types = [{ description: opts.kind === 'media' ? 'Photos and videos' : 'Photos', accept: {
      'image/*': PICKER_IMAGE_EXTS,
      ...(opts.kind === 'media' ? { 'video/*': PICKER_VIDEO_EXTS } : {}),
    } }];
    let handles: PickerHandle[];
    try {
      handles = await (win.showOpenFilePicker as OpenFilePicker)({ multiple: !!opts.multiple, types });
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      return pickWithInput(opts); // picker refused (policy, no user gesture…): the normal file input instead
    }
    const out: File[] = [];
    for (const handle of handles) {
      const first = await handle.getFile();
      // Photos AND videos (a Photos video is written at pick time too) are read into memory, re-read when needed.
      out.push(first.size > MAX_IN_MEMORY_BYTES ? first : markInMemory(await materializeFile(first, () => handle.getFile())));
    }
    return out;
  }
  return pickWithInput(opts);
}

function pickWithInput(opts: { kind: 'image' | 'media'; multiple?: boolean; doc?: Document }): Promise<File[]> {
  const doc = opts.doc ?? document;
  return new Promise((resolve, reject) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = opts.kind === 'media' ? MEDIA_ACCEPT : IMAGE_ACCEPT;
    input.multiple = !!opts.multiple;
    input.style.display = 'none';
    let done = false;
    const cleanup = () => { if (input.parentNode) input.parentNode.removeChild(input); };
    input.onchange = async () => {
      done = true;
      const files = Array.from(input.files ?? []);
      cleanup();
      try {
        const out: File[] = [];
        for (const f of files) out.push(await ensureInMemory(f)); // photos and videos (Chris 20 Nov 2026)
        resolve(out);
      } catch (error) {
        reject(error);
      }
    };
    input.addEventListener('cancel', () => { if (!done) { cleanup(); resolve([]); } });
    doc.body.appendChild(input);
    input.click();
  });
}

/** prepareImageForUpload for a list (keeps the order; every file read into memory, HEIC → JPEG). */
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
