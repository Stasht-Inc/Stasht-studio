// Branded QR codes (3 Nov 2026): the centre image, ready to draw. Browser only (canvas). The bytes come through the API
// (same origin, GET /qr-codes/logo-image via services/qrCodesAPI.logoImage) so the canvas may read them: the main colour is picked here, and the
// image is shrunk and kept as a data: URI so an SVG download carries it inside (self-contained).
//
// QR codes v2 (Chris, 3 Nov 2026 evening): a logo with big empty margins (a BMW avatar: a small roundel on a white
// JPEG) drew as a tiny mark. logoTrim crops it to a square around the mark first, so the mark fills its circle.
// logoTrim is pure (no DOM), so `node --test` loads this file (tests/utils/qrLogo.test.mjs).

import { dominantColor } from './qrStyle.ts';

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
/** Largest side of the copy logoTrim measures (the crop is scaled back up to the image). */
const TRIM_SAMPLE = 256;

/** Padding kept around the trimmed mark, as a share of its diameter on each side. */
export const TRIM_PADDING = 0.03;
/** A pixel this transparent (alpha below) is background. */
const CLEAR_ALPHA = 24;
/** A pixel this light (every channel at least) is background: white, and JPEG's near-white noise around it. */
const NEAR_WHITE = 235;
/** A row or column needs this many mark pixels to count (lone noise pixels don't move the edges). */
const MIN_LINE_PIXELS = 2;
/** The mark's radius: the distance this share of its pixels lie within (a few stray pixels don't inflate it). */
const RADIUS_QUANTILE = 0.998;

/** Where to crop a logo, in the measured pixels: a square (it may reach past the image's edges: fill those). */
export interface LogoCrop {
  x: number;
  y: number;
  size: number;
}

const isBackground = (data: ArrayLike<number>, i: number) =>
  data[i + 3] < CLEAR_ALPHA || (data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE);

/**
 * The square to crop a logo to so its mark fills the circle it is drawn in: centred on the mark's bounding box, wide
 * enough that every part of the mark sits inside the square's inscribed circle (a round mark fills it edge to edge; a
 * square mark's corners and a wordmark's ends are never clipped), plus TRIM_PADDING. Only for a logo on a background
 * (all four corners transparent or near-white); null — draw it as it is — for a full-bleed picture (a photo, a
 * coloured square), a blank image, or a mark that already fills its image. data: RGBA, width × height.
 */
export function logoTrim(data: ArrayLike<number>, width: number, height: number): LogoCrop | null {
  if (!(width > 0) || !(height > 0) || data.length < width * height * 4) return null;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  if (!corners.every((i) => isBackground(data, i))) return null;

  const rows = new Array<number>(height).fill(0);
  const cols = new Array<number>(width).fill(0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBackground(data, at(x, y))) continue;
      rows[y] += 1;
      cols[x] += 1;
    }
  }
  const first = (counts: number[]) => counts.findIndex((n) => n >= MIN_LINE_PIXELS);
  const last = (counts: number[]) => {
    for (let i = counts.length - 1; i >= 0; i--) if (counts[i] >= MIN_LINE_PIXELS) return i;
    return -1;
  };
  const x0 = first(cols);
  const y0 = first(rows);
  if (x0 < 0 || y0 < 0) return null;
  const x1 = last(cols) + 1;
  const y1 = last(rows) + 1;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  // How far the mark reaches from that centre (pixel corners, so a one-pixel mark still has a size).
  const distances: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (isBackground(data, at(x, y))) continue;
      distances.push(Math.hypot(Math.abs(x + 0.5 - cx) + 0.5, Math.abs(y + 0.5 - cy) + 0.5));
    }
  }
  if (distances.length === 0) return null;
  distances.sort((a, b) => a - b);
  const radius = distances[Math.min(distances.length - 1, Math.floor(distances.length * RADIUS_QUANTILE))];
  const size = radius * 2 * (1 + 2 * TRIM_PADDING);
  // Already about as big as the image (a logo that fills it): nothing to gain.
  if (size >= Math.min(width, height) * 0.98) return null;
  return { x: cx - size / 2, y: cy - size / 2, size };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** The part of the image to keep: the trimmed square (logoTrim, scaled up to the image), or the whole image. */
function keepRegion(source: HTMLImageElement, w0: number, h0: number): { x: number; y: number; w: number; h: number } {
  const whole = { x: 0, y: 0, w: w0, h: h0 };
  const k = Math.min(1, TRIM_SAMPLE / Math.max(w0, h0));
  const sw = Math.max(1, Math.round(w0 * k));
  const sh = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return whole;
    ctx.drawImage(source, 0, 0, sw, sh);
    const crop = logoTrim(ctx.getImageData(0, 0, sw, sh).data, sw, sh);
    if (!crop) return whole;
    const up = w0 / sw;
    return { x: crop.x * up, y: crop.y * up, w: crop.size * up, h: crop.size * up };
  } catch {
    return whole;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Draw region of source onto ctx at outW × outH; what lies past the image's edges stays clear (white when opaque). */
function drawRegion(ctx: CanvasRenderingContext2D, source: HTMLImageElement, w0: number, h0: number, region: { x: number; y: number; w: number; h: number }, outW: number, outH: number, transparent: boolean) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (!transparent) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);
  }
  const sx = outW / region.w;
  const sy = outH / region.h;
  const ix0 = Math.max(0, region.x);
  const iy0 = Math.max(0, region.y);
  const ix1 = Math.min(w0, region.x + region.w);
  const iy1 = Math.min(h0, region.y + region.h);
  if (ix1 <= ix0 || iy1 <= iy0) return;
  ctx.drawImage(source, ix0, iy0, ix1 - ix0, iy1 - iy0, (ix0 - region.x) * sx, (iy0 - region.y) * sy, (ix1 - ix0) * sx, (iy1 - iy0) * sy);
}

/** An image file → a drawable logo (trimmed to its mark: logoTrim) with its main colour; null when it isn't a readable image. */
export async function prepareLogo(blob: Blob): Promise<PreparedLogo | null> {
  if (!blob || !blob.type.startsWith('image/') || blob.size > MAX_BYTES) return null;
  const url = URL.createObjectURL(blob);
  try {
    const source = await loadImage(url);
    const w0 = source.naturalWidth || source.width;
    const h0 = source.naturalHeight || source.height;
    if (!w0 || !h0) return null;

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

    const region = keepRegion(source, w0, h0);
    const scale = Math.min(1, MAX_SIDE / Math.max(region.w, region.h));
    const width = Math.max(1, Math.round(region.w * scale));
    const height = Math.max(1, Math.round(region.h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    drawRegion(ctx, source, w0, h0, region, width, height, transparent);
    const href = transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
    const image = await loadImage(href);

    const ts = Math.min(1, THUMB_SIDE / Math.max(region.w, region.h));
    const tw = Math.max(1, Math.round(region.w * ts));
    const th = Math.max(1, Math.round(region.h * ts));
    canvas.width = tw; // resizing clears it
    canvas.height = th;
    drawRegion(ctx, source, w0, h0, region, tw, th, transparent);
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
