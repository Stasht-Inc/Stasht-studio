// Same rules as POST /newsletters/images (spec §8): jpg/png/gif/webp, at most 5 MB. Checked before uploading.
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** What the picker offers: the upload types plus iPhone HEIC photos, which are turned into JPEG first. */
export const PICK_ACCEPT = `${IMAGE_ACCEPT},image/heic,image/heif,.heic,.heif`;
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

export type ImagePlan = { action: 'keep' } | { action: 'reencode'; type: 'image/jpeg' | 'image/png'; width: number; height: number };

/**
 * What to do with a picked picture before uploading. Phone photos (big JPEGs, HEIC) are shrunk to at most
 * MAX_IMAGE_SIDE and saved as JPEG. PNGs stay PNG (logos keep a see-through background) and are only shrunk.
 * GIFs are left alone (they may move).
 */
export function planImage(file: { type: string; size: number; name?: string }, size: { width: number; height: number }): ImagePlan {
  const type = file.type.toLowerCase();
  if (type === 'image/gif') return { action: 'keep' };
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(size.width, size.height, 1));
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  if (type === 'image/png') return scale < 1 ? { action: 'reencode', type: 'image/png', width, height } : { action: 'keep' };
  if (isHeic(file) || scale < 1 || file.size > REENCODE_ABOVE_BYTES) return { action: 'reencode', type: 'image/jpeg', width, height };
  return { action: 'keep' };
}

/** Browser only: shrink / re-save a picked picture as planImage says. Never throws. */
export async function prepareImage(file: File): Promise<{ file: File } | { error: string }> {
  const heic = isHeic(file);
  if (!heic && !IMAGE_ACCEPT.split(',').includes(file.type)) return { file }; // imageFileProblem says why
  if (file.type === 'image/gif') return { file };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // applies the photo's EXIF rotation in current browsers
  } catch {
    return heic ? { error: HEIC_UNSUPPORTED } : { file };
  }
  try {
    const plan = planImage(file, { width: bitmap.width, height: bitmap.height });
    if (plan.action === 'keep') return { file };
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return heic ? { error: IMAGE_UNREADABLE } : { file };
    if (plan.type === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'; // JPEG has no transparency
      ctx.fillRect(0, 0, plan.width, plan.height);
    }
    ctx.drawImage(bitmap, 0, 0, plan.width, plan.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, plan.type, JPEG_QUALITY));
    if (!blob) return heic ? { error: IMAGE_UNREADABLE } : { file };
    // A re-save that came out bigger (an already small JPEG) is not worth it.
    if (!heic && blob.size >= file.size && plan.width === bitmap.width) return { file };
    const base = (file.name || 'image').replace(/\.[^.]+$/, '');
    return { file: new File([blob], `${base}.${plan.type === 'image/png' ? 'png' : 'jpg'}`, { type: plan.type }) };
  } catch {
    return heic ? { error: IMAGE_UNREADABLE } : { file };
  } finally {
    bitmap.close?.();
  }
}
