// Media page "Camera Roll" tab (Chris, 9 Nov 2026). A web page can't list the phone's camera roll, so the tab opens
// the phone's own photo picker; the photos picked are kept here, on this device only (nothing is uploaded), shown
// selected, and Next hands the selected ones to Create campaign, which uploads them in its Add a Moment.

/** The photo types the upload (POST /user/upload-image-with-metadata) accepts; HEIC/HEIF are converted to JPEG there. */
const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
const PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

type FileLike = { name: string; type: string };

/** A photo Create campaign can upload. The extension counts too: some browsers give HEIC an empty type. */
export function isAddablePhoto(file: FileLike): boolean {
  const type = (file.type || '').toLowerCase();
  if (PHOTO_TYPES.includes(type)) return true;
  if (type && !type.startsWith('image/')) return false;
  const dot = file.name.lastIndexOf('.');
  return dot > 0 && PHOTO_EXTENSIONS.includes(file.name.slice(dot + 1).toLowerCase());
}

export interface CameraRollPick {
  key: string;
  file: File;
  selected: boolean;
}

/**
 * The same photo picked twice has the same name and size. Not its date: iPhone Safari hands each pick over as a fresh
 * copy dated "now", so the same photo picked again would otherwise show twice.
 */
export function pickKey(file: { name: string; size: number }): string {
  return `${file.name}|${file.size}`;
}

/** Photos just picked go after the ones there, selected; the same photo again and anything not a photo are left out. */
export function addPicks(picks: readonly CameraRollPick[], files: readonly File[]): { picks: CameraRollPick[]; skipped: number; duplicates: number } {
  const next = [...picks];
  const seen = new Set(picks.map((p) => p.key));
  let skipped = 0;
  let duplicates = 0;
  for (const file of files) {
    if (!isAddablePhoto(file)) { skipped++; continue; }
    const key = pickKey(file);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    next.push({ key, file, selected: true });
  }
  return { picks: next, skipped, duplicates };
}

export function togglePick(picks: readonly CameraRollPick[], key: string): CameraRollPick[] {
  return picks.map((p) => (p.key === key ? { ...p, selected: !p.selected } : p));
}

export function selectedPickFiles(picks: readonly CameraRollPick[]): File[] {
  return picks.filter((p) => p.selected).map((p) => p.file);
}

export function selectionLabel(count: number): string {
  return count > 0 ? `${count} selected` : 'Tap photos to select';
}

export function skippedMessage(skipped: number): string {
  if (skipped <= 0) return '';
  return skipped === 1
    ? '1 file wasn’t added. Only photos (JPG, PNG, HEIC, WEBP or GIF) can be used here.'
    : `${skipped} files weren’t added. Only photos (JPG, PNG, HEIC, WEBP or GIF) can be used here.`;
}

// Kept outside the page so the picks survive opening Create campaign (the Media page closes while it's open) and
// are there again when Create is closed without making a campaign.
let sessionPicks: CameraRollPick[] = [];
let handoffFiles: File[] | null = null;
let openMediaTab = false;
const openMediaTabListeners = new Set<() => void>();

export const cameraRollSession = {
  getPicks: (): CameraRollPick[] => sessionPicks,
  setPicks: (picks: CameraRollPick[]): void => { sessionPicks = picks; },
  /** Next: these exact files went to Create campaign. */
  startHandoff: (files: File[]): void => { handoffFiles = files; },
  /** Was Create campaign opened with these files from the Camera Roll tab? (Scan Photo's files are another array.) */
  isHandoff: (files: File[] | null | undefined): boolean => Boolean(files && handoffFiles && files === handoffFiles),
  endHandoff: (): void => { handoffFiles = null; },
  /** A campaign was made from the picks: start again with none. */
  clear: (): void => { sessionPicks = []; handoffFiles = null; },
  /** The next Media page opens on its Media tab once (e.g. after "Take a Photo" saved photos to Media). */
  openMediaTabNext: (): void => {
    if (openMediaTabListeners.size) openMediaTabListeners.forEach((fn) => fn()); // a Media page is open: switch now
    else openMediaTab = true;
  },
  takeOpenMediaTab: (): boolean => { const v = openMediaTab; openMediaTab = false; return v; },
  onOpenMediaTab: (fn: () => void): (() => void) => {
    openMediaTabListeners.add(fn);
    return () => { openMediaTabListeners.delete(fn); };
  },
};
