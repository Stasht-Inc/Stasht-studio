// Campaign page — Timeline + Media panel helpers (Chris, 19 Nov 2026, points 10, 12, 12b, 13a).

// ---- 12b: file sizes ----------------------------------------------------------------------------------------------
// memory_images.size is stored in MEGABYTES (the API's S3 helper: round(bytes / 1024 / 1024, 2); Add a Moment sends
// upload-image-with-metadata's originalSizeMB; the campaign's total_size sums them as MB). The Media panel formatted
// it as bytes, so a 3.4 MB photo read "3 B". Very large numbers can only be bytes (a 100 000 MB photo doesn't exist),
// so those are read as bytes. Nothing / 0 = unknown: '' (it used to show a made-up "2.4 MB").
const BYTES_FROM = 100_000;

export function formatStoredSize(value: unknown): string {
  if (typeof value === 'string' && /^\s*[\d.]+\s*(B|KB|MB|GB)\s*$/i.test(value)) return value.trim(); // already formatted ("3.4 MB")
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return '';
  const mb = n >= BYTES_FROM ? n / (1024 * 1024) : n;
  const round = (x: number) => String(parseFloat(x.toFixed(1)));
  if (mb >= 1024) return `${round(mb / 1024)} GB`;
  if (mb >= 1) return `${round(mb)} MB`;
  const kb = mb * 1024;
  return kb >= 1 ? `${Math.round(kb)} KB` : `${Math.max(1, Math.round(kb * 1024))} B`;
}

// ---- 10: where Add a Moment puts the new moment ---------------------------------------------------------------------
// The "+" under a moment sends after_post_id (that moment). The "+" at the very top of the timeline has no moment
// above it: it sends insert_at_start=1 so the moment goes first. The header's "Add a Moment" button sends neither and
// the moment goes at the end, as before.
export type PlusPlace = { atStart: true } | { afterWidgetId: string } | null | undefined;

export function momentInsertAtStart(afterPostId: string | null | undefined, place: PlusPlace): boolean {
  return (afterPostId === null || afterPostId === undefined || afterPostId === '') && !!place && 'atStart' in place;
}

// ---- 13a: the photo edit panel's "Choose a Moment" list -------------------------------------------------------------
// Never the photo's own moment (a moment can't go inside itself).
export function chooseMomentTargets<T extends { id: string | number }>(moments: readonly T[], photoId: string | number): T[] {
  return moments.filter((m) => String(m.id) !== String(photoId));
}

// ---- 12: Media panel 2 / 3 columns, remembered per viewer -------------------------------------------------------------
export type MediaColumns = 2 | 3;
export const MEDIA_COLUMNS_KEY = 'stasht_media_panel_columns';

export function readMediaColumns(storage?: Pick<Storage, 'getItem'> | null): MediaColumns {
  try {
    const s = storage === undefined ? globalThis.localStorage : storage;
    return s?.getItem(MEDIA_COLUMNS_KEY) === '3' ? 3 : 2;
  } catch {
    return 2;
  }
}

export function saveMediaColumns(columns: MediaColumns, storage?: Pick<Storage, 'setItem'> | null): void {
  try {
    const s = storage === undefined ? globalThis.localStorage : storage;
    s?.setItem(MEDIA_COLUMNS_KEY, String(columns));
  } catch {
    /* private window / blocked storage: the choice lasts this visit only */
  }
}
