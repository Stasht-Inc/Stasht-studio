// Branded QR codes (Chris, 3 Nov 2026): the look of every QR code Studio draws (list thumbnail, the code's view and the
// downloads), like a big brand's code: round dot modules, rounded finder squares in the brand colour, and the logo on a
// white circle in the middle. Pure, so `node --test` loads it directly (tests/utils/qrStyle.test.mjs decodes the result
// with a real QR reader).
//
// Print safety: error correction H (30% of the code may be lost), a quiet zone of 4 modules, the logo at most 22% of
// the code's width, and a colour that keeps at least 4.5:1 contrast against white (a too light brand colour is darkened,
// same hue).

import qrcode from 'qrcode-generator';

export const QR_LEVEL = 'H' as const;
/** Light modules around the code, in modules (the QR standard asks for 4). */
export const QUIET_ZONE = 4;
/** The logo's diameter as a share of the code's width (quiet zone not counted). */
export const LOGO_RATIO = 0.22;
/** The white circle behind the logo, as a share of the code's width: the logo plus a little padding. */
export const LOGO_CIRCLE_RATIO = 0.27;
/** Dot modules: radius in modules (0.5 would touch the next dot). */
export const DOT_RADIUS = 0.45;
/** The colour used when the logo has no usable colour (or there is no logo). */
export const FALLBACK_COLOR = '#111827';
/** Minimum contrast against white for print and scanning (WCAG AA for text). */
export const MIN_CONTRAST = 4.5;

/** Colour override presets (Auto is separate: the logo's colour). */
export const COLOR_PRESETS: ReadonlyArray<{ hex: string; name: string }> = [
  { hex: '#111827', name: 'Black' },
  { hex: '#1E3A8A', name: 'Navy' },
  { hex: '#166534', name: 'Green' },
  { hex: '#B91C1C', name: 'Red' },
  { hex: '#5B21B6', name: 'Purple' },
];

export interface QrLogoSpot {
  /** Centre, in modules (quiet zone included). */
  cx: number;
  cy: number;
  /** The white circle's radius. */
  circleR: number;
  /** The logo's radius. */
  imageR: number;
}

export interface QrLayout {
  /** Modules across the code itself. */
  modules: number;
  /** Modules across the whole image (code + quiet zone on both sides). */
  size: number;
  /** One path: every dark module (finder patterns excepted) as a dot. */
  dotsPath: string;
  /** One path, even-odd: the three finder rings. */
  ringsPath: string;
  /** One path: the three finder centres. */
  centresPath: string;
  /** One path, even-odd: the alignment patterns as small rounded squares with a centre dot (as dots, readers miss them). */
  alignPath: string;
  logo: QrLogoSpot | null;
  /** How many dark modules the logo hid (for tests: H recovers far more). */
  hiddenDark: number;
  darkTotal: number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** The QR matrix for text at error correction H (the smallest version that fits). true = dark. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, QR_LEVEL);
  qr.addData(String(text ?? ''), 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}

/** A rounded rectangle as SVG path data (clockwise). */
export function roundRectPath(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  return [
    `M${r3(x + r)} ${r3(y)}`,
    `H${r3(x + w - r)}`,
    `A${r3(r)} ${r3(r)} 0 0 1 ${r3(x + w)} ${r3(y + r)}`,
    `V${r3(y + h - r)}`,
    `A${r3(r)} ${r3(r)} 0 0 1 ${r3(x + w - r)} ${r3(y + h)}`,
    `H${r3(x + r)}`,
    `A${r3(r)} ${r3(r)} 0 0 1 ${r3(x)} ${r3(y + h - r)}`,
    `V${r3(y + r)}`,
    `A${r3(r)} ${r3(r)} 0 0 1 ${r3(x + r)} ${r3(y)}`,
    'Z',
  ].join('');
}

const inFinder = (r: number, c: number, n: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

/** Alignment pattern centre rows/columns by version (ISO/IEC 18004 Annex E); version 1 has none. */
const ALIGNMENT: ReadonlyArray<ReadonlyArray<number>> = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58],
  [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114],
  [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
  [6, 30, 58, 86, 114, 142, 170],
];

/** The centres (row, col) of a code's alignment patterns: every pair from the table except the three under finders. */
export function alignmentCentres(modules: number): Array<[number, number]> {
  const version = (modules - 17) / 4;
  const at = ALIGNMENT[version - 1] ?? [];
  const out: Array<[number, number]> = [];
  for (const r of at) {
    for (const c of at) {
      if (inFinder(r, c, modules)) continue;
      out.push([r, c]);
    }
  }
  return out;
}

/**
 * Where everything goes, in modules. withLogo: leave a white circle in the middle (every module whose dot would touch
 * it is left out, so the logo never sits on half dots).
 */
export function qrLayout(text: string, withLogo: boolean): QrLayout {
  const matrix = qrMatrix(text);
  const n = matrix.length;
  const q = QUIET_ZONE;
  const centre = q + n / 2;
  const logo: QrLogoSpot | null = withLogo
    ? { cx: centre, cy: centre, circleR: (n * LOGO_CIRCLE_RATIO) / 2, imageR: (n * LOGO_RATIO) / 2 }
    : null;
  const d = DOT_RADIUS;
  const hidden = (x: number, y: number) => Boolean(logo && Math.hypot(x - logo.cx, y - logo.cy) < logo.circleR + d);
  // Alignment patterns are drawn whole (a ring and its centre), except one the logo covers (H recovers it).
  const aligns = alignmentCentres(n).filter(([r, c]) => !hidden(q + c + 0.5, q + r + 0.5));
  const inAlign = (r: number, c: number) => aligns.some(([ar, ac]) => Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2);
  const dots: string[] = [];
  let hiddenDark = 0;
  let darkTotal = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c] || inFinder(r, c, n) || inAlign(r, c)) continue;
      darkTotal += 1;
      const x = q + c + 0.5;
      const y = q + r + 0.5;
      if (hidden(x, y)) {
        hiddenDark += 1;
        continue;
      }
      // A full circle as two arcs, from its left edge.
      dots.push(`M${r3(x - d)} ${r3(y)}a${d} ${d} 0 1 0 ${d * 2} 0a${d} ${d} 0 1 0 ${-d * 2} 0Z`);
    }
  }
  const corners: Array<[number, number]> = [[q, q], [q + n - 7, q], [q, q + n - 7]];
  const ringsPath = corners.map(([x, y]) => roundRectPath(x, y, 7, 7, 2.25) + roundRectPath(x + 1, y + 1, 5, 5, 1.5)).join('');
  const centresPath = corners.map(([x, y]) => roundRectPath(x + 2, y + 2, 3, 3, 1)).join('');
  const alignPath = aligns
    .map(([r, c]) => {
      const x = q + c - 2;
      const y = q + r - 2;
      return roundRectPath(x, y, 5, 5, 1.6) + roundRectPath(x + 1, y + 1, 3, 3, 0.9) + roundRectPath(x + 2, y + 2, 1, 1, 0.5);
    })
    .join('');
  return { modules: n, size: n + q * 2, dotsPath: dots.join(''), ringsPath, centresPath, alignPath, logo, hiddenDark, darkTotal };
}

// ── Colour ────────────────────────────────────────────────────────────────

export interface Rgb { r: number; g: number; b: number }

/** '#1a2B3c' → '#1A2B3C'; anything else (3-digit, names, garbage) → null. */
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toUpperCase() : null;
}

export function hexToRgb(hex: string): Rgb | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const p = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h: number;
  if (max === R) h = (G - B) / delta + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / delta + 2;
  else h = (R - G) / delta + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): Rgb {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return { r: ch(hue + 1 / 3) * 255, g: ch(hue) * 255, b: ch(hue - 1 / 3) * 255 };
}

/** WCAG relative luminance, 0 (black) … 1 (white). */
export function luminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio against white (1 … 21). */
export function contrastWithWhite(hex: string): number {
  const rgb = hexToRgb(hex);
  return rgb ? 1.05 / (luminance(rgb) + 0.05) : 1;
}

/**
 * A colour that prints and scans dark on white: the colour itself when it has at least 4.5:1 contrast against white,
 * else the same hue darkened until it does. No colour (or not #RRGGBB) → near-black.
 */
export function printSafeColor(hex: string | null | undefined): string {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return FALLBACK_COLOR;
  if (contrastWithWhite(rgbToHex(rgb)) >= MIN_CONTRAST) return rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  for (let l = hsl.l; l > 0; l -= 0.01) {
    const out = rgbToHex(hslToRgb({ ...hsl, l }));
    if (contrastWithWhite(out) >= MIN_CONTRAST) return out;
  }
  return FALLBACK_COLOR;
}

const HUE_BINS = 36;

/**
 * The logo's most prominent main colour from its RGBA pixels (e.g. a 64×64 sample). Transparent, near-white, near-black
 * and grey pixels don't count (backgrounds, outlines, text); the rest vote by hue, a more saturated pixel voting more.
 * The winning hue (with its two neighbours) gives the average of its pixels. null: no usable colour (a black-and-white
 * logo, or too little colour to call it the brand's).
 */
export function dominantColor(data: ArrayLike<number>): string | null {
  const weight = new Array<number>(HUE_BINS).fill(0);
  const sums = Array.from({ length: HUE_BINS }, () => ({ r: 0, g: 0, b: 0, w: 0 }));
  let opaque = 0;
  let usable = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    opaque += 1;
    const px = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const max = Math.max(px.r, px.g, px.b);
    const min = Math.min(px.r, px.g, px.b);
    const { h, s, l } = rgbToHsl(px);
    if (l > 0.92 || l < 0.08 || max - min < 40 || s < 0.25) continue;
    usable += 1;
    const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS;
    const w = 1 + s;
    weight[bin] += w;
    const sum = sums[bin];
    sum.r += px.r * w;
    sum.g += px.g * w;
    sum.b += px.b * w;
    sum.w += w;
  }
  if (usable === 0 || usable < Math.max(8, opaque * 0.03)) return null;
  let best = 0;
  let bestScore = -1;
  for (let b = 0; b < HUE_BINS; b++) {
    const score = weight[(b + HUE_BINS - 1) % HUE_BINS] + weight[b] + weight[(b + 1) % HUE_BINS];
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  const total = { r: 0, g: 0, b: 0, w: 0 };
  for (const b of [(best + HUE_BINS - 1) % HUE_BINS, best, (best + 1) % HUE_BINS]) {
    total.r += sums[b].r;
    total.g += sums[b].g;
    total.b += sums[b].b;
    total.w += sums[b].w;
  }
  return total.w > 0 ? rgbToHex({ r: total.r / total.w, g: total.g / total.w, b: total.b / total.w }) : null;
}

/** The colour a code is drawn in: its saved colour, else the logo's colour; always print safe. */
export const qrDrawColor = (saved: string | null | undefined, logoColor: string | null | undefined): string =>
  printSafeColor(normalizeHex(saved) ?? normalizeHex(logoColor));

// ── Drawing ───────────────────────────────────────────────────────────────

export interface QrLogoImage {
  /** A data: URI (so an SVG stays self-contained). */
  href: string;
  width: number;
  height: number;
}

export type LogoFit = 'cover' | 'contain';

/** A square-ish image (an avatar, a round logo) fills the circle; a wide or tall one (a wordmark) fits inside it whole. */
export function logoFit(width: number, height: number): LogoFit {
  if (!(width > 0) || !(height > 0)) return 'cover';
  const ratio = width / height;
  return ratio >= 0.8 && ratio <= 1.25 ? 'cover' : 'contain';
}

/** Where the logo's pixels go (in modules), and which part of the image: cover crops to the circle, contain shows all. */
export function logoPlacement(spot: QrLogoSpot, width: number, height: number) {
  const fit = logoFit(width, height);
  if (fit === 'cover') {
    const side = Math.min(width, height);
    return {
      fit,
      src: { x: (width - side) / 2, y: (height - side) / 2, w: side, h: side },
      dest: { x: spot.cx - spot.imageR, y: spot.cy - spot.imageR, w: spot.imageR * 2, h: spot.imageR * 2 },
    };
  }
  // Inside the circle's inscribed square.
  const box = spot.imageR * Math.SQRT2;
  const scale = Math.min(box / width, box / height);
  const w = width * scale;
  const h = height * scale;
  return { fit, src: { x: 0, y: 0, w: width, h: height }, dest: { x: spot.cx - w / 2, y: spot.cy - h / 2, w, h } };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export interface QrDrawOptions {
  /** Any colour; drawn print safe. */
  color: string;
  /** White behind the code, or nothing (for coloured garments). The logo keeps its white circle either way. */
  background: 'white' | 'transparent';
  logo: QrLogoImage | null;
}

/**
 * The code as a standalone SVG file: vector modules, the logo embedded as a data URI (only data: URIs are accepted, so
 * the file never points anywhere). pixels: the width/height it declares.
 */
export function qrSvg(text: string, options: QrDrawOptions, pixels = 1024): string {
  const logo = options.logo && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(options.logo.href) ? options.logo : null;
  const layout = qrLayout(text, Boolean(logo));
  const color = printSafeColor(options.color);
  const s = layout.size;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pixels}" height="${pixels}" viewBox="0 0 ${s} ${s}">`,
  ];
  if (options.background === 'white') parts.push(`<rect width="${s}" height="${s}" fill="#FFFFFF"/>`);
  parts.push(`<path fill="${color}" d="${layout.dotsPath}"/>`);
  parts.push(`<path fill="${color}" fill-rule="evenodd" d="${layout.ringsPath}"/>`);
  parts.push(`<path fill="${color}" d="${layout.centresPath}"/>`);
  if (layout.alignPath) parts.push(`<path fill="${color}" fill-rule="evenodd" d="${layout.alignPath}"/>`);
  if (logo && layout.logo) {
    const spot = layout.logo;
    const place = logoPlacement(spot, logo.width, logo.height);
    parts.push(`<circle cx="${r3(spot.cx)}" cy="${r3(spot.cy)}" r="${r3(spot.circleR)}" fill="#FFFFFF"/>`);
    const href = escapeAttr(logo.href);
    if (place.fit === 'cover') {
      parts.push(`<clipPath id="qr-logo"><circle cx="${r3(spot.cx)}" cy="${r3(spot.cy)}" r="${r3(spot.imageR)}"/></clipPath>`);
      parts.push(`<image clip-path="url(#qr-logo)" x="${r3(place.dest.x)}" y="${r3(place.dest.y)}" width="${r3(place.dest.w)}" height="${r3(place.dest.h)}" preserveAspectRatio="xMidYMid slice" href="${href}" xlink:href="${href}"/>`);
    } else {
      parts.push(`<image x="${r3(place.dest.x)}" y="${r3(place.dest.y)}" width="${r3(place.dest.w)}" height="${r3(place.dest.h)}" preserveAspectRatio="xMidYMid meet" href="${href}" xlink:href="${href}"/>`);
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

/** The SVG as a data: URL for an <img>. */
export const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/**
 * The same drawing on a canvas (for the PNG downloads): px square, the same paths through Path2D. image: the logo,
 * already loaded (pass null for no logo).
 */
export function paintQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: { color: string; background: 'white' | 'transparent'; image: CanvasImageSource | null; imageWidth: number; imageHeight: number },
  px: number,
): void {
  const layout = qrLayout(text, Boolean(options.image));
  const scale = px / layout.size;
  const color = printSafeColor(options.color);
  ctx.save();
  ctx.clearRect(0, 0, px, px);
  if (options.background === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, px, px);
  }
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(layout.dotsPath));
  ctx.fill(new Path2D(layout.ringsPath), 'evenodd');
  ctx.fill(new Path2D(layout.centresPath));
  if (layout.alignPath) ctx.fill(new Path2D(layout.alignPath), 'evenodd');
  if (options.image && layout.logo) {
    const spot = layout.logo;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(spot.cx, spot.cy, spot.circleR, 0, Math.PI * 2);
    ctx.fill();
    const place = logoPlacement(spot, options.imageWidth, options.imageHeight);
    ctx.save();
    if (place.fit === 'cover') {
      ctx.beginPath();
      ctx.arc(spot.cx, spot.cy, spot.imageR, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(options.image, place.src.x, place.src.y, place.src.w, place.src.h, place.dest.x, place.dest.y, place.dest.w, place.dest.h);
    ctx.restore();
  }
  ctx.restore();
}
