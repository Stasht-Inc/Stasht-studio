// Dynamic QR Codes (3 Nov 2026): pure helpers for services/qrCodesAPI.ts and components/qr-codes/QrCodesDialog.tsx.
// A printed code opens its short URL (https://studio.stasht.com/q/<public_code>), which the API sends on to whichever
// campaign the code points at now, so a code is printed once and re-pointed at any time.
// Imports only countLabel, so `node --test` loads this file directly.

import { countLabel } from './countLabel.ts';

export interface QrCode {
  id: number;
  publicCode: string;
  /** Defaults to the campaign's name when the code is made. */
  name: string;
  memoryId: number | null;
  /** The campaign it opens now; null when it opens none (deleted, unpublished, or never set). */
  campaignTitle: string | null;
  /** What the printed code encodes. */
  shortUrl: string;
  scanCount: number;
  lastScannedAt: string | null;
}

/** published on a campaign: 1 public, 2 view only, 3 private (token link); anything else is not published. */
export type CampaignUse = 'ready' | 'viewOnly' | 'unpublished' | 'private' | 'blocked';

export interface QrCampaignOption {
  id: number;
  title: string;
  coverUrl: string | null;
  published: number;
  /** The API's own word on whether a code may open it, and why not. */
  usable: boolean | null;
  reason: string | null;
}

export interface QrOptionsPage {
  options: QrCampaignOption[];
  page: number;
  totalPages: number;
}

/** Used only when the API leaves short_url out (the API builds it from its studio URL config, this default). */
export const SHORT_URL_BASE = 'https://studio.stasht.com/q/';

export const EMPTY_TEXT = 'Print a QR code once and point it at any campaign — change it anytime.';
export const DELETE_TEXT = "Printed copies will show a 'not linked' page.";
export const VIEW_ONLY_HINT = "View only — visitors can't add moments";
export const PRIVATE_HINT = 'Private — change to Public to use';
export const UNPUBLISHED_HINT = 'Not published';

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

/** apiRequest's data is the server body ({success, data, meta?}); peel that one envelope. */
function body(res: unknown): { data: unknown; meta: Raw | null } {
  if (isObject(res) && 'data' in res && ('success' in res || 'meta' in res)) {
    return { data: res.data, meta: isObject(res.meta) ? res.meta : null };
  }
  return { data: res, meta: null };
}

/** The rows of a list answer: a bare array, or one under data / qr_codes / items / options. */
function rows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isObject(data)) {
    for (const key of ['data', 'qr_codes', 'items', 'options', 'campaigns']) {
      if (Array.isArray(data[key])) return data[key] as unknown[];
    }
  }
  return [];
}

export function normalizeQrCode(raw: unknown): QrCode | null {
  if (!isObject(raw)) return null;
  const id = num(raw.id);
  const publicCode = text(raw.public_code) ?? text(raw.code);
  if (id === null || !publicCode) return null;
  const campaign = isObject(raw.campaign) ? raw.campaign : isObject(raw.memory) ? raw.memory : null;
  const memoryId = num(raw.memory_id) ?? (campaign ? num(campaign.id) : null);
  const campaignTitle = text(raw.campaign_title) ?? (campaign ? text(campaign.title) : null);
  const scans = num(raw.scan_count) ?? num(raw.scans) ?? 0;
  return {
    id,
    publicCode,
    name: text(raw.name) ?? campaignTitle ?? 'QR code',
    memoryId,
    // A code with no campaign (or one that was deleted) opens nothing.
    campaignTitle: memoryId === null ? null : campaignTitle,
    shortUrl: text(raw.short_url) ?? `${SHORT_URL_BASE}${publicCode}`,
    scanCount: Math.max(0, Math.floor(scans)),
    lastScannedAt: text(raw.last_scanned_at),
  };
}

/** One code from a create / update answer (the code itself, or under data / qr_code). */
export function qrCodeFromResponse(res: unknown): QrCode | null {
  const { data } = body(res);
  return normalizeQrCode(isObject(data) && isObject(data.qr_code) ? data.qr_code : data);
}

export function qrCodesFromResponse(res: unknown): QrCode[] {
  return rows(body(res).data).flatMap((r) => {
    const code = normalizeQrCode(r);
    return code ? [code] : [];
  });
}

export function normalizeCampaignOption(raw: unknown): QrCampaignOption | null {
  if (!isObject(raw)) return null;
  const id = num(raw.id) ?? num(raw.memory_id);
  if (id === null) return null;
  return {
    id,
    title: text(raw.title) ?? 'Untitled campaign',
    coverUrl: text(raw.cover_url) ?? text(raw.cover_image) ?? null,
    published: num(raw.published) ?? 0,
    usable: typeof raw.usable === 'boolean' ? raw.usable : null,
    reason: text(raw.reason),
  };
}

export function campaignOptionsFromResponse(res: unknown, asked = 1): QrOptionsPage {
  const { data, meta } = body(res);
  const options = rows(data).flatMap((r) => {
    const o = normalizeCampaignOption(r);
    return o ? [o] : [];
  });
  const m = meta ?? (isObject(data) ? (isObject(data.meta) ? data.meta : data) : null);
  const page = (m && (num(m.page) ?? num(m.current_page))) || asked;
  const totalPages = (m && (num(m.total_pages) ?? num(m.last_page))) || page;
  return { options, page, totalPages: Math.max(page, totalPages) };
}

/**
 * Whether a code may open this campaign, from its published state:
 * public → ready; view only → ready, with a hint (visitors can't add moments); private (token link) → no, visitors
 * would need to sign in; not published → one click publishes it publicly. Anything else the API refuses → blocked,
 * with the API's reason.
 */
export function campaignUse(o: Pick<QrCampaignOption, 'published' | 'usable'>): CampaignUse {
  let use: CampaignUse;
  if (o.published === 1) use = 'ready';
  else if (o.published === 2) use = 'viewOnly';
  else if (o.published === 3) use = 'private';
  else use = 'unpublished';
  if (o.usable === false && (use === 'ready' || use === 'viewOnly')) return 'blocked';
  return use;
}

export const canPick = (use: CampaignUse): boolean => use === 'ready' || use === 'viewOnly';

/** The hint under a campaign in the picker (none for a public one). */
export function campaignHint(o: Pick<QrCampaignOption, 'published' | 'usable' | 'reason'>): string | null {
  switch (campaignUse(o)) {
    case 'viewOnly': return VIEW_ONLY_HINT;
    case 'private': return PRIVATE_HINT;
    case 'unpublished': return UNPUBLISHED_HINT;
    case 'blocked': return o.reason ?? "Can't be used right now";
    default: return null;
  }
}

/** "Opens: Fall Promo", or "No campaign". */
export const opensLabel = (code: Pick<QrCode, 'campaignTitle' | 'memoryId'>): string =>
  (code.memoryId !== null && code.campaignTitle ? `Opens: ${code.campaignTitle}` : 'No campaign');

/** "0 scans", "1 scan", "1,204 scans". */
export const scansLabel = (n: unknown): string => countLabel(n, 'scan');

/** A file name for a download: "qr-fall-promo.png". */
export function qrFileName(name: string, ext: 'png' | 'svg'): string {
  const slug = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return `qr-${slug || 'code'}.${ext}`;
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
