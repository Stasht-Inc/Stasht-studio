// Reading a brand picture's pixels in the browser, for utils/brandPicture (Chris, 7 Nov 2026: solid brand colour
// behind a logo; a photo avatar fills the cover). Used by components/ui/CampaignCover.
//
// A canvas may only read an image it is allowed to: our S3 bucket sends no CORS headers. So, first that works:
//  1. the page's own origin, data: and blob: pictures — read directly;
//  2. signed in, a picture in our bucket or a Google profile picture — its bytes through the API from Studio's own
//     origin (GET /qr-codes/logo-image, the branded-QR-code fetch: our bucket and Google profile pictures only);
//  3. any other host — loaded with crossOrigin="anonymous" (works where the host sends CORS headers).
// Otherwise there is no answer (null) and the cover keeps its 4 Nov look. In particular a SIGNED-OUT viewer of a
// published page can't read an S3 logo until the bucket allows CORS GET from Studio.
//
// Answers are cached per picture URL: in memory (also failures, for this page load) and in localStorage (successes, so
// the next visit paints the right colour at once). Many cards share one avatar: one load for all of them.

import { qrCodesAPI } from '../services/qrCodesAPI';
import { tokenUtils } from './authUtils';
import { brandPicture, BRAND_SAMPLE, type BrandPicture } from './brandPicture';

const STORE_KEY = 'stasht_brand_pictures_v1';
const STORE_MAX = 200;
/** Hosts GET /qr-codes/logo-image serves (QrLogoImage::allowed: our bucket, Google profile pictures). */
const PROXIED_HOST = /(^|\.)amazonaws\.com$|^lh3\.googleusercontent\.com$/i;

const settled = new Map<string, BrandPicture | null>();
const inFlight = new Map<string, Promise<BrandPicture | null>>();
let stored: Record<string, BrandPicture> | null = null;

function readStore(): Record<string, BrandPicture> {
  if (stored) return stored;
  stored = {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [url, v] of Object.entries(parsed as Record<string, any>)) {
        if (v && (v.kind === 'logo' || v.kind === 'photo') && (v.color === null || /^#[0-9A-F]{6}$/i.test(String(v.color)))) {
          stored[url] = { kind: v.kind, color: v.color };
        }
      }
    }
  } catch { /* no storage: memory only */ }
  return stored;
}

function writeStore(url: string, pic: BrandPicture) {
  const all = readStore();
  delete all[url];
  all[url] = pic;
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) delete all[k];
  try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch { /* full / blocked: memory only */ }
}

/** The answer already known for this picture: a BrandPicture, null (it can't be read), or undefined (not asked yet). */
export function cachedBrandPicture(url: string): BrandPicture | null | undefined {
  if (settled.has(url)) return settled.get(url) ?? null;
  const hit = readStore()[url];
  if (hit) settled.set(url, hit);
  return hit;
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** The picture sampled at BRAND_SAMPLE and judged; throws when the canvas may not read it. */
function judge(img: HTMLImageElement): BrandPicture | null {
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) return null;
  const k = Math.min(1, BRAND_SAMPLE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * k));
  const height = Math.max(1, Math.round(h0 * k));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return brandPicture(ctx.getImageData(0, 0, width, height).data, width, height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function attempt(src: string, crossOrigin: boolean): Promise<BrandPicture | null | undefined> {
  try {
    return judge(await loadImage(src, crossOrigin));
  } catch {
    return undefined; // couldn't load or read: try the next way
  }
}

async function read(url: string): Promise<BrandPicture | null> {
  let parsed: URL | null = null;
  try { parsed = new URL(url, window.location.href); } catch { return null; }
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:' || parsed.origin === window.location.origin) {
    return (await attempt(url, false)) ?? null;
  }
  const token = tokenUtils.getToken();
  if (parsed.protocol === 'https:' && PROXIED_HOST.test(parsed.hostname) && token && !tokenUtils.isTokenExpired(token)) {
    const blob = await qrCodesAPI.logoImage(url);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      try {
        const pic = await attempt(objectUrl, false);
        if (pic !== undefined) return pic;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }
  return (await attempt(url, true)) ?? null;
}

/** What the brand picture at url is (cached per url); null when it can't be read here. */
export function loadBrandPicture(url: string): Promise<BrandPicture | null> {
  const known = cachedBrandPicture(url);
  if (known !== undefined) return Promise.resolve(known);
  const pending = inFlight.get(url);
  if (pending) return pending;
  const p = read(url)
    .catch(() => null)
    .then((pic) => {
      settled.set(url, pic);
      inFlight.delete(url);
      if (pic) writeStore(url, pic);
      return pic;
    });
  inFlight.set(url, p);
  return p;
}
