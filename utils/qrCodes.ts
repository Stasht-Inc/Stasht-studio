// QR codes (3 Nov 2026): pure helpers for services/qrCodesAPI.ts and components/qr-codes/QrCodePopover.tsx.
// A printed code opens its short URL (https://studio.stasht.com/q/<public_code>), which the API sends on to whichever
// campaign the code points at now, so a code is printed once and re-pointed at any time.
// Imports only qrStyle, so `node --test` loads this file directly.
//
// QR codes v2 (Chris, 3 Nov 2026 evening): ONE code per view — the account's, and one per property — that always
// exists (the API makes it on first open), shown in a popover from the Campaigns header with the Live campaign it opens
// now. Any campaign of the view may be live, published or not (scans open it with ?qr=, see utils/qrAccess).
//
// The web API's contract:
//   GET   /qr-code[?property_id=]   {success, data: code, meta?: {style_available}}  get-or-create THE code of the view
//   PATCH /qr-codes/{id}            {memory_id?, name?, logo_mode?, logo_url?, color?} → {success, data: code}
//   GET   /qr-codes/campaign-options[?property_id=&search=&page=]  {success, data: [option], meta: {page, per_page, total, total_pages}}
//   code    {id, public_code, short_url, name, property_id, memory_id, campaign: {id, title, state, ...} | null,
//            scan_count, last_scanned_at, created_at, updated_at,
//            logo: {mode: default|custom|none, url, default_url}, color: #RRGGBB | null}
//            campaign null = no live campaign (none in the view yet, or it was deleted); logo.url = what to draw (null = no
//            centre image): for mode default the account's avatar (a property's image in a property view); color null = auto
//   option  {id, title, ...}

import { normalizeHex } from './qrStyle.ts';

/** default: the account's avatar (property view: the property's image); custom: an image chosen for this code; none: no logo. */
export type QrLogoMode = 'default' | 'custom' | 'none';

export interface QrCode {
  id: number;
  publicCode: string;
  /** Names the downloads. */
  name: string;
  /** The live campaign: the one a scan opens now; null: none. */
  memoryId: number | null;
  campaignTitle: string | null;
  /** What the printed code encodes. */
  shortUrl: string;
  logoMode: QrLogoMode;
  /** The image in the middle (resolved by the API, also for the default avatar); null: none to draw. */
  logoUrl: string | null;
  /** The default image (avatar / property image) "Use profile picture" goes back to; null: there is none. */
  logoDefaultUrl: string | null;
  /** The saved colour (#RRGGBB); null: auto (the logo's main colour). */
  color: string | null;
}

export interface QrCampaignOption {
  id: number;
  title: string;
}

export interface QrOptionsPage {
  options: QrCampaignOption[];
  page: number;
  totalPages: number;
  /** Campaigns in the view (meta.total; the options' count when absent). */
  total: number;
}

/** Used only if an answer ever lacks short_url (the API builds it from its studio URL config, this default). */
export const SHORT_URL_BASE = 'https://studio.stasht.com/q/';
/** Where /q/<code> goes when it reaches Studio itself (see qrRedirectUrl). */
export const QR_REDIRECT_FALLBACK_ORIGIN = 'https://restapi.stasht.com';
export const UNTITLED_CAMPAIGN = 'Untitled campaign';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function text(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

/** apiRequest's data is the server body {success, data, meta?}; peel that one envelope. */
function body(res: unknown): { data: unknown; meta: Raw | null } {
  if (isObject(res) && 'data' in res) return { data: res.data, meta: isObject(res.meta) ? res.meta : null };
  return { data: isObject(res) && 'success' in res ? undefined : res, meta: null };
}

export function normalizeQrCode(raw: unknown): QrCode | null {
  if (!isObject(raw)) return null;
  const id = num(raw.id);
  const publicCode = text(raw.public_code);
  if (id === null || !publicCode) return null;
  const campaign = isObject(raw.campaign) ? raw.campaign : null;
  const campaignTitle = campaign ? text(campaign.title) ?? UNTITLED_CAMPAIGN : null;
  // logo {mode, url}; flat logo_mode / logo_url are read too. Older answers (no logo at all) draw the default avatar.
  const logo = isObject(raw.logo) ? raw.logo : null;
  const modeRaw = logo ? logo.mode : raw.logo_mode;
  const logoMode: QrLogoMode = modeRaw === 'custom' || modeRaw === 'none' ? modeRaw : 'default';
  const urlRaw = text(logo ? logo.url : raw.logo_url);
  // Never fetched directly (S3 is another origin): the image always comes through GET /qr-codes/logo-image?url=<this>.
  const logoUrl = logoMode !== 'none' ? urlRaw : null;
  return {
    id,
    publicCode,
    name: text(raw.name) ?? campaignTitle ?? 'QR code',
    // No campaign (deleted, or none yet): no live campaign, whatever memory_id still says.
    memoryId: campaign ? num(campaign.id) ?? num(raw.memory_id) : null,
    campaignTitle,
    shortUrl: text(raw.short_url) ?? `${SHORT_URL_BASE}${publicCode}`,
    logoMode,
    logoUrl,
    logoDefaultUrl: text(logo ? logo.default_url : raw.logo_default_url),
    color: normalizeHex(raw.color),
  };
}

/** PATCH: {success, data: code}. */
export const qrCodeFromResponse = (res: unknown): QrCode | null => normalizeQrCode(body(res).data);

/**
 * GET /qr-code: the view's code, and whether its image / colour can be changed (meta.style_available: false hides the
 * controls; absent counts as yes — the API that serves /qr-code has the style columns).
 */
export function qrCodeAnswer(res: unknown): { code: QrCode; styleAvailable: boolean } | null {
  const { data, meta } = body(res);
  const code = normalizeQrCode(data);
  return code ? { code, styleAvailable: !(meta && meta.style_available === false) } : null;
}

/** POST /qr-codes/images: {success, data: {url}}. */
export function uploadedUrlFromResponse(res: unknown): string | null {
  const { data } = body(res);
  return isObject(data) ? text(data.url) : null;
}

export function normalizeCampaignOption(raw: unknown): QrCampaignOption | null {
  if (!isObject(raw)) return null;
  const id = num(raw.id);
  if (id === null) return null;
  return { id, title: text(raw.title) ?? UNTITLED_CAMPAIGN };
}

/** GET /qr-codes/campaign-options: {success, data: [option], meta: {page, per_page, total, total_pages}}. */
export function campaignOptionsFromResponse(res: unknown, asked = 1): QrOptionsPage {
  const { data, meta } = body(res);
  const options = (Array.isArray(data) ? data : []).flatMap((r) => {
    const o = normalizeCampaignOption(r);
    return o ? [o] : [];
  });
  const page = (meta && num(meta.page)) || asked;
  const totalPages = (meta && num(meta.total_pages)) || page;
  const total = (meta && num(meta.total)) ?? options.length;
  return { options, page, totalPages: Math.max(page, totalPages), total: Math.max(total, options.length) };
}

/**
 * The Live campaign dropdown's rows: the live campaign first-class even when it isn't on the loaded page (a long list
 * or a search), then the options without a duplicate of it.
 */
export function liveCampaignRows(options: QrCampaignOption[], live: QrCampaignOption | null, searching: boolean): QrCampaignOption[] {
  if (!live || searching || options.some((o) => o.id === live.id)) return options;
  return [live, ...options];
}

/** A file name for a download: "qr-fall-promo.png"; the transparent PNG "qr-fall-promo-transparent.png". */
export function qrFileName(name: string, ext: 'png' | 'svg', variant?: 'transparent'): string {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return `qr-${slug || 'code'}${variant ? `-${variant}` : ''}.${ext}`;
}

/** The query string for a request made in this view: ?property_id=12 in a property view, nothing otherwise. */
export function viewQuery(propertyId: number | string | null | undefined, extra: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  const id = propertyId === null || propertyId === undefined ? '' : String(propertyId).trim();
  if (/^\d+$/.test(id) && Number(id) > 0) params.set('property_id', id);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && String(v) !== '') params.set(k, String(v));
  }
  const q = params.toString();
  return q ? `?${q}` : '';
}

/**
 * /q/<code> that reached Studio's SPA (a device still on an old service worker that answers every page with the app):
 * where to send it so the web API's redirect handles it. The configured API host (VITE_API_BASE_URL) when it is
 * another origin, else the restapi default. Never this origin (that would come straight back here), and only for
 * well-formed codes; null: nowhere to go.
 */
export function qrRedirectUrl(code: string, apiBase: string | null | undefined, currentOrigin: string): string | null {
  if (!/^[A-Za-z0-9]{1,16}$/.test(String(code ?? ''))) return null;
  const origins: string[] = [];
  if (apiBase) {
    try {
      const u = new URL(apiBase, currentOrigin);
      if (u.protocol === 'https:' || u.protocol === 'http:') origins.push(u.origin);
    } catch {
      // not a URL: use the default
    }
  }
  origins.push(QR_REDIRECT_FALLBACK_ORIGIN);
  const origin = origins.find((o) => o !== currentOrigin);
  return origin ? `${origin}/q/${encodeURIComponent(code)}` : null;
}

/**
 * Who sees the Campaigns tab's QR Codes button (the API's rule for who may manage the codes): in the account view, the
 * account itself; in a property view, the property's own account or anyone the properties list says can manage it
 * (can_manage: its creator / admins, e.g. the main account viewing a salesperson's property). Never a partial admin.
 */
export function canManageQrCodes(viewType: unknown, property: Raw | null | undefined, user: Raw | null | undefined, partialAdmin: boolean): boolean {
  if (partialAdmin) return false;
  if (viewType !== 'property') return true;
  if (!property || !user) return false;
  const owner = property.user_id;
  const me = user.external_user_id;
  if (owner !== null && owner !== undefined && me !== null && me !== undefined && String(owner) === String(me)) return true;
  return property.can_manage === true;
}
