// Same rules as POST /newsletters/images (spec §8): jpg/png/gif/webp, at most 5 MB. Checked before uploading.
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageFileProblem(file: { type: string; size: number }): string | null {
  if (!IMAGE_ACCEPT.split(',').includes(file.type)) return 'Use a JPG, PNG, GIF or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images can be up to 5 MB. Choose a smaller one.';
  return null;
}
