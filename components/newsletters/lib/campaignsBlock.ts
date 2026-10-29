// [wdy2xh2t3w] The Campaigns section: one card per campaign, product or vehicle (cover, title, price, details,
// description, "View campaign" / "View product" / "View vehicle"). Pure, so `node --test` loads it directly.
// Shared contracts 2026-10-28 and 2026-10-29: Studio sends selections (+ campaign_ids); the API keeps what the
// owner can share and answers with its own `items` snapshot.
import type { CampaignColumns, CampaignItem, CampaignKind, CampaignOption, CampaignSelection, CardOverride, CardOverrides } from '../../../services/newslettersAPI.ts';
import { httpsUrl } from './urls.ts';
import { contrastInk, safeHexColor } from './colors.ts';
import { formatCarCategory } from '../../../utils/carCategories.ts';

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
/** A short display string, or null when empty. */
const line = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const CAMPAIGN_KINDS: readonly CampaignKind[] = ['campaign', 'product', 'vehicle'];
const isKind = (v: unknown): v is CampaignKind => CAMPAIGN_KINDS.includes(v as CampaignKind);
const kindOf = (v: unknown): CampaignKind => (isKind(v) ? v : 'campaign');

export const selectionKey = (s: { kind?: CampaignKind; id: number }): string => `${s.kind ?? 'campaign'}:${s.id}`;

/** The section's picks: from `selections` when the block has them (even none), else an older block's campaign_ids
 *  read as campaigns. Known kinds and whole ids only, each once, in order, at most CAMPAIGNS_MAX. */
export function normaliseSelections(selections: unknown, campaignIds?: unknown): CampaignSelection[] {
  if (!Array.isArray(selections)) return normaliseCampaignIds(campaignIds).map((id) => ({ kind: 'campaign', id }));
  const out: CampaignSelection[] = [];
  const seen = new Set<string>();
  for (const v of selections) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const id = positiveInt(r.id);
    if (id === null || !isKind(r.kind)) continue;
    const pick = { kind: r.kind, id };
    if (seen.has(selectionKey(pick))) continue;
    seen.add(selectionKey(pick));
    out.push(pick);
    if (out.length === CAMPAIGNS_MAX) break;
  }
  return out;
}

/** The campaign-kind ids, in order: what the block keeps as campaign_ids for older readers. */
export function campaignIdsOf(selections: readonly CampaignSelection[]): number[] {
  return selections.filter((s) => s.kind === 'campaign').map((s) => s.id);
}

/** A link a card may point at: a campaign's public page or a product's / vehicle's own page (http or https). */
export function webUrl(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) return '';
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

/** The API's snapshot cards, kept only when they have a known kind (campaign when missing), an id and a title. */
export function normaliseCampaignItems(raw: unknown): CampaignItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CampaignItem[] = [];
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const id = positiveInt(r.id);
    if (id === null || typeof r.title !== 'string') continue;
    if (r.kind !== undefined && r.kind !== null && !isKind(r.kind)) continue;
    out.push({
      kind: kindOf(r.kind), id, title: r.title, description: str(r.description), cover_url: httpsUrl(str(r.cover_url)) ?? null,
      url: webUrl(r.url), date: typeof r.date === 'string' && r.date ? r.date : null, price_text: line(r.price_text), meta: line(r.meta),
    });
  }
  return out;
}

/** Tick or untick one pick, whatever its kind. Picking order is kept; a seventh in all is refused (the same array
 *  comes back). */
export function toggleSelection(list: readonly CampaignSelection[], pick: CampaignSelection, max: number = CAMPAIGNS_MAX): CampaignSelection[] {
  const key = selectionKey(pick);
  if (list.some((s) => selectionKey(s) === key)) return list.filter((s) => selectionKey(s) !== key);
  if (list.length >= max) return list as CampaignSelection[];
  return [...list, { kind: pick.kind, id: pick.id }];
}

/** Tick or untick one campaign. Picking order is kept; a seventh is refused (the same array comes back). */
export function toggleCampaign(ids: readonly number[], id: number, max: number = CAMPAIGNS_MAX): number[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= max) return ids as number[];
  return [...ids, id];
}

/** A row in the picker can't be ticked when the campaign can't be shared or 6 are picked; a ticked one can always
 *  be unticked (it may have stopped being shareable since it was picked). */
export function campaignOptionDisabled(option: Pick<CampaignOption, 'shareable'>, checked: boolean, full: boolean): boolean {
  if (checked) return false;
  return !option.shareable || full;
}

/** The cards to draw, in the section's order: the server's snapshot first (what the email will show), then the
 *  picked items' own details until the save comes back. Picks with neither are left out. */
export function resolveCampaignItems(selections: readonly CampaignSelection[], server: readonly CampaignItem[] | undefined, local: readonly CampaignItem[] | undefined): CampaignItem[] {
  const byKey = new Map<string, CampaignItem>();
  for (const i of local ?? []) byKey.set(selectionKey(i), i);
  for (const i of server ?? []) byKey.set(selectionKey(i), i);
  return selections.flatMap((s) => {
    const found = byKey.get(selectionKey(s));
    return found ? [found] : [];
  });
}

/** A picked option, drawn as a card before the save answers. kind: the tab it was picked on, for an older API
 *  that doesn't say. */
export function itemFromOption(o: CampaignOption, kind: CampaignKind = 'campaign'): CampaignItem {
  return {
    kind: isKind(o.kind) ? o.kind : kind,
    id: o.id,
    title: o.title,
    description: str(o.description).slice(0, CAMPAIGN_DESCRIPTION_MAX),
    cover_url: httpsUrl(str(o.cover_url)) ?? null,
    url: webUrl(o.public_url),
    date: o.date ?? null,
    price_text: line(o.price_text),
    meta: line(o.meta),
  };
}

export type KindCounts = Partial<Record<CampaignKind, number>>;
const has = (counts: KindCounts | undefined, kind: CampaignKind) => (counts?.[kind] ?? 0) > 0;

/** The picker's tabs: Campaigns always; Products and Vehicles only when the owner has some. */
export function pickerKinds(counts: KindCounts | undefined): CampaignKind[] {
  return CAMPAIGN_KINDS.filter((k) => k === 'campaign' || has(counts, k));
}

/** The tab the picker opens on: the first one with something in it (Campaigns when none has). */
export function pickerDefaultKind(counts: KindCounts | undefined): CampaignKind {
  return CAMPAIGN_KINDS.find((k) => has(counts, k)) ?? 'campaign';
}

/** multi: the owner has products or vehicles too (otherwise today's words stay). */
export function pickerTitle(multi: boolean): string {
  return multi ? 'Choose campaigns, products or vehicles' : 'Choose campaigns';
}

export function pickerSummary(count: number, multi: boolean): string {
  if (!multi) return campaignsPickerSummary(count);
  if (count === 0) return `Pick up to ${CAMPAIGNS_MAX}.`;
  if (count >= CAMPAIGNS_MAX) return `${CAMPAIGNS_MAX} of ${CAMPAIGNS_MAX} chosen. That’s the most one section can show.`;
  return `${count} of ${CAMPAIGNS_MAX} chosen`;
}

const BUTTON_LABELS: Record<CampaignKind, string> = { campaign: 'View campaign', product: 'View product', vehicle: 'View vehicle' };
/** The card's button, as the email words it. */
export function itemButtonLabel(kind: CampaignKind | undefined): string {
  return BUTTON_LABELS[kindOf(kind)];
}

/** The second line of a picker row: products and vehicles show their price and details, campaigns their date. */
export function optionLine(o: Pick<CampaignOption, 'kind' | 'price_text' | 'meta' | 'date'>, locale?: string): { price: string | null; detail: string | null } {
  if (kindOf(o.kind) === 'campaign') return { price: null, detail: formatCampaignDate(o.date, locale) || null };
  return { price: line(o.price_text), detail: line(o.meta) };
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

/** The section's "Edit" button and toolbar icon: they open the picker (which holds all three kinds). Was "Change"
 *  until Chris's 29 Oct feedback. */
export const EDIT_ITEMS_LABEL = 'Edit campaigns, products or vehicles';

/** A new section's layout (shared brief 2026-10-29 round 2): cards side by side. */
export const NEW_SECTION_COLUMNS: CampaignColumns = 2;

/** columns as the API sends them: 1 or 2, or undefined (a section from before columns, which reads as 1). */
export function normaliseColumns(raw: unknown): CampaignColumns | undefined {
  const n = typeof raw === 'string' && /^[12]$/.test(raw) ? Number(raw) : raw;
  return n === 1 || n === 2 ? n : undefined;
}

/** The section's layout: 2 only when it says so (absent = 1, so older sections look as they always did). */
export function campaignColumns(data: { columns?: unknown }): CampaignColumns {
  return normaliseColumns(data.columns) ?? 1;
}

/** The most cards side by side in the preview: the email shows 1 column on phones, whatever the section says. */
export function previewColumns(data: { columns?: unknown }, phone: boolean): CampaignColumns {
  return phone ? 1 : campaignColumns(data);
}

const MISSING_NOTES: Record<CampaignKind, string> = {
  campaign: 'A campaign picked here can’t be shown any more (it may no longer be published), so it’s left out of the email.',
  product: 'A product picked here can’t be shown any more (it may no longer be available), so it’s left out of the email.',
  vehicle: 'A vehicle picked here can’t be shown any more (it may have sold), so it’s left out of the email.',
};

/** Why the email has fewer cards than picks (the API dropped some on save), or '' when nothing is missing. */
export function missingItemsNote(selections: readonly CampaignSelection[], cards: ReadonlyArray<{ kind?: CampaignKind; id: number }>): string {
  const shown = new Set(cards.map(selectionKey));
  const kinds = new Set(selections.filter((s) => !shown.has(selectionKey(s))).map((s) => s.kind));
  if (!kinds.size) return '';
  if (kinds.size > 1) return 'Some picks here can’t be shown any more, so they’re left out of the email.';
  return MISSING_NOTES[[...kinds][0]];
}

/** A category in the picker's filter. The API sends vehicle categories as cars.category has them ("preowned"):
 *  they read as the Studio cars cards label them ("Preowned"); the raw value is what goes back to the API. */
export function categoryLabel(kind: CampaignKind, raw: string): string {
  return kind === 'vehicle' ? formatCarCategory(raw) : raw;
}

// ---- Per-card edits (Chris, 29 Oct round 2): for this newsletter only; the catalogue and the campaign never change.

/** The API's limits for a card's edits (shared brief 2026-10-29 round 2). */
export const CARD_LIMITS = { title: 120, description: 300, button_text: 30 } as const;
const OVERRIDE_FIELDS = ['image_url', 'title', 'description', 'button_text'] as const;
type OverrideField = typeof OVERRIDE_FIELDS[number];
const KEY = /^(campaign|product|vehicle):[1-9]\d*$/;

/** A card's edits as the API sends them: known keys and fields, non-empty strings only. An empty PHP array ([]) is no
 *  edits; nothing at all (an API from before edits, or an older section) stays undefined. */
export function normaliseOverrides(raw: unknown): CardOverrides | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CardOverrides = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEY.test(key) || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    const o: CardOverride = {};
    for (const f of OVERRIDE_FIELDS) if (typeof r[f] === 'string' && (r[f] as string).trim()) o[f] = r[f] as string;
    if (Object.keys(o).length) out[key] = o;
  }
  return out;
}

/** True when the card has an edit that would show. */
export function cardHasEdits(o: CardOverride | undefined | null): boolean {
  return Boolean(o && OVERRIDE_FIELDS.some((f) => typeof o[f] === 'string' && (o[f] as string).trim()));
}

/** Change some of one card's fields (as typed; '' or null clears that field). A card with no field left is dropped. */
export function setCardOverride(overrides: CardOverrides | undefined, key: string, patch: CardOverride): CardOverrides {
  const card: CardOverride = { ...(overrides?.[key] ?? {}), ...patch };
  for (const f of OVERRIDE_FIELDS) if (card[f] === '' || card[f] === null || card[f] === undefined) delete card[f];
  const out: CardOverrides = { ...(overrides ?? {}) };
  if (Object.keys(card).length) out[key] = card;
  else delete out[key];
  return out;
}

/** "Reset to original": the card shows the item's own image and words again. */
export function resetCardOverride(overrides: CardOverrides | undefined, key: string): CardOverrides {
  const out: CardOverrides = { ...(overrides ?? {}) };
  delete out[key];
  return out;
}

/** Card text as the API keeps it (29 Oct): plain, every run of spaces or line breaks one space, trimmed; the limits
 *  count after that. */
export const plainCardText = (v: string): string => v.replace(/\s+/g, ' ').trim();
const plainText = plainCardText;

const cleanField = (f: OverrideField, v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  if (f === 'image_url') return httpsUrl(v.trim()) ?? null;
  const text = plainText(v).slice(0, CARD_LIMITS[f]).trim();
  return text || null;
};

/** The edits as a PUT sends them: only cards still picked (in the picks' order), only the four fields (in a fixed
 *  order), trimmed, within the limits, https images. Empty fields and cards are left out. */
export function overridesForInput(overrides: CardOverrides | undefined, selections: readonly CampaignSelection[]): CardOverrides {
  const out: CardOverrides = {};
  if (!overrides) return out;
  for (const s of selections) {
    const key = selectionKey(s);
    const raw = overrides[key];
    if (!raw || typeof raw !== 'object') continue;
    const o: CardOverride = {};
    for (const f of OVERRIDE_FIELDS) {
      const v = cleanField(f, raw[f]);
      if (v) o[f] = v;
    }
    if (Object.keys(o).length) out[key] = o;
  }
  return out;
}

/** Edits of cards no longer picked are dropped (the picker took them out). */
export function pruneOverrides(overrides: CardOverrides | undefined, selections: readonly CampaignSelection[]): CardOverrides | undefined {
  if (!overrides) return overrides;
  const keep = new Set(selections.map(selectionKey));
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => keep.has(key)));
}

/** A card as the email draws it: the edit when there is one, the item's own value otherwise. The link is always
 *  the item's own. */
export function displayCard(item: CampaignItem, o: CardOverride | undefined | null): { image: string | null; title: string; description: string; button: string; url: string } {
  const pick = (f: OverrideField) => (o ? cleanField(f, o[f]) : null);
  return {
    image: pick('image_url') ?? item.cover_url,
    title: pick('title') ?? item.title,
    description: pick('description') ?? item.description,
    button: pick('button_text') ?? itemButtonLabel(item.kind),
    url: item.url,
  };
}

const PAGE_OF: Record<CampaignKind, string> = { campaign: 'the campaign’s page', product: 'the product’s page', vehicle: 'the vehicle’s page' };
/** The note in a card's editor: what changes, and that the link doesn't. */
export function cardEditNote(kind: CampaignKind | undefined): string {
  return `Changes show in this newsletter only. Leave a box empty to keep the original. The card still opens ${PAGE_OF[kindOf(kind)]}.`;
}

/** The section change for one card's edit, worked out from the section as it is now (never a copy from an earlier
 *  render). null when the card is no longer picked (an upload that finished after it was taken out). */
export function cardEditPatch(latest: { selections?: unknown; campaign_ids?: unknown; overrides?: CardOverrides }, key: string, patch: CardOverride): { overrides: CardOverrides } | null {
  if (!normaliseSelections(latest.selections, latest.campaign_ids).some((s) => selectionKey(s) === key)) return null;
  return { overrides: setCardOverride(latest.overrides, key, patch) };
}

/** "Reset to original" as a section change, from the section as it is now. */
export function cardResetPatch(latest: { overrides?: CardOverrides }, key: string): { overrides: CardOverrides } {
  return { overrides: resetCardOverride(latest.overrides, key) };
}

/** Where a card's editor goes: after the last card of that card's row (perRow: the cards a row as shown). */
export function cardEditorAfter(index: number, count: number, perRow: 1 | 2): number {
  return perRow === 2 ? Math.min(index | 1, count - 1) : index;
}
