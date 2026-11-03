// Branded QR codes (3 Nov 2026): the centre image, ready to draw. Browser only (canvas). The bytes come through the API
// (same origin, GET /qr-codes/logo-image via services/qrCodesAPI.logoImage) so the canvas may read them: the main colour is picked here, and the
// image is shrunk and kept as a data: URI so an SVG download carries it inside (self-contained).

import { dominantColor } from './qrStyle';

export interface PreparedLogo {
  /** data:image/png (when the image has transparency) or data:image/jpeg. */
  href: string;
  width: number;
  height: number;
  /** The logo's main colour (raw, before print safety); null: none usable. */
  color: string | null;
  /** Loaded, for painting the PNG downloads. */
  image: HTMLImageElement;
  /** The same logo at most THUMB_SIDE px, for small pictures (the list thumbnails). */
  thumb: { href: string; width: number; height: number };
}

/** Largest side of the thumbnail logo. */
export const THUMB_SIDE = 128;

/** Largest side kept: the logo is 29% of a 4096 px PNG's code (~970 px), so this stays sharp in print. */
const MAX_SIDE = 1024;
const SAMPLE = 64;
const MAX_BYTES = 15 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** An image file → a drawable logo with its main colour; null when it isn't a readable image. */
export async function prepareLogo(blob: Blob): Promise<PreparedLogo | null> {
  if (!blob || !blob.type.startsWith('image/') || blob.size > MAX_BYTES) return null;
  const url = URL.createObjectURL(blob);
  try {
    const source = await loadImage(url);
    const w0 = source.naturalWidth || source.width;
    const h0 = source.naturalHeight || source.height;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const width = Math.max(1, Math.round(w0 * scale));
    const height = Math.max(1, Math.round(h0 * scale));

    const sample = document.createElement('canvas');
    sample.width = SAMPLE;
    sample.height = SAMPLE;
    const sctx = sample.getContext('2d', { willReadFrequently: true });
    if (!sctx) return null;
    sctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);
    const pixels = sctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
    let transparent = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 250) {
        transparent = true;
        break;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (!transparent) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(source, 0, 0, width, height);
    const href = transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
    const image = await loadImage(href);

    const ts = Math.min(1, THUMB_SIDE / Math.max(w0, h0));
    const tw = Math.max(1, Math.round(w0 * ts));
    const th = Math.max(1, Math.round(h0 * ts));
    canvas.width = tw; // resizing clears it
    canvas.height = th;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (!transparent) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, tw, th);
    }
    ctx.drawImage(source, 0, 0, tw, th);
    const thumb = { href: transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9), width: tw, height: th };
    canvas.width = 0;
    canvas.height = 0;
    return { href, width, height, color: dominantColor(pixels), image, thumb };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// One load per image: codes that share the default avatar share it. Keyed by the logo URL the API gave.
const cache = new Map<string, Promise<PreparedLogo | null>>();
const done = new Map<string, PreparedLogo>();

function remember(key: string, p: Promise<PreparedLogo | null>): Promise<PreparedLogo | null> {
  cache.set(key, p);
  void p.then((logo) => {
    if (cache.get(key) !== p) return;
    if (logo) done.set(key, logo);
    else cache.delete(key); // a failed load isn't kept: the next view asks again
  });
  return p;
}

/** The code's centre image (null: none to draw, or it couldn't be loaded). fetchBytes: services/qrCodesAPI.logoImage. */
export function loadQrLogo(logoUrl: string | null, fetchBytes: (url: string) => Promise<Blob | null>): Promise<PreparedLogo | null> {
  if (!logoUrl) return Promise.resolve(null);
  return cache.get(logoUrl) ?? remember(logoUrl, fetchBytes(logoUrl).then((blob) => (blob ? prepareLogo(blob) : null)));
}

/** An image just uploaded: use the file in hand for its new URL rather than download it again. */
export function primeQrLogo(logoUrl: string | null, file: Blob): void {
  if (!logoUrl) return;
  done.delete(logoUrl);
  remember(logoUrl, prepareLogo(file));
}

/** A logo already loaded (for a first render without a flash); undefined: not loaded (yet). */
export const loadedQrLogo = (logoUrl: string | null): PreparedLogo | undefined => (logoUrl ? done.get(logoUrl) : undefined);
