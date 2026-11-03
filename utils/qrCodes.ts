// Dynamic QR Codes (3 Nov 2026): pure helpers for services/qrCodesAPI.ts and components/qr-codes/QrCodesDialog.tsx.
// A printed code opens its short URL (https://studio.stasht.com/q/<public_code>), which the API sends on to whichever
// campaign the code points at now, so a code is printed once and re-pointed at any time.
// Imports only countLabel and qrStyle, so `node --test` loads this file directly.
//
// The web API's contract (3 Nov 2026):
//   code    {id, public_code, short_url, name, property_id, memory_id, campaign: {id, title, state, usable, public_url} | null,
//            scan_count, last_scanned_at, created_at, updated_at,
//            logo: {mode: default|custom|none, url, default_url}, color: #RRGGBB | null}   (branded codes, 3 Nov)
//            campaign null = "No campaign" (never set, or deleted); logo.url = what to draw (null = no centre image): for
//            mode default the account's avatar (a property's image in a property view), resolved by the API; color null = auto
//   list    {success, data: [code], meta: {default_logo_url, style_available}}; style_available false (the style columns
//            aren't there yet): the default look only, no image / colour controls
//   option  {id, title, cover_url, state, usable, can_publish, reason}, meta {page, per_page, total, total_pages}
//   state   public | view_only | private | unpublished

import { countLabel } from './countLabel.ts';
import { normalizeHex } from './qrStyle.ts';

/** default: the account's avatar (property view: the property's image); custom: an image chosen for this code; none: no logo. */
export type QrLogoMode = 'default' | 'custom' | 'none';

export interface QrCode {
  id: number;
  publicCode: string;
  /** Defaults to the campaign's title when the code is made. */
  name: string;
  memoryId: number | null;
  /** The campaign it opens now; null when it opens none (never set, or the campaign was deleted). */
  campaignTitle: string | null;
  /** Whether the API says the code can open that campaign now (false: made private, unpublished, no link); null: none. */
  campaignUsable: boolean | null;
  /** What the printed code encodes. */
  shortUrl: string;
  scanCount: number;
  lastScannedAt: string | null;
  logoMode: QrLogoMode;
  /** The image in the middle (resolved by the API, also for the default avatar); null: none to draw. */
  logoUrl: string | null;
  /** The default image (avatar / property image) "Use profile picture" goes back to; null: there is none. */
  logoDefaultUrl: string | null;
  /** The saved colour (#RRGGBB); null: auto (the logo's main colour). */
  color: string | null;
}

export type CampaignState = 'public' | 'view_only' | 'private' | 'unpublished';
export type CampaignUse = 'ready' | 'viewOnly' | 'unpublished' | 'private' | 'blocked';

export interface QrCampaignOption {
  id: number;
  title: string;
  coverUrl: string | null;
  state: CampaignState;
  /** The API's word on whether a code may open it now. */
  usable: boolean;
  /** The API allows publishing it publicly from the picker. */
  canPublish: boolean;
  /** Why it can't be used (or the view-only note), from the API. */
  reason: string | null;
}

export interface QrOptionsPage {
  options: QrCampaignOption[];
  page: number;
  totalPages: number;
}

/** Used only if an answer ever lacks short_url (the API builds it from its studio URL config, this default). */
export const SHORT_URL_BASE = 'https://studio.stasht.com/q/';

export const EMPTY_TEXT = 'Print a QR code once and point it at any campaign — change it anytime.';
export const DELETE_TEXT = "Printed copies will show a 'not linked' page.";
export const VIEW_ONLY_HINT = "View only — visitors can't add moments";
export const PRIVATE_HINT = 'Private — change to Public to use';
export const UNPUBLISHED_HINT = 'Not published';
export const BLOCKED_HINT = "Can't be used right now";
export const UNAVAILABLE_LABEL = 'Campaign not available — change it';
/** Where /q/<code> goes when it reaches Studio itself (see qrRedirectUrl). */
export const QR_REDIRECT_FALLBACK_ORIGIN = 'https://restapi.stasht.com';

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

const STATES: readonly CampaignState[] = ['public', 'view_only', 'private', 'unpublished'];
/** An unknown state counts as unpublished: never pickable. */
const toState = (v: unknown): CampaignState => (STATES.includes(v as CampaignState) ? (v as CampaignState) : 'unpublished');

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
  const campaignTitle = campaign ? text(campaign.title) ?? 'Untitled campaign' : null;
  const scans = num(raw.scan_count) ?? 0;
  // logo {mode, url}; flat logo_mode / logo_url are read too. Older answers (no logo at all) draw the default avatar.
  const logo = isObject(raw.logo) ? raw.logo : null;
  const modeRaw = logo ? logo.mode : raw.logo_mode;
  const logoMode: QrLogoMode = modeRaw === 'custom' || modeRaw === 'none' ? modeRaw : 'default';
  const urlRaw = text(logo ? logo.url : raw.logo_url);
  // Only a key here: the image itself always comes through the API (GET /qr-codes/{id}/logo), never from this URL.
  const logoUrl = logoMode !== 'none' ? urlRaw : null;
  return {
    id,
    publicCode,
    name: text(raw.name) ?? campaignTitle ?? 'QR code',
    memoryId: num(raw.memory_id) ?? (campaign ? num(campaign.id) : null),
    campaignTitle,
    campaignUsable: campaign ? campaign.usable !== false : null,
    shortUrl: text(raw.short_url) ?? `${SHORT_URL_BASE}${publicCode}`,
    scanCount: Math.max(0, Math.floor(scans)),
    lastScannedAt: text(raw.last_scanned_at),
    logoMode,
    logoUrl,
    logoDefaultUrl: text(logo ? logo.default_url : raw.logo_default_url),
    color: normalizeHex(raw.color),
  };
}

/** POST / PATCH: {success, data: code}. */
export const qrCodeFromResponse = (res: unknown): QrCode | null => normalizeQrCode(body(res).data);

/** GET /qr-codes: the codes, and whether image / colour can be changed (meta.style_available; absent = an API without it). */
export function qrListFromResponse(res: unknown): { codes: QrCode[]; styleAvailable: boolean } {
  const { meta } = body(res);
  return { codes: qrCodesFromResponse(res), styleAvailable: Boolean(meta && meta.style_available === true) };
}

/** POST /qr-codes/images: {success, data: {url}}. */
export function uploadedUrlFromResponse(res: unknown): string | null {
  const { data } = body(res);
  return isObject(data) ? text(data.url) : null;
}

/** GET /qr-codes: {success, data: [code]}, newest first. */
export function qrCodesFromResponse(res: unknown): QrCode[] {
  const { data } = body(res);
  return (Array.isArray(data) ? data : []).flatMap((r) => {
    const code = normalizeQrCode(r);
    return code ? [code] : [];
  });
}

export function normalizeCampaignOption(raw: unknown): QrCampaignOption | null {
  if (!isObject(raw)) return null;
  const id = num(raw.id);
  if (id === null) return null;
  return {
    id,
    title: text(raw.title) ?? 'Untitled campaign',
    coverUrl: text(raw.cover_url),
    state: toState(raw.state),
    usable: raw.usable === true,
    canPublish: raw.can_publish === true,
    reason: text(raw.reason),
  };
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
  return { options, page, totalPages: Math.max(page, totalPages) };
}

/**
 * Whether a code may open this campaign: public → ready; view only → ready, with a hint (visitors can't add moments);
 * private (token link) → no, visitors would need to sign in; not published → Publish when the API allows it. A public
 * or view-only campaign the API still calls unusable (e.g. "No public link yet") → blocked, with the API's reason.
 */
export function campaignUse(o: Pick<QrCampaignOption, 'state' | 'usable'>): CampaignUse {
  switch (o.state) {
    case 'public': return o.usable ? 'ready' : 'blocked';
    case 'view_only': return o.usable ? 'viewOnly' : 'blocked';
    case 'private': return 'private';
    default: return 'unpublished';
  }
}

export const canPick = (use: CampaignUse): boolean => use === 'ready' || use === 'viewOnly';

/**
 * The Publish link shows only for an unpublished campaign the API says may be published. Never for a private one
 * (changing it to Public is the owner's call, on the campaign) or one with no public link yet (publishing won't help).
 */
export const canPublish = (o: Pick<QrCampaignOption, 'state' | 'canPublish'>): boolean => o.state === 'unpublished' && o.canPublish;

/** The hint under a campaign in the picker: the API's reason, else the words for its state (none when public). */
export function campaignHint(o: Pick<QrCampaignOption, 'state' | 'usable' | 'reason'>): string | null {
  const use = campaignUse(o);
  if (use === 'ready') return null;
  if (o.reason) return o.reason;
  switch (use) {
    case 'viewOnly': return VIEW_ONLY_HINT;
    case 'private': return PRIVATE_HINT;
    case 'unpublished': return UNPUBLISHED_HINT;
    default: return BLOCKED_HINT;
  }
}

/** "Opens: Fall Promo"; "No campaign"; or, when the API says the campaign can't be opened now, a nudge to change it. */
export function opensLabel(code: Pick<QrCode, 'campaignTitle' | 'campaignUsable'>): string {
  if (!code.campaignTitle) return 'No campaign';
  return code.campaignUsable === false ? UNAVAILABLE_LABEL : `Opens: ${code.campaignTitle}`;
}

/** The row's Opens line is a warning (no campaign, or one that can't be opened now). */
export const opensWarning = (code: Pick<QrCode, 'campaignTitle' | 'campaignUsable'>): boolean => !code.campaignTitle || code.campaignUsable === false;

/** "0 scans", "1 scan", "1,204 scans". */
export const scansLabel = (n: unknown): string => countLabel(n, 'scan');

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

/** A name for the code: what was typed (trimmed, at most 120 characters), or null to keep the old one. */
export function cleanName(input: string): string | null {
  const t = String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, 120).trim();
  return t === '' ? null : t;
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
