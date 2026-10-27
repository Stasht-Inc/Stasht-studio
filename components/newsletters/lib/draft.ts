import type {
  AudienceItem, Newsletter, NewsletterBlock, NewsletterChannel, NewsletterHeader, NewsletterInput,
} from '../../../services/newslettersAPI.ts';
import { LIMITS, isPlausibleEmail, smsPlain } from './rules.ts';
import { normaliseBlocks, overLimitTextIds } from './blocks.ts';

/** What the composer edits. Text fields are never null here ('' instead). */
export interface NewsletterDraft {
  name: string;
  subject: string;
  preview_text: string;
  from_name: string;
  reply_to_email: string;
  channels: NewsletterChannel[];
  sms_text: string;
  template: 'basic';
  header: NewsletterHeader;
  blocks: NewsletterBlock[];
  audience: AudienceItem[];
  /** The time picked under Schedule for later, kept while it is a draft (never used to send). ISO UTC or null. */
  planned_send_at: string | null;
}

export const DEFAULT_HEADER: NewsletterHeader = { logo_url: null, banner_url: null, background_color: '#6C60FF', title: null };

const TEXT_FIELDS = ['name', 'subject', 'preview_text', 'from_name', 'reply_to_email', 'sms_text'] as const;

export function headerFrom(header?: Partial<NewsletterHeader> | null): NewsletterHeader {
  return { ...DEFAULT_HEADER, ...(header || {}) };
}

export function emptyDraft(header?: Partial<NewsletterHeader> | null): NewsletterDraft {
  return {
    name: '', subject: '', preview_text: '', from_name: '', reply_to_email: '',
    channels: ['email'], sms_text: '', template: 'basic', header: headerFrom(header), blocks: [], audience: [{ type: 'all_leads' }],
    planned_send_at: null,
  };
}

export function draftFromNewsletter(n: Newsletter): NewsletterDraft {
  return {
    name: n.name ?? '',
    subject: n.subject ?? '',
    preview_text: n.preview_text ?? '',
    from_name: n.from_name ?? '',
    reply_to_email: n.reply_to_email ?? '',
    channels: Array.isArray(n.channels) ? [...n.channels] : ['email'],
    sms_text: n.sms_text ?? '',
    template: 'basic',
    header: headerFrom(n.header),
    blocks: normaliseBlocks(n.blocks),
    audience: Array.isArray(n.audience) ? n.audience : [],
    planned_send_at: typeof n.planned_send_at === 'string' && n.planned_send_at ? n.planned_send_at : null,
  };
}

/** The PUT body for a draft: text trimmed, empty text as null. A blank name is left out: the API requires a
 *  name whenever one is sent (`name: sometimes|required`), and every draft already has the server's default. */
export function draftToInput(d: NewsletterDraft): NewsletterInput {
  const input: NewsletterInput = {
    channels: d.channels, template: d.template, header: d.header, blocks: d.blocks, audience: d.audience, planned_send_at: d.planned_send_at ?? null,
  };
  for (const key of TEXT_FIELDS) {
    const value = d[key].trim();
    if (key === 'name' && value === '') continue;
    input[key] = value === '' ? null : value;
  }
  return input;
}

function isEmptyValue(value: unknown): boolean {
  return value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
}

/**
 * After POST /newsletters: the server fills in a default name, from name, reply-to and the brand header. Show
 * them for every field the person has not touched yet; an empty server value never replaces a local default
 * (the draft starts with All leads, the server with no audience).
 */
export function mergeUntouched(local: NewsletterDraft, server: NewsletterDraft, touched: ReadonlySet<string>): NewsletterDraft {
  const out = { ...local } as Record<keyof NewsletterDraft, unknown>;
  for (const key of Object.keys(server) as Array<keyof NewsletterDraft>) {
    if (!touched.has(key) && !isEmptyValue(server[key])) out[key] = server[key];
  }
  return out as unknown as NewsletterDraft;
}

/**
 * What a save can send now: every changed field except one that would not pass (a half-typed reply-to). Those
 * are `held`: left out of the patch and kept different from `nextSaved`, so they save once they are fixed.
 */
export function savableChanges(saved: NewsletterDraft, current: NewsletterDraft): { patch: NewsletterInput; nextSaved: NewsletterDraft; held: Array<keyof NewsletterDraft> } {
  const patch = changedFields(saved, current) as Record<string, unknown>;
  const problems = fieldProblems(current);
  const held = (Object.keys(problems) as Array<keyof NewsletterDraft>).filter((key) => key in patch);
  if (!held.length && !Object.keys(patch).length) return { patch: {}, nextSaved: saved, held: [] };
  const nextSaved = { ...current } as Record<keyof NewsletterDraft, unknown>;
  for (const key of held) {
    delete patch[key];
    nextSaved[key] = saved[key];
  }
  // An over-long text section keeps its saved version (a new one is left out); every other section still saves.
  const tooLong = overLimitTextIds(current.blocks);
  if (tooLong.size && 'blocks' in patch) {
    const savedById = new Map(saved.blocks.map((b) => [b.id, b]));
    const savable = current.blocks.flatMap((b) => {
      if (!tooLong.has(b.id)) return [b];
      const before = savedById.get(b.id);
      return before ? [before] : [];
    });
    if (JSON.stringify(savable) === JSON.stringify(saved.blocks)) delete patch.blocks;
    else patch.blocks = savable;
    nextSaved.blocks = savable;
    held.push('blocks');
  }
  return { patch: patch as NewsletterInput, nextSaved: nextSaved as unknown as NewsletterDraft, held };
}

/** The fields of a PUT patch that a 422 refused (its error keys, by first part: 'blocks.2.data.url' → blocks). */
export function rejectedKeys(patch: NewsletterInput, fieldErrors: Record<string, string>): Array<keyof NewsletterInput> {
  const roots = new Set(Object.keys(fieldErrors).map((k) => k.split('.')[0]));
  return (Object.keys(patch) as Array<keyof NewsletterInput>).filter((k) => roots.has(k));
}

/** The fields of `current` that differ from `saved`, as a PUT body. Everything when nothing is saved yet. */
export function changedFields(saved: NewsletterDraft | null, current: NewsletterDraft): NewsletterInput {
  const next = draftToInput(current);
  if (!saved) return next;
  const before = draftToInput(saved);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(next) as Array<keyof NewsletterInput>) {
    if (JSON.stringify(next[key]) !== JSON.stringify(before[key])) out[key] = next[key];
  }
  return out as NewsletterInput;
}

const tooLong = (max: number) => `Use ${max} characters or fewer.`;

/** Checks shown while typing. Keys are draft fields. */
export function fieldProblems(d: NewsletterDraft): Partial<Record<keyof NewsletterDraft, string>> {
  const out: Partial<Record<keyof NewsletterDraft, string>> = {};
  if (d.name.length > LIMITS.name) out.name = tooLong(LIMITS.name);
  if (d.subject.length > LIMITS.subject) out.subject = tooLong(LIMITS.subject);
  if (d.preview_text.length > LIMITS.preview_text) out.preview_text = tooLong(LIMITS.preview_text);
  if (d.from_name.length > LIMITS.from_name) out.from_name = tooLong(LIMITS.from_name);
  if (smsPlain(d.sms_text).length > LIMITS.sms_text) out.sms_text = 'Use 120 characters or fewer (some symbols, like …, count as more than one).';
  const reply = d.reply_to_email.trim();
  if (reply && !isPlausibleEmail(reply)) out.reply_to_email = 'Enter an email address like sales@yourbusiness.com.';
  return out;
}
