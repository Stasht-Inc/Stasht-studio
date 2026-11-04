// Branded QR codes (3 Nov 2026): the centre image, ready to draw. Browser only (canvas). The bytes come through the API
// (same origin, GET /qr-codes/logo-image via services/qrCodesAPI.logoImage) so the canvas may read them: the main colour is picked here, and the
// image is shrunk and kept as a data: URI so an SVG download carries it inside (self-contained).
//
// QR codes v2 (Chris, 3 Nov 2026 evening): a logo with big empty margins (a BMW avatar: a small roundel on a white
// JPEG) drew as a tiny mark. logoTrim crops it to a square around the mark first, so the mark fills its circle.
// logoTrim is pure (no DOM), so `node --test` loads this file (tests/utils/qrLogo.test.mjs).

import { dominantColor, rgbToHex } from './qrStyle.ts';

export interface PreparedLogo {
  /** data:image/png (when the image has transparency) or data:image/jpeg. */
  href: string;
  width: number;
  height: number;
  /** The logo's main colour (raw, before print safety); null: none usable. */
  color: string | null;
  /** Loaded, for painting the PNG downloads. */
  image: HTMLImageElement;
  /** The logo circle's fill behind a logo drawn whole (a wide image or a tile): its edge colour; null: white. */
  backdrop: string | null;
  /** A tile (logoTrim): drawn whole inside the circle even when square. */
  contain: boolean;
}

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

/**
 * Where to crop a logo, in the measured pixels: a square (it may reach past the image's edges: fill those), or for a
 * tile the tile itself (w × h, tile: true; size = its long side).
 */
export interface LogoCrop {
  x: number;
  y: number;
  size: number;
  w?: number;
  h?: number;
  tile?: boolean;
}

const isBackground = (data: ArrayLike<number>, i: number) =>
  data[i + 3] < CLEAR_ALPHA || (data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE);

/** A tile's edges: at least this share of each edge line (its rounded ends left out) is mark. */
const TILE_EDGE_FILL = 0.9;
/** Left out at each end of an edge line, as a share of its length: rounded corners. */
const TILE_CORNER = 0.2;
/** How far inside its bounding box a tile's edge lines are read (antialiasing), in pixels. */
const TILE_EDGE_INSET = 2;
/** A tile is filled inside: a ring this far in (share of each side) is at least TILE_INNER_FILL mark (an outlined frame
 *  is empty there; the lettering on a box takes only part of it). */
const TILE_INNER_RING = 0.12;
const TILE_INNER_FILL = 0.6;
/** A tile is cropped this far inside its own edges (each side, share of its short side): no antialiased rim shows. */
export const TILE_INSET = 0.015;
/** Smallest tile side (measured pixels) worth treating as one. */
const TILE_MIN = 8;

/** The pixels along a rectangle's four edge lines (corner ends left out), as RGBA offsets. */
function edgeCells(width: number, x0: number, y0: number, x1: number, y1: number, inset: number, cornerShare: number): number[] {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const w = x1 - x0;
  const h = y1 - y0;
  const cells: number[] = [];
  const top = y0 + inset;
  const bottom = y1 - 1 - inset;
  const left = x0 + inset;
  const right = x1 - 1 - inset;
  const skipW = Math.floor(w * cornerShare);
  const skipH = Math.floor(h * cornerShare);
  for (let k = skipW; k < w - skipW; k++) cells.push(at(x0 + k, top), at(x0 + k, bottom));
  for (let k = skipH; k < h - skipH; k++) cells.push(at(left, y0 + k), at(right, y0 + k));
  return cells;
}

/** Whether the mark's bounding box [x0, x1) × [y0, y1) is a solid tile: all four edges (nearly) all mark, and filled. */
function isTile(data: ArrayLike<number>, width: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < TILE_MIN || h < TILE_MIN) return false;
  const share = (cells: number[]) => (cells.length ? cells.filter((i) => !isBackground(data, i)).length / cells.length : 0);
  const at = (x: number, y: number) => (y * width + x) * 4;
  const line = (count: number, cell: (k: number) => number) => {
    const skip = Math.floor(count * TILE_CORNER);
    const cells: number[] = [];
    for (let k = skip; k < count - skip; k++) cells.push(cell(k));
    return share(cells) >= TILE_EDGE_FILL;
  };
  const top = y0 + TILE_EDGE_INSET;
  const bottom = y1 - 1 - TILE_EDGE_INSET;
  const left = x0 + TILE_EDGE_INSET;
  const right = x1 - 1 - TILE_EDGE_INSET;
  const edged = line(w, (k) => at(x0 + k, top)) && line(w, (k) => at(x0 + k, bottom))
    && line(h, (k) => at(left, y0 + k)) && line(h, (k) => at(right, y0 + k));
  if (!edged) return false;
  const ix = Math.round(w * TILE_INNER_RING);
  const iy = Math.round(h * TILE_INNER_RING);
  return share(edgeCells(width, x0 + ix, y0 + iy, x1 - ix, y1 - iy, 0, 0)) >= TILE_INNER_FILL;
}

/**
 * The colour along a box's edges (2 px in, rounded corners left out): the mean of its mark pixels, as #RRGGBB; null
 * when they are mostly background (transparent / white). The logo circle's fill behind a tile or a wide image drawn
 * whole, so it still reads as one round avatar. data: RGBA, width wide; the box in its pixels.
 */
export function edgeColor(data: ArrayLike<number>, width: number, x0: number, y0: number, x1: number, y1: number): string | null {
  const height = Math.floor(data.length / 4 / width);
  const bx0 = Math.max(0, Math.round(x0));
  const by0 = Math.max(0, Math.round(y0));
  const bx1 = Math.min(width, Math.round(x1));
  const by1 = Math.min(height, Math.round(y1));
  if (bx1 - bx0 < 6 || by1 - by0 < 6) return null;
  const cells = edgeCells(width, bx0, by0, bx1, by1, 2, TILE_CORNER);
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (const i of cells) {
    if (isBackground(data, i)) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
  }
  if (!cells.length || n / cells.length < 0.5) return null;
  return rgbToHex({ r: r / n, g: g / n, b: b / n });
}

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

  // A tile (round avatar, Chris 4 Nov 2026): a solid box edged all round by the mark and filled — TheRoyalWoodShop's
  // blue box with white lettering, a coloured square, an app-icon tile — on a margin. Crop to the tile itself (just
  // inside its antialiased rim): it is drawn whole inside the logo circle, on the circle filled with its edge colour,
  // so it reads as one round avatar and its lettering is never cut.
  if (isTile(data, width, x0, y0, x1, y1)) {
    const inset = Math.min(x1 - x0, y1 - y0) * TILE_INSET;
    const w = x1 - x0 - 2 * inset;
    const h = y1 - y0 - 2 * inset;
    if (w >= width * 0.98 && h >= height * 0.98) return null;
    return { x: x0 + inset, y: y0 + inset, w, h, size: Math.max(w, h), tile: true };
  }

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
  // As big as the image's long side (a logo that already fills it): nothing to gain. A wide or tall image's square may
  // well be bigger than its short side — it then reaches past those edges (the caller fills them clear / white).
  if (size >= Math.max(width, height) * 0.98) return null;
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

/**
 * The part of the image to keep — the trimmed square (logoTrim, scaled up to the image), a tile, or the whole image —
 * whether it is a tile (drawn whole), and the colour behind a logo drawn whole (edgeColor: the tile's, or the whole
 * image's edges, used when it is wide or tall).
 */
function keepRegion(source: HTMLImageElement, w0: number, h0: number): { region: { x: number; y: number; w: number; h: number }; contain: boolean; backdrop: string | null } {
  const whole = { region: { x: 0, y: 0, w: w0, h: h0 }, contain: false, backdrop: null };
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
    const data = ctx.getImageData(0, 0, sw, sh).data;
    const crop = logoTrim(data, sw, sh);
    const up = w0 / sw;
    if (!crop) return { ...whole, backdrop: edgeColor(data, sw, 0, 0, sw, sh) };
    if (crop.tile && crop.w && crop.h) {
      return {
        region: { x: crop.x * up, y: crop.y * up, w: crop.w * up, h: crop.h * up },
        contain: true,
        backdrop: edgeColor(data, sw, crop.x, crop.y, crop.x + crop.w, crop.y + crop.h),
      };
    }
    return { region: { x: crop.x * up, y: crop.y * up, w: crop.size * up, h: crop.size * up }, contain: false, backdrop: null };
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

    const { region, contain, backdrop } = keepRegion(source, w0, h0);
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
    canvas.width = 0; // let go of the bitmap
    canvas.height = 0;
    const image = await loadImage(href);
    return { href, width, height, color: dominantColor(pixels), image, backdrop, contain };
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
