// Storeel flow v2 (Deepak, 4 Nov 2026; Chris's change the same day: "It should flow just like newsletter"): Create /
// Edit a Storeel is ONE scrolling page like the newsletter composer. Numbered cards, all open, top to bottom:
//   1 Campaign — title, category (+ the catalogue / vehicle / Shopify / campaign picker), cover photo or intro video,
//                date, location, tags, label.
//   2 Moments  — every moment it will have (picked items, photos and videos with their titles and captions), made with
//                the original "Add a Moment" UI (AddMomentModal); captions edited the way the campaign page edits them.
//                Before the campaign exists they're held here and sent with POST /memories; on a saved campaign the
//                original UI works on the campaign directly. The live preview shows every moment.
//   3 Send     — optional: the newsletter audience (Single person, All leads, lead groups, lists), email and/or text,
//                a personal message; POST /memories/{id}/storeel-send.
// The actions sit at the BOTTOM of the list: "Save as Draft" (POST /memories, unpublished and not sent, then closes: the Campaigns list) and
// "Save & Send" (creates, then the send confirm). Edit: "Save Changes" (PUT /memories/{id}) and "Save & Send".
// Nothing is saved before one of them is pressed; a failed save sends nothing. No step gating, no Continue, no primary
// action in the header, no Moments step (more moments are added on the campaign page afterwards).
// Pure, so `node --test` loads it.
import type { AudienceItem, NewsletterChannel } from '../../../services/newslettersAPI.ts';
import { savedPreviewMoments, type PreviewMoment } from './previewMoments.ts';

export type FlowStep = 'campaign' | 'moments' | 'send';
export const FLOW_STEPS: readonly FlowStep[] = ['campaign', 'moments', 'send'];

export function stepNumber(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step) + 1;
}

export interface FlowView {
  title: 'Create Campaign' | 'Edit Campaign';
  /** The bottom "save only" action: POST (create) or PUT (save). */
  save: { label: 'Save as Draft' | 'Save Changes'; action: 'create' | 'save' };
  /** The bottom primary action: the same save, then the send confirm. */
  saveAndSend: { label: 'Save & Send'; action: 'create' | 'save' };
  /** The toast after the save-only action (the flow closes). */
  savedToast: 'Saved as a draft' | 'Changes saved';
  /** Send card's first line. */
  sendOptional: string;
  /** Above the bottom actions once Save & Send made the campaign but the send wasn't confirmed. */
  createdNote: string | null;
  /** The toast when the flow is closed (Back / Cancel) after the campaign was made in it. */
  closeToast: 'Saved as a draft' | null;
  /** The bottom / top bar Cancel: "Close" once something is already saved on the campaign (nothing to cancel). */
  closeLabel: 'Cancel' | 'Close';
  /** Step 2's line on a saved campaign: moments and captions are saved at once there, as on the campaign page. */
  momentsNote: string | null;
}

/**
 * What the page shows. editing: opened on a saved campaign (the campaign page's Edit). created: Save & Send made the
 * campaign in this flow (its send was not confirmed yet), so saving again is a PUT, never a second campaign.
 */
export function flowView({ editing, created, savedNow = false, changesSaved = false }: {
  editing: boolean;
  created: boolean;
  /** A caption or a moment was saved straight to the saved campaign (step 2). */
  savedNow?: boolean;
  /** Edit: Save & Send saved the changes (PUT) but the send wasn't confirmed. */
  changesSaved?: boolean;
}): FlowView {
  const saved = editing || created;
  return {
    title: saved ? 'Edit Campaign' : 'Create Campaign',
    save: saved ? { label: 'Save Changes', action: 'save' } : { label: 'Save as Draft', action: 'create' },
    saveAndSend: saved ? { label: 'Save & Send', action: 'save' } : { label: 'Save & Send', action: 'create' },
    savedToast: saved ? 'Changes saved' : 'Saved as a draft',
    sendOptional: 'Optional — send it now or later from the campaign page.',
    createdNote: created && !editing ? 'Saved as a draft. Send it now, or later from the campaign page.'
      : editing && changesSaved ? 'Changes saved. Send it now, or later.' : null,
    closeToast: created && !editing ? 'Saved as a draft' : null,
    closeLabel: created || savedNow || changesSaved ? 'Close' : 'Cancel',
    momentsNote: saved ? 'Moments and captions save straight to your campaign.' : null,
  };
}

/** Why Save as Draft / Save Changes is off (said above the actions). null: it can be pressed. */
export function saveBlockedReason({ title, category, coverUploading }: { title: string; category: string; coverUploading: boolean }): string | null {
  if (!title.trim()) return 'Add a campaign title.';
  if (!category) return 'Pick a category.';
  if (coverUploading) return 'Wait for the cover to finish uploading.';
  return null;
}

/** Save as Draft's toast: a filled-in Send card is not sent by it (only Save & Send sends). */
export function createdToast(sendFilled: boolean): string {
  return sendFilled ? 'Saved as a draft — not sent.' : 'Saved as a draft';
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
