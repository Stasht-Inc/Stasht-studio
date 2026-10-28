// [wdy2xh2t3w] The Campaigns section: one card per campaign (cover, title, description, "View campaign").
// Pure, so `node --test` loads it directly. Shared contract 2026-10-28: Studio sends campaign_ids only; the API
// keeps the ones the owner can share and answers with its own `items` snapshot.
import type { CampaignItem, CampaignOption } from '../../../services/newslettersAPI.ts';
import { httpsUrl } from './urls.ts';
import { contrastInk, safeHexColor } from './colors.ts';

/** Most campaigns one section can show. */
export const CAMPAIGNS_MAX = 6;
/** The API's description limit (plain text). */
export const CAMPAIGN_DESCRIPTION_MAX = 160;

const positiveInt = (v: unknown): number | null => {
  const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
};

/** campaign_ids as the editor keeps them: whole numbers, each once, in order, at most CAMPAIGNS_MAX. */
export function normaliseCampaignIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const id = positiveInt(v);
    if (id !== null && !out.includes(id)) out.push(id);
    if (out.length === CAMPAIGNS_MAX) break;
  }
  return out;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** The API's snapshot cards, kept only when they have an id and a title. */
export function normaliseCampaignItems(raw: unknown): CampaignItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CampaignItem[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const id = positiveInt(r.id);
    if (id === null || typeof r.title !== 'string') continue;
    out.push({
      id, title: r.title, description: str(r.description), cover_url: httpsUrl(str(r.cover_url)) ?? null,
      url: str(r.url), date: typeof r.date === 'string' && r.date ? r.date : null,
    });
  }
  return out;
}

/** Tick or untick one campaign. Picking order is kept; a seventh is refused (the same array comes back). */
export function toggleCampaign(ids: readonly number[], id: number, max: number = CAMPAIGNS_MAX): number[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= max) return ids as number[];
  return [...ids, id];
}

/** The cards to draw, in the section's order: the server's snapshot first (what the email will show), then the
 *  picked campaigns' own details until the save comes back. Ids with neither are left out. */
export function resolveCampaignItems(ids: readonly number[], server: readonly CampaignItem[] | undefined, local: readonly CampaignItem[] | undefined): CampaignItem[] {
  const byId = new Map<number, CampaignItem>();
  for (const i of local ?? []) byId.set(i.id, i);
  for (const i of server ?? []) byId.set(i.id, i);
  return ids.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
}

/** A picked option, drawn as a card before the save answers. */
export function itemFromOption(o: CampaignOption): CampaignItem {
  return {
    id: o.id,
    title: o.title,
    description: str(o.description).slice(0, CAMPAIGN_DESCRIPTION_MAX),
    cover_url: httpsUrl(str(o.cover_url)) ?? null,
    url: str(o.public_url),
    date: o.date ?? null,
  };
}

export function campaignsPickerSummary(count: number): string {
  if (count === 0) return `Pick up to ${CAMPAIGNS_MAX} campaigns.`;
  if (count >= CAMPAIGNS_MAX) return `${CAMPAIGNS_MAX} of ${CAMPAIGNS_MAX} picked. That’s the most one section can show.`;
  return `${count} of ${CAMPAIGNS_MAX} picked`;
}

/** A campaign's date (YYYY-MM-DD, a calendar day) in the person's language, or ''. */
export function formatCampaignDate(date: string | null | undefined, locale?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** The "View campaign" button (NewsletterRenderer::blockView): the header colour, unless it is too light to show
 *  on the white card (then purple). */
export function campaignButtonColor(headerColor: string | null | undefined): string {
  const brand = safeHexColor(headerColor, '#6C60FF');
  return contrastInk(brand) === '#FFFFFF' ? brand : '#6C60FF';
}
