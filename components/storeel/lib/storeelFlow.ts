// Chris, 4 Nov 2026, point 9 (Deepak's decisions): Create / Edit a Storeel is one full-screen page with three numbered
// steps, like the newsletter composer:
//   1 Set up   — the Create Campaign fields. Continue saves: POST /memories (new) or PUT /memories/{id} (edit).
//   2 Moments  — a link to the campaign page, where moments are added (no moments editor in the flow). Coming back
//                resumes on step 3 for that campaign (a note in sessionStorage, read by the Campaigns page and the
//                campaign page).
//   3 Send     — the newsletter audience (Single person, All leads, lead groups, lists), email and/or text, a personal
//                message; POST /memories/{id}/storeel-send sends it as tracked Storeels.
// Pure, so `node --test` loads it.
import type { AudienceItem, NewsletterChannel } from '../../../services/newslettersAPI.ts';

export type FlowStep = 'setup' | 'moments' | 'send';
export const FLOW_STEPS: readonly FlowStep[] = ['setup', 'moments', 'send'];

export function stepNumber(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step) + 1;
}

/** Where the flow opens: Set up, unless it is coming back to a saved campaign (then the step it left for). */
export function startStep({ campaignId, resume = null }: { campaignId: number | null; resume?: FlowStep | null }): FlowStep {
  return campaignId && resume ? resume : 'setup';
}

export type StepStatus = 'current' | 'done' | 'locked';

/** A card is the step being worked on, one already done, or one not reached yet (nothing past Set up until saved). */
export function stepStatus(step: FlowStep, current: FlowStep, saved: boolean): StepStatus {
  if (step === current) return 'current';
  if (!saved && step !== 'setup') return 'locked';
  return FLOW_STEPS.indexOf(step) < FLOW_STEPS.indexOf(current) ? 'done' : 'locked';
}

// ── Coming back from the campaign page ────────────────────────────────────────────────────────────────────────────
export const FLOW_RESUME_KEY = 'stasht_storeel_flow_resume';
/** A note older than this is forgotten (the person went on to something else). */
export const FLOW_RESUME_MAX_AGE_MS = 30 * 60 * 1000;

type NoteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface FlowResume { memoryId: number; step: FlowStep; at: number }

/**
 * Whose note it is: the signed-in account and the view it was written in (personal, or a business's property view).
 * Another sign-in, another business or the other view never resumes it (review, 4 Nov). null: nobody signed in.
 */
export function flowOwnerKey(user: { id?: unknown } | null | undefined, viewType: unknown, property: { id?: unknown } | null | undefined): string | null {
  const id = user?.id === null || user?.id === undefined ? '' : String(user.id).trim();
  if (!id) return null;
  const pid = property?.id === null || property?.id === undefined ? '' : String(property.id).trim();
  return viewType === 'property' && pid ? `${id}|property:${pid}` : `${id}|personal`;
}

/** "Add moments on the campaign page": remember to come back to Send for this campaign (for this account and view). */
export function writeFlowResume(storage: NoteStorage | null | undefined, memoryId: number, owner: string | null, now: number = Date.now()): void {
  if (!owner) return;
  try {
    storage?.setItem(FLOW_RESUME_KEY, JSON.stringify({ memoryId, step: 'send', at: now, owner }));
  } catch {
    // Storage blocked (private window): the campaign page's own Edit still opens the flow.
  }
}

/** The note, if it is fresh, this account's and view's (and for this campaign, when one is given); null otherwise. */
export function readFlowResume(storage: NoteStorage | null | undefined, owner: string | null, { now = Date.now(), memoryId }: { now?: number; memoryId?: number } = {}): FlowResume | null {
  if (!owner) return null;
  try {
    const raw = storage?.getItem(FLOW_RESUME_KEY);
    if (!raw) return null;
    const note = JSON.parse(raw) as Partial<FlowResume> & { owner?: unknown };
    if (note?.owner !== owner) return null;
    const id = Number(note?.memoryId);
    const at = Number(note?.at);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(at)) return null;
    if (now - at > FLOW_RESUME_MAX_AGE_MS || at - now > 60_000) return null;
    if (memoryId !== undefined && Number(memoryId) !== id) return null;
    const step: FlowStep = note.step === 'moments' || note.step === 'setup' ? note.step : 'send';
    return { memoryId: id, step, at };
  } catch {
    return null;
  }
}

export function clearFlowResume(storage: NoteStorage | null | undefined): void {
  try {
    storage?.removeItem(FLOW_RESUME_KEY);
  } catch {
    // ignore
  }
}

/** The tab's sessionStorage, or null where there is none (tests, blocked storage). */
export function sessionNotes(): NoteStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

// ── Edit: the campaign as Set up shows it ─────────────────────────────────────────────────────────────────────────
/** What a campaign is filed under. GET /memories/{id} sends category null for the last three (review, 4 Nov). */
export type CategoryKind = 'regular' | 'shopify' | 'car' | 'property' | 'none';
/** Set up's label for a category Studio can't name here (a property's category seen from the personal view). */
export const CURRENT_CATEGORY = 'Current category';

export interface CampaignSeed {
  id: number;
  title: string;
  /** The name Set up shows (Shopify, Cars, the category, else CURRENT_CATEGORY). */
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
  /** The first moment's picture (the preview's moment card). */
  firstImage: string | null;
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

/** The moments on the campaign: its top-level posts, else the photo count the API gives. */
export function momentsOf(memory: Record<string, any> | null | undefined): number {
  const posts = memory?.posts;
  if (Array.isArray(posts)) return posts.filter((p) => p && (p.parent_id === null || p.parent_id === undefined)).length;
  const n = Number(memory?.photos?.count ?? memory?.photos_count ?? memory?.memory_images_count ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The first top-level moment's picture (not a video), else the API's preview image, else null. */
export function firstImageOf(memory: Record<string, any> | null | undefined): string | null {
  const pick = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v.trim()) && !VIDEO_EXTENSIONS.test(v) ? v.trim() : null);
  const posts = Array.isArray(memory?.posts) ? memory.posts.filter((p: any) => p && (p.parent_id === null || p.parent_id === undefined)) : [];
  for (const p of posts) {
    const url = pick(p.image_link) ?? pick(p.master_image_link) ?? pick(p.media_url);
    if (url) return url;
  }
  const preview = Array.isArray(memory?.photos?.preview_images) ? memory.photos.preview_images[0] : null;
  return pick(preview?.url);
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
    firstImage: firstImageOf(m),
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
 * PUT /memories/{id} for Set up of a saved campaign. The cover is sent only when it changed (null removes it).
 * category_id only when the person picked another category (seededCategory = what Set up opened with) and it is a real
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
