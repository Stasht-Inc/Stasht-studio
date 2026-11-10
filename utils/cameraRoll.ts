import { ACCOUNT_STATE_CLEARED_EVENT } from './accountState.ts';

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
  // A video, PDF… is out; an unknown type (some desktops call HEIC application/octet-stream) goes by its extension.
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') return false;
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

/** The account the picks belong to: who is signed in, and which view (their own, or a business/property). */
export function accountKeyOf({ userId, viewType, propertyId }: { userId?: string | number | null; viewType?: string | null; propertyId?: string | number | null }): string {
  return `${userId ?? ''}|${viewType ?? ''}|${propertyId ?? ''}`;
}

/** One-shot "open the Media page on its Media tab" (sessionStorage, so it survives a reload). Sidebar's "View Media"
 *  writes this literal key before its reload. */
export const OPEN_MEDIA_TAB_KEY = 'stasht_open_media_tab';
/** Set by every "service connected / photos imported" flow before it opens /media (read and removed by MediaPage). */
const SERVICE_JUST_CONNECTED_KEY = 'service_just_connected';

// sessionStorage can be missing or throw (private mode, blocked site data): never let that break anything.
function storageGet(key: string): string | null {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null; } catch { return null; }
}
function storageSet(key: string, value: string): void {
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value); } catch { /* not kept */ }
}
function storageRemove(key: string): void {
  try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key); } catch { /* nothing to do */ }
}

// Kept outside the page so the picks survive opening Create campaign (the Media page closes while it's open) and
// are there again when Create is closed without making a campaign. Only for the account they were picked in.
let sessionPicks: CameraRollPick[] = [];
let sessionAccount: string | null = null;
let handoffFiles: File[] | null = null;
const openMediaTabListeners = new Set<() => void>();
const clearListeners = new Set<() => void>();

export const cameraRollSession = {
  /** The picks, if they were made in this account; another account (a business switch, another user) gets none and
   *  they are forgotten, so they can never be sent into the wrong account. */
  getPicks: (account: string): CameraRollPick[] => {
    if (sessionAccount !== account) { sessionPicks = []; handoffFiles = null; sessionAccount = account; }
    return sessionPicks;
  },
  setPicks: (picks: CameraRollPick[], account: string): void => { sessionPicks = picks; sessionAccount = account; },
  /** Next: these exact files went to Create campaign. */
  startHandoff: (files: File[]): void => { handoffFiles = files; },
  /** Was Create campaign opened with these files from the Camera Roll tab? (Scan Photo's files are another array.) */
  isHandoff: (files: File[] | null | undefined): boolean => Boolean(files && handoffFiles && files === handoffFiles),
  endHandoff: (): void => { handoffFiles = null; },
  /** A campaign was made from the picks, or the account changed: start again with none (an open tab empties too). */
  clear: (): void => {
    sessionPicks = []; handoffFiles = null;
    clearListeners.forEach((fn) => fn());
  },
  onClear: (fn: () => void): (() => void) => {
    clearListeners.add(fn);
    return () => { clearListeners.delete(fn); };
  },
  /** Show the Media tab: an open Media page switches now; otherwise the next one opens on it (even after a reload). */
  openMediaTabNext: (): void => {
    if (openMediaTabListeners.size) openMediaTabListeners.forEach((fn) => fn());
    else storageSet(OPEN_MEDIA_TAB_KEY, '1');
  },
  /** Should the Media page open on Media? Doesn't consume anything (safe in a state initializer). */
  peekOpenMediaTab: (): boolean => storageGet(OPEN_MEDIA_TAB_KEY) === '1' || Boolean(storageGet(SERVICE_JUST_CONNECTED_KEY)),
  /** As peek, and uses up the one-shot key (service_just_connected is left for MediaPage's OAuth-return handling). */
  takeOpenMediaTab: (): boolean => {
    const open = cameraRollSession.peekOpenMediaTab();
    storageRemove(OPEN_MEDIA_TAB_KEY);
    return open;
  },
  onOpenMediaTab: (fn: () => void): (() => void) => {
    openMediaTabListeners.add(fn);
    return () => { openMediaTabListeners.delete(fn); };
  },
};

// A sign-out / sign-in that doesn't reload the page (utils/accountState): the previous person's picks go.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener(ACCOUNT_STATE_CLEARED_EVENT, () => cameraRollSession.clear());
}
