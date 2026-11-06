// Chris, 6 Nov 2026 (point 2): the Storeel live preview is a real phone screen. The phone is laid out at the chosen
// device's CSS size and scaled to fit the panel; the choice (iPhone 15 by default) is remembered in this browser.
// Pure, so `node --test` loads it.

export interface PreviewDevice {
  id: string;
  label: string;
  /** CSS pixels (points), portrait. */
  width: number;
  height: number;
}

export const PREVIEW_DEVICES: readonly PreviewDevice[] = [
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
  { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852 },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915 },
];

export const DEFAULT_PREVIEW_DEVICE = 'iphone-15';
export const PREVIEW_DEVICE_KEY = 'stasht_storeel_preview_device';

/** The device with this id, else iPhone 15. */
export function previewDevice(id: string | null | undefined): PreviewDevice {
  return PREVIEW_DEVICES.find((d) => d.id === id) ?? PREVIEW_DEVICES.find((d) => d.id === DEFAULT_PREVIEW_DEVICE)!;
}

const positive = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * How much to scale a box of `size` so it fits `room` (its width, and its height when given) — never enlarged, and a
 * small positive scale while nothing is measured yet. Four decimals, so the same room always gives the same scale.
 */
export function fitScale(size: { width: number; height: number }, room: { width?: number; height?: number }): number {
  const limits = [1];
  if (positive(room.width)) limits.push(room.width / size.width);
  if (positive(room.height)) limits.push(room.height / size.height);
  const scale = Math.min(...limits);
  return scale > 0.05 ? Number(scale.toFixed(4)) : 0.05;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

const browserStorage = (): StorageLike => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

/** The phone chosen earlier in this browser (else iPhone 15). Storage that is missing or throws is ignored. */
export function readPreviewDevice(storage: StorageLike = browserStorage()): PreviewDevice {
  try {
    return previewDevice(storage?.getItem(PREVIEW_DEVICE_KEY));
  } catch {
    return previewDevice(null);
  }
}

/** Remembers the phone for next time (only a known one; storage that throws is ignored). */
export function savePreviewDevice(id: string, storage: StorageLike = browserStorage()): void {
  if (!PREVIEW_DEVICES.some((d) => d.id === id)) return;
  try {
    storage?.setItem(PREVIEW_DEVICE_KEY, id);
  } catch {
    // Private window / blocked site data: the choice just isn't remembered.
  }
}
