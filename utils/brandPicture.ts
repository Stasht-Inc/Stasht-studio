// What a brand picture is, from its pixels (Chris, 7 Nov 2026). Pure, so `node --test` loads it
// (tests/utils/brandPicture.test.mjs); the browser side (loading the pixels, caching) is utils/brandPictureLoader.ts.
//
// A campaign with no cover shows the brand — the account / property avatar (utils/campaignCover.ts):
//  - point 5: a LOGO is drawn whole on ONE SOLID colour, the logo's primary colour ("so in this case background would
//    be blue": The Royal Wood Shop's blue box blends into its cover) — no blurred copy of it behind.
//  - point 10: the avatar is often the owner's PHOTO (a selfie). It was drawn small and whole like a logo; a photo
//    fills the cover like a chosen photo.
// A logo has plain edges (one background colour, transparency, or the logo's own box filling the image); a photo is
// busy right up to its edges.
//
// The colour, first that applies:
//  1. a tile on a margin (a box with lettering, utils/qrLogo logoTrim) → the tile's edge colour;
//  2. plain edges in a real colour (a box filling the image, a coloured background) → that colour, exactly, so the
//     logo blends into the cover;
//  3. the image's main colour (utils/qrStyle dominantColor: transparent, near-white, near-black and grey ignored);
//  4. the mean colour of its edges (utils/qrLogo edgeColor: transparent and near-white ignored);
//  5. none (null): the caller falls back to the profile colour, then Studio purple.

import { dominantColor, rgbToHex, rgbToHsl } from './qrStyle.ts';
import { edgeColor, logoTrim } from './qrLogo.ts';

/** The longest side the browser samples a brand picture at (the tests sample the same way). */
export const BRAND_SAMPLE = 96;

export type BrandPictureKind = 'logo' | 'photo';

export interface BrandPicture {
  kind: BrandPictureKind;
  /** The solid colour behind the logo drawn whole, as #RRGGBB; null: none usable (use the profile colour). */
  color: string | null;
}

/** An edge pixel this transparent (alpha below) is background. */
const CLEAR_ALPHA = 24;
/** This share of the edge transparent: a logo on a transparent background. */
const CLEAR_EDGE_SHARE = 0.25;
/** Edge pixels this close (RGB distance) to the edge's median colour count as that colour (JPEG noise, antialiasing). */
const EDGE_TOLERANCE = 56;
/** This share of the opaque edge in one colour: plain edges, a logo. Below it the edge is busy: a photo. */
const PLAIN_EDGE_SHARE = 0.6;
/** A plain edge colour is used as the backdrop only between these lightnesses (not near-black, not near-white). */
const EDGE_LIGHTNESS: [number, number] = [0.08, 0.92];

/** The outermost ring of pixels (RGBA offsets), each pixel once. */
function ring(width: number, height: number): number[] {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const cells: number[] = [];
  for (let x = 0; x < width; x++) {
    cells.push(at(x, 0));
    if (height > 1) cells.push(at(x, height - 1));
  }
  for (let y = 1; y < height - 1; y++) {
    cells.push(at(0, y));
    if (width > 1) cells.push(at(width - 1, y));
  }
  return cells;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Judge a brand picture from its pixels: data RGBA, width × height (sampled at BRAND_SAMPLE). null when there is
 * nothing to judge (bad input, a blank / fully transparent image).
 */
export function brandPicture(data: ArrayLike<number>, width: number, height: number): BrandPicture | null {
  if (!(width > 0) || !(height > 0) || data.length < width * height * 4) return null;
  let opaqueAnywhere = false;
  for (let i = 3; i < width * height * 4; i += 4) {
    if (data[i] >= CLEAR_ALPHA) { opaqueAnywhere = true; break; }
  }
  if (!opaqueAnywhere) return null;

  const edge = ring(width, height);
  const opaque = edge.filter((i) => data[i + 3] >= CLEAR_ALPHA);
  const clearShare = 1 - opaque.length / edge.length;

  let plainShare = 0;
  let plainColor: { r: number; g: number; b: number } | null = null;
  if (opaque.length) {
    const m = { r: median(opaque.map((i) => data[i])), g: median(opaque.map((i) => data[i + 1])), b: median(opaque.map((i) => data[i + 2])) };
    const close = opaque.filter((i) => Math.hypot(data[i] - m.r, data[i + 1] - m.g, data[i + 2] - m.b) <= EDGE_TOLERANCE);
    plainShare = close.length / opaque.length;
    if (close.length) {
      const n = close.length;
      plainColor = {
        r: close.reduce((s, i) => s + data[i], 0) / n,
        g: close.reduce((s, i) => s + data[i + 1], 0) / n,
        b: close.reduce((s, i) => s + data[i + 2], 0) / n,
      };
    }
  }

  const kind: BrandPictureKind = clearShare >= CLEAR_EDGE_SHARE || plainShare >= PLAIN_EDGE_SHARE ? 'logo' : 'photo';
  return { kind, color: pickColor(data, width, height, kind, clearShare, plainShare, plainColor) };
}

function pickColor(
  data: ArrayLike<number>, width: number, height: number, kind: BrandPictureKind,
  clearShare: number, plainShare: number, plainColor: { r: number; g: number; b: number } | null,
): string | null {
  if (kind === 'logo') {
    // 1. a tile on a margin: its own edge colour.
    const crop = logoTrim(data, width, height);
    if (crop?.tile && crop.w && crop.h) {
      const tile = edgeColor(data, width, crop.x, crop.y, crop.x + crop.w, crop.y + crop.h);
      if (tile && usableEdge(tile)) return tile;
    }
    // 2. plain, opaque edges in a real colour.
    if (clearShare < CLEAR_EDGE_SHARE && plainShare >= PLAIN_EDGE_SHARE && plainColor) {
      const plain = rgbToHex(plainColor);
      if (usableEdge(plain)) return plain;
    }
  }
  // 3. the main colour, 4. the edges' colour.
  const main = dominantColor(data);
  if (main) return main;
  const edges = edgeColor(data, width, 0, 0, width, height);
  return edges && usableEdge(edges) ? edges : null;
}

function usableEdge(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const { l } = rgbToHsl({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
  return l >= EDGE_LIGHTNESS[0] && l <= EDGE_LIGHTNESS[1];
}
