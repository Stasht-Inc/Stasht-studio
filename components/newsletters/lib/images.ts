// Same rules as POST /newsletters/images (spec §8): jpg/png/gif/webp, at most 5 MB. Checked before uploading.
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** What the picker offers. HEIC is left out on purpose: iPhones then hand over a JPEG. A HEIC dropped from a desktop
 *  is still turned into JPEG where the browser can open it (prepareImage). */
export const PICK_ACCEPT = IMAGE_ACCEPT;
/** The email is 600 px wide; 1600 px stays sharp on high-density screens and keeps emails light. */
export const MAX_IMAGE_SIDE = 1600;
/** Photos heavier than this are saved again as JPEG even when they are small enough on screen. */
export const REENCODE_ABOVE_BYTES = 1024 * 1024;
const JPEG_QUALITY = 0.85;

export const HEIC_UNSUPPORTED = "This browser can't open HEIC photos. Save the photo as a JPG and try again.";
export const IMAGE_UNREADABLE = "This picture couldn't be opened. Try a JPG or PNG image.";

export function imageFileProblem(file: { type: string; size: number }): string | null {
  if (!IMAGE_ACCEPT.split(',').includes(file.type)) return 'Use a JPG, PNG, GIF or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images can be up to 5 MB. Choose a smaller one.';
  return null;
}

export function isHeic(file: { type: string; name?: string }): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name ?? '');
}

export type ImagePlan = { action: 'keep' } | { action: 'reencode'; type: 'image/jpeg' | 'image/png' | 'image/webp'; width: number; height: number };

/**
 * What to do with a picked picture before uploading. Phone photos (big JPEGs, HEIC) are shrunk to at most
 * MAX_IMAGE_SIDE and saved as JPEG. PNGs stay PNG (logos keep a see-through background) and are only shrunk.
 * GIFs are left alone (they may move).
 */
export function planImage(file: { type: string; size: number; name?: string }, size: { width: number; height: number }, hasAlpha = false): ImagePlan {
  const type = file.type.toLowerCase();
  if (type === 'image/gif') return { action: 'keep' };
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(size.width, size.height, 1));
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  if (type === 'image/png') return scale < 1 ? { action: 'reencode', type: 'image/png', width, height } : { action: 'keep' };
  // A WebP with see-through parts keeps them (stays WebP; JPEG would turn them white).
  const big = scale < 1 || file.size > REENCODE_ABOVE_BYTES;
  if (type === 'image/webp' && hasAlpha) return big ? { action: 'reencode', type: 'image/webp', width, height } : { action: 'keep' };
  if (isHeic(file) || scale < 1 || file.size > REENCODE_ABOVE_BYTES) return { action: 'reencode', type: 'image/jpeg', width, height };
  return { action: 'keep' };
}

/** True when any sampled pixel is at least partly see-through (about 4,000 samples, whatever the size). */
function canvasHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, width, height).data;
    const step = Math.max(1, Math.floor((width * height) / 4000)) * 4;
    for (let i = 3; i < data.length; i += step) if (data[i] < 255) return true;
  } catch {
    // A tainted or too large canvas: treat as solid.
  }
  return false;
}

/** The picture, upright (EXIF rotation applied), optionally resized by the browser at high quality. */
async function decode(file: File, size?: { width: number; height: number }): Promise<ImageBitmap> {
  const resize = size ? { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: 'high' as const } : {};
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image', ...resize });
  } catch {
    // Older browsers don't take the options (they apply EXIF rotation by themselves).
    return createImageBitmap(file);
  }
}

/** Browser only: shrink / re-save a picked picture as planImage says. Never throws. */
export async function prepareImage(file: File): Promise<{ file: File } | { error: string }> {
  const heic = isHeic(file);
  if (!heic && !IMAGE_ACCEPT.split(',').includes(file.type)) return { file }; // imageFileProblem says why
  if (file.type === 'image/gif') return { file };
  let source: ImageBitmap;
  try {
    source = await decode(file);
  } catch {
    return heic ? { error: HEIC_UNSUPPORTED } : { file };
  }
  let scaled: ImageBitmap | null = null;
  try {
    const natural = { width: source.width, height: source.height };
    // WebP may have see-through parts: look once, on a small copy.
    let alpha = false;
    if (file.type === 'image/webp') {
      const probe = document.createElement('canvas');
      const f = Math.min(1, 256 / Math.max(natural.width, natural.height, 1));
      probe.width = Math.max(1, Math.round(natural.width * f));
      probe.height = Math.max(1, Math.round(natural.height * f));
      const pctx = probe.getContext('2d');
      if (pctx) { pctx.drawImage(source, 0, 0, probe.width, probe.height); alpha = canvasHasAlpha(pctx, probe.width, probe.height); }
    }
    const plan = planImage(file, natural, alpha);
    if (plan.action === 'keep') return { file };
    const resized = plan.width !== natural.width || plan.height !== natural.height;
    if (resized) {
      try { scaled = await decode(file, { width: plan.width, height: plan.height }); } catch { scaled = null; }
      if (scaled && (scaled.width !== plan.width || scaled.height !== plan.height)) { scaled.close?.(); scaled = null; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return heic ? { error: IMAGE_UNREADABLE } : { file };
    if (plan.type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'; // JPEG has no transparency (only pictures without see-through parts get here)
      ctx.fillRect(0, 0, plan.width, plan.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(scaled ?? source, 0, 0, plan.width, plan.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, plan.type, JPEG_QUALITY));
    if (!blob) return heic ? { error: IMAGE_UNREADABLE } : { file };
    // A re-save that came out bigger (an already small JPEG) is not worth it.
    if (!heic && blob.size >= file.size && !resized) return { file };
    // Safari can't write WebP and hands back a PNG: name it by what it really is.
    const type = blob.type || plan.type;
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    const base = (file.name || 'image').replace(/\.[^.]+$/, '');
    return { file: new File([blob], `${base}.${ext}`, { type }) };
  } catch {
    return heic ? { error: IMAGE_UNREADABLE } : { file };
  } finally {
    scaled?.close?.();
    source.close?.();
  }
}
