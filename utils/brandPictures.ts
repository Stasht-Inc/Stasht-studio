// Brand pictures (Chris, 7 Nov 2026; review rework): what an account / property avatar is — a LOGO, drawn whole on one
// solid colour, or a PHOTO, which fills the cover — as the web API judged it (BrandPictures there: once per picture,
// cached, our storage only). It comes as `brand_pictures: { url: { kind, color, frame } }` on campaign payloads
// (seeded by apiRequest) or, for covers whose payload didn't carry them, from ONE GET /brand-pictures?urls[]= per page.
//
// Kept here in memory and in localStorage, so CampaignCover reads it synchronously: it paints the right look at once,
// never waits hidden, and a picture seen before never switches look on a later visit. A picture not known yet shows the
// 4 Nov look and switches once when its answer arrives (only the first time this browser sees it). No pixels are read
// in the browser. Pure apart from fetch / localStorage, so `node --test` loads it (tests/utils/brandPictures.test.mjs).

export interface BrandPicture {
  /** 'whole': the API was unsure (a flat backdrop): drawn whole at full height on `color` (re-review 2, option C). */
  kind: 'logo' | 'photo' | 'whole';
  /** The solid colour behind a logo (#RRGGBB); null: the profile colour, then Studio purple. */
  color: string | null;
  /** Draw the logo as a rounded card (a logo on a white background), not blended. */
  frame: boolean;
}

const STORE_KEY = 'stasht_brand_pictures_v2';
const STORE_MAX = 200;

const known = new Map<string, BrandPicture | null>();
const inFlight = new Set<string>();
const retried = new Set<string>();
const listeners = new Set<() => void>();
let stored: Record<string, BrandPicture> | null = null;
let apiBase: () => string = () => '/api/react';
let authHeaders: () => Record<string, string> = () => ({});
let queue: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Unknown covers that appear together are asked about together; a still-pending picture once more a little later. */
let timing = { batchMs: 40, retryMs: 5000 };
const BATCH_MAX = 40;

/** authUtils hands over getApiBaseUrl (kept out of this file so it stays loadable in node tests). */
export function setBrandPictureApiBase(base: () => string): void {
  apiBase = base;
}

/** authUtils hands over the signed-in headers: a signed-in call lets the server work the misses out. */
export function setBrandPictureHeaders(headers: () => Record<string, string>): void {
  authHeaders = headers;
}

export function parseBrandPicture(v: unknown): BrandPicture | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.kind !== 'logo' && o.kind !== 'photo' && o.kind !== 'whole') return null;
  if (o.color !== null && o.color !== undefined && !(typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color))) return null;
  return { kind: o.kind, color: typeof o.color === 'string' ? o.color.toUpperCase() : null, frame: o.frame === true };
}

function readStore(): Record<string, BrandPicture> {
  if (stored) return stored;
  stored = {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [url, v] of Object.entries(parsed as Record<string, unknown>)) {
        const pic = parseBrandPicture(v);
        if (pic) stored[url] = pic;
      }
    }
  } catch { /* no storage / bad JSON: memory only */ }
  return stored;
}

function remember(url: string, pic: BrandPicture): void {
  known.set(url, pic);
  const all = readStore();
  delete all[url];
  all[url] = pic;
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) delete all[k];
}

function save(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(readStore())); } catch { /* full / blocked */ }
}

function notify(): void {
  listeners.forEach((fn) => { try { fn(); } catch { /* a listener's problem */ } });
}

/** The answer for url: a BrandPicture, null (asked, unknown: the 4 Nov look), undefined (not known yet). */
export function knownBrandPicture(url: string | null | undefined): BrandPicture | null | undefined {
  if (!url) return undefined;
  if (known.has(url)) return known.get(url);
  const hit = readStore()[url];
  if (hit) {
    known.set(url, hit);
    return hit;
  }
  return undefined;
}

/** Keep the `brand_pictures` an API response carries (apiRequest calls this for every JSON response). */
export function seedBrandPictures(body: unknown): void {
  const map = body && typeof body === 'object' ? (body as Record<string, unknown>).brand_pictures : null;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return;
  let added = false;
  for (const [url, v] of Object.entries(map as Record<string, unknown>)) {
    const pic = parseBrandPicture(v);
    if (!pic) continue;
    const before = known.get(url);
    remember(url, pic);
    if (!before || before.kind !== pic.kind || before.color !== pic.color || before.frame !== pic.frame) added = true;
  }
  if (added) {
    save();
    notify();
  }
}

/** Pictures the API judges (BrandPictures::allowed there): our bucket or a Google profile picture, https, no query; not SVG. */
export function brandPictureEligible(url: string | null | undefined): boolean {
  let u: URL;
  try { u = new URL(String(url ?? '')); } catch { return false; }
  if (u.protocol !== 'https:' || u.search || u.hash || u.username || u.port) return false;
  if (/\.svg$/i.test(u.pathname)) return false;
  const host = u.hostname.toLowerCase();
  if (/^stasht-data\.s3[.-]([a-z0-9-]+\.)?amazonaws\.com$/.test(host)) return true;
  if (/^s3[.-]([a-z0-9-]+\.)?amazonaws\.com$/.test(host) && u.pathname.startsWith('/stasht-data/')) return true;
  return host === 'lh3.googleusercontent.com' && /^\/a-?\//.test(u.pathname);
}

/** Ask the API about a picture not known yet (batched with the page's other unknown covers). Listeners hear the answer. */
export function requestBrandPicture(url: string | null | undefined): void {
  if (!url || knownBrandPicture(url) !== undefined || inFlight.has(url) || !brandPictureEligible(url)) return;
  inFlight.add(url);
  queue.push(url);
  if (!flushTimer) flushTimer = setTimeout(flush, timing.batchMs);
}

function flush(): void {
  flushTimer = null;
  const batch = queue.splice(0, BATCH_MAX);
  if (queue.length) flushTimer = setTimeout(flush, timing.batchMs);
  if (!batch.length) return;
  const qs = batch.map((u) => `urls[]=${encodeURIComponent(u)}`).join('&');
  let headers: Record<string, string> = {};
  try { headers = authHeaders() || {}; } catch { headers = {}; }
  // Only a signed-in call gets its misses worked out, so only then is a pending picture worth asking about again.
  const signedIn = !!headers.Authorization;
  void fetch(`${apiBase()}/brand-pictures?${qs}`, { headers: { ...headers, Accept: 'application/json' } })
    .then(async (r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((body) => {
      const data = body && typeof body.data === 'object' && body.data ? body.data as Record<string, unknown> : {};
      let saved = false;
      const again: string[] = [];
      for (const url of batch) {
        inFlight.delete(url);
        const pic = parseBrandPicture(data[url]);
        if (pic) {
          remember(url, pic);
          saved = true;
        } else if (signedIn && body && body.pending > 0 && !retried.has(url)) {
          retried.add(url); // the server is working it out after that response: ask once more
          again.push(url);
        } else {
          known.set(url, null); // this visit: the 4 Nov look
        }
      }
      if (saved) save();
      notify();
      if (again.length) {
        setTimeout(() => again.forEach((u) => requestBrandPicture(u)), timing.retryMs);
      }
    });
}

/** Hear about new answers (returns the unsubscribe). */
export function subscribeBrandPictures(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Tests only. */
export function __setBrandPictureTiming(t: { batchMs: number; retryMs: number }): void {
  timing = t;
}

/** Tests only. */
export function __resetBrandPictures({ keepStorage = false }: { keepStorage?: boolean } = {}): void {
  known.clear();
  inFlight.clear();
  retried.clear();
  queue = [];
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  stored = null;
  if (!keepStorage) {
    try { localStorage.removeItem(STORE_KEY); } catch { /* none */ }
  }
}
