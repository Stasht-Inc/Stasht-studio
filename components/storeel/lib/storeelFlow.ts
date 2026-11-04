// Storeel flow v2 (Deepak, 4 Nov 2026 — approved design): Create / Edit a Storeel is one full-screen page with TWO
// numbered steps, like the newsletter composer:
//   1 Campaign — the Create Campaign fields (title, category, catalogue / vehicle / Shopify / campaign pickers, cover
//                photo or intro video, media, date, location, tags, label). The live preview shows every moment it
//                will make. NOTHING is saved before "Create Campaign" (POST /memories) — edit: "Save Changes"
//                (PUT /memories/{id}). Once saved it folds to "Campaign created" / "Changes saved" with View campaign
//                and Edit (opens it again; Save Changes = PUT).
//   2 Send     — optional, enabled only once step 1 is saved: the newsletter audience (Single person, All leads, lead
//                groups, lists), email and/or text, a personal message; POST /memories/{id}/storeel-send.
// After saving the top bar has Done (keeps the campaign) and Send Now. There is no Moments step: moments come from
// step 1, and more can be added on the campaign page afterwards.
// Pure, so `node --test` loads it.
import type { AudienceItem, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import { savedPreviewMoments, type PreviewMoment } from './previewMoments.ts';

export type FlowStep = 'campaign' | 'send';
export const FLOW_STEPS: readonly FlowStep[] = ['campaign', 'send'];

export function stepNumber(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step) + 1;
}

export type FlowAction = 'create' | 'save' | 'send' | 'close' | 'revert' | 'done';

export interface FlowView {
  title: 'Create Campaign' | 'Edit Campaign';
  /** Step 1 open (its fields), or folded to "Campaign created" / "Changes saved". */
  campaign: 'open' | 'saved';
  /** Step 2 Send can be used (only once step 1 is saved and folded). */
  sendEnabled: boolean;
  /** The top bar's main button (the phone footer's too). */
  primary: { label: 'Create Campaign' | 'Save Changes' | 'Send Now'; action: 'create' | 'save' | 'send' };
  /** The top bar's other button: Cancel closes (or, on a saved campaign opened again, puts the saved values back). */
  secondary: { label: 'Cancel' | 'Done'; action: 'close' | 'revert' | 'done' };
  /** The top bar's Back arrow: once saved it keeps the campaign, like Done. */
  back: 'close' | 'done';
  savedLabel: 'Campaign created' | 'Changes saved';
  /** Step 2 before step 1 is saved (a muted line). */
  sendLockedLine: string;
  /** Step 2's first line once enabled. */
  sendIntro: string;
  /** Done's toast. */
  doneToast: 'Campaign created' | 'Changes saved';
}

/**
 * What the flow shows. editing: opened on a saved campaign (the campaign page's Edit). saved: step 1 was saved in this
 * flow (Create Campaign, or Save Changes). campaignOpen: step 1's fields are showing.
 */
export function flowView({ editing, saved, campaignOpen }: { editing: boolean; saved: boolean; campaignOpen: boolean }): FlowView {
  const open = campaignOpen || !saved;
  const savedLabel = editing ? 'Changes saved' : 'Campaign created';
  return {
    title: editing ? 'Edit Campaign' : 'Create Campaign',
    campaign: open ? 'open' : 'saved',
    sendEnabled: !open,
    primary: open
      ? (editing || saved ? { label: 'Save Changes', action: 'save' } : { label: 'Create Campaign', action: 'create' })
      : { label: 'Send Now', action: 'send' },
    secondary: open ? { label: 'Cancel', action: saved ? 'revert' : 'close' } : { label: 'Done', action: 'done' },
    back: saved ? 'done' : 'close',
    savedLabel,
    sendLockedLine: editing || saved ? 'Save your changes first — then you can send it now or later.' : 'Save your campaign first — then you can send it now or later.',
    sendIntro: 'Your campaign is saved. Send it now, or do it later.',
    doneToast: savedLabel,
  };
}

// ── Edit: the campaign as step 1 shows it ─────────────────────────────────────────────────────────────────────────
/** What a campaign is filed under. GET /memories/{id} sends category null for the last three (review, 4 Nov). */
export type CategoryKind = 'regular' | 'shopify' | 'car' | 'property' | 'none';
/** Step 1's label for a category Studio can't name here (a property's category seen from the personal view). */
export const CURRENT_CATEGORY = 'Current category';

export interface CampaignSeed {
  id: number;
  title: string;
  /** The name step 1 shows (Shopify, Cars, the category, else CURRENT_CATEGORY). */
  category: string;
  categoryId: number | string | null;
  categoryKind: CategoryKind;
  label: string;
  /** YYYY-MM-DD, or ''. */
  date: string;
  /** YYYY-MM-DD when the campaign spans more than one day, else ''. */
  endDate: string;
  location: string;
  tags: string[];
  /** The chosen cover (memories.last_update_img): a photo or an intro video. */
  cover: { kind: 'photo' | 'video'; url: string } | null;
  slug: string | null;
  /** memories.published: 0 not published, 1 public, 2 view only, 3 private link. */
  published: number;
  isCar: boolean;
  moments: number;
  ownerId: number | null;
  /** The campaign's own moments, as the live preview shows them in Edit. */
  previewMoments: PreviewMoment[];
}

export interface SetupForm {
  title: string;
  category: string;
  label: string;
  date: string;
  endDate: string;
  location: string;
  tags: string[];
}

const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|webm|mkv|m4v)(?:[?#]|$)/i;

const day = (v: unknown): string => {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? '').trim());
  return m ? m[1] : '';
};

/** GET /memories/{id} in any of its envelopes ({success, data: {data: {memory}}}, {data: {memory}}, the memory). */
function memoryOf(raw: unknown): Record<string, any> | null {
  let cur: any = raw;
  for (let depth = 0; depth < 4 && cur && typeof cur === 'object'; depth++) {
    if (cur.memory && typeof cur.memory === 'object') return cur.memory;
    if ('id' in cur && ('title' in cur || 'slug' in cur)) return cur;
    cur = cur.data;
  }
  return null;
}

/** The moments on the campaign: its top-level posts and linked campaigns / vehicles, else the photo count the API gives. */
export function momentsOf(memory: Record<string, any> | null | undefined): number {
  const posts = memory?.posts;
  const linked = Array.isArray(memory?.linked_memories) ? memory.linked_memories.length : 0;
  if (Array.isArray(posts)) return posts.filter((p) => p && (p.parent_id === null || p.parent_id === undefined)).length + linked;
  if (linked) return linked;
  const n = Number(memory?.photos?.count ?? memory?.photos_count ?? memory?.memory_images_count ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** categories: the caller's list (the property view's names its own categories). */
export function seedFromMemory(raw: unknown, categories: ReadonlyArray<{ id?: unknown; name?: unknown }> = []): CampaignSeed | null {
  const m = memoryOf(raw);
  const id = Number(m?.id);
  if (!m || !Number.isInteger(id) || id <= 0) return null;
  const start = day(m.min_uploaded_img_date);
  const end = day(m.max_uploaded_img_date);
  const coverUrl = typeof m.last_update_img === 'string' ? m.last_update_img.trim() : '';
  const ownerId = Number(m.user_id ?? m.user?.id);
  const flag = (v: unknown) => v === true || Number(v) === 1;
  const realId = Number(m.category?.id ?? m.category_id);
  const propertyId = Number(m.property_category_id);
  let category: string;
  let categoryId: number | string | null = null;
  let categoryKind: CategoryKind;
  if (flag(m.is_shopify)) { category = 'Shopify'; categoryId = 'shopify'; categoryKind = 'shopify'; }
  else if (flag(m.is_car)) { category = 'Cars'; categoryKind = 'car'; }
  else if (m.category && typeof m.category === 'object' && String(m.category.name ?? '').trim()) {
    category = String(m.category.name); categoryId = Number.isFinite(realId) && realId > 0 ? realId : null; categoryKind = 'regular';
  } else if (Number.isFinite(propertyId) && propertyId > 0) {
    const named = categories.find((c) => String(c?.id ?? '') === String(propertyId));
    category = named && String(named.name ?? '').trim() ? String(named.name) : CURRENT_CATEGORY; categoryId = propertyId; categoryKind = 'property';
  } else { category = CURRENT_CATEGORY; categoryKind = 'none'; }
  return {
    id,
    title: String(m.title ?? ''),
    category,
    categoryId,
    categoryKind,
    label: String(m.sub_category?.name ?? ''),
    date: start,
    endDate: end && end !== start ? end : '',
    location: String(m.location ?? ''),
    tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
    cover: coverUrl ? { kind: VIDEO_EXTENSIONS.test(coverUrl) ? 'video' : 'photo', url: coverUrl } : null,
    slug: typeof m.slug === 'string' && m.slug.trim() ? m.slug.trim() : null,
    published: Number(m.published) || 0,
    isCar: flag(m.is_car),
    moments: momentsOf(m),
    ownerId: Number.isFinite(ownerId) && ownerId > 0 ? ownerId : null,
    previewMoments: savedPreviewMoments(m),
  };
}

export function formFromSeed(seed: CampaignSeed): SetupForm {
  return {
    title: seed.title, category: seed.category, label: seed.label, date: seed.date, endDate: seed.endDate, location: seed.location, tags: [...seed.tags],
  };
}

export function coverFromSeed(seed: CampaignSeed): CampaignSeed['cover'] {
  return seed.cover ? { ...seed.cover } : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 1, 2026" from YYYY-MM-DD, by its parts (never through the browser's time zone, which can make it a day early). */
function apiDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return '';
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** The date_range PUT /memories/{id} reads: one day, or "start - end". */
export function dateRangeFor(date: string, endDate: string): string {
  const start = apiDay(date ?? '');
  if (!start) return '';
  const end = apiDay(endDate ?? '');
  return end && endDate !== date ? `${start} - ${end}` : start;
}

/**
 * PUT /memories/{id} for step 1 of a saved campaign. The cover is sent only when it changed (null removes it).
 * category_id only when the person picked another category (seededCategory = what step 1 opened with) and it is a real
 * one: a numeric id, or "shopify" for Shopify. Never the cars / website_catalogue placeholders (the API refuses them),
 * and never for an untouched Shopify / Cars / catalogue / property campaign (the API would re-file it and drop its
 * Shopify links) — review, 4 Nov.
 */
export function updatePayload(form: SetupForm, categories: ReadonlyArray<{ id: number | string; name: string }>, cover: { changed: boolean; url: string | null }, seededCategory: string): Record<string, unknown> {
  const body: Record<string, unknown> = { title: form.title.trim() };
  if (form.category !== seededCategory) {
    const category = categories.find((c) => c.name === form.category);
    const id = category?.id;
    if (id === 'shopify' || (id !== undefined && /^\d+$/.test(String(id)))) body.category_id = id;
  }
  body.sub_category_id = form.label.trim() || null;
  const range = dateRangeFor(form.date, form.endDate);
  if (range) body.date_range = range;
  body.location = form.location;
  body.tags = [...form.tags];
  if (cover.changed) body.last_update_img = cover.url;
  return body;
}

// ── Send ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface SendInput {
  audience: AudienceItem[];
  channels: NewsletterChannel[];
  message: string;
  /** One fresh key per Send press, reused when that press is retried (the API then replays, never resends). */
  idempotencyKey: string;
}

/** POST /memories/{id}/storeel-send. The campaign link is never in the message: the API adds each person's own. */
export function sendPayload({ audience, channels, message, idempotencyKey }: SendInput) {
  return {
    audience: audience.map((a) => ({ ...a })),
    channels: (['email', 'sms'] as NewsletterChannel[]).filter((c) => channels.includes(c)),
    message: message.trim(),
    idempotency_key: idempotencyKey,
  };
}

export function newIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
