// [wdy2xh2t3z] What the Storeel tab's live preview shows for the form as it is now. Pure, so `node --test` loads it.

export interface StoreelPreviewInput {
  title: string;
  /** Picked images, in order (object URLs or https links). */
  images: string[];
  momentCount: number;
  location: string;
  /** The form's date, YYYY-MM-DD. */
  date: string;
  authorName: string | null | undefined;
}

export interface StoreelPreviewModel {
  title: string;
  cover: string | null;
  firstImage: string | null;
  moments: string;
  author: string;
  initial: string;
  location: string;
  date: string;
}

export function momentsLabel(count: number): string {
  return `${count} ${count === 1 ? 'moment' : 'moments'}`;
}

export function initialsOf(name: string | null | undefined): string {
  const first = String(name ?? '').trim().charAt(0);
  return first ? first.toUpperCase() : 'U';
}

/** A calendar day (YYYY-MM-DD) in the person's language, or ''. */
function formatDay(date: string, locale?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export function storeelPreviewModel(input: StoreelPreviewInput, locale?: string): StoreelPreviewModel {
  const first = input.images[0] ?? null;
  const author = String(input.authorName ?? '').trim();
  return {
    title: input.title.trim(),
    cover: first,
    firstImage: first,
    moments: momentsLabel(Math.max(0, input.momentCount)),
    author: author || 'Username',
    initial: initialsOf(author),
    location: input.location.trim(),
    date: formatDay(input.date ?? '', locale),
  };
}

type PreviewFile = { name?: string; type?: string };

const isHeic = (f: PreviewFile) => /heic|heif/i.test(f.type ?? '') || /\.(heic|heif)$/i.test(f.name ?? '');

/**
 * The form's photos as the preview needs them, from the same lists the form counts ("N files selected"): how many,
 * and the first one — its uploaded link once there is one, the file before that. A HEIC file can't be shown by the
 * browser, so the preview keeps its gradient for it.
 */
export function storeelPreviewMedia<F extends PreviewFile>(lists: {
  withMetadata: Array<{ file: F; fileUrl?: string }>;
  mainPhotos: Array<{ fileUrl?: string }>;
  mediaFiles: F[];
}): { first: F | string | null; count: number } {
  const count = Math.max(lists.withMetadata.length, lists.mainPhotos.length, lists.mediaFiles.length);
  let first: F | string | null = null;
  if (lists.withMetadata.length) first = lists.withMetadata[0].fileUrl || lists.withMetadata[0].file;
  else if (lists.mainPhotos.length) first = lists.mainPhotos[0].fileUrl || null;
  else if (lists.mediaFiles.length) first = lists.mediaFiles[0];
  if (first && typeof first !== 'string' && isHeic(first)) first = null;
  return { first, count };
}
