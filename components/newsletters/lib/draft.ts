import type {
  AudienceItem, Newsletter, NewsletterBlock, NewsletterChannel, NewsletterHeader, NewsletterInput,
} from '../../../services/newslettersAPI.ts';
import { LIMITS, isPlausibleEmail, smsPlain } from './rules.ts';
import { blocksToInput, campaignSelections, normaliseBlocks, overLimitTextIds } from './blocks.ts';
import { campaignIdsOf, overridesForInput, pruneOverrides } from './campaignsBlock.ts';

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
    channels: d.channels, template: d.template, header: d.header, blocks: blocksToInput(d.blocks), audience: d.audience, planned_send_at: d.planned_send_at ?? null,
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
    if (JSON.stringify(blocksToInput(savable)) === JSON.stringify(blocksToInput(saved.blocks))) delete patch.blocks;
    else patch.blocks = blocksToInput(savable);
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

type CampaignsBlock = Extract<NewsletterBlock, { type: 'campaigns' }>;

/**
 * After a PUT: the API refreshes every Campaigns section's snapshot and drops campaigns, products and vehicles that
 * can no longer be shared (and their card edits). Each section takes the server's campaigns, columns and card edits,
 * in the draft and in the saved copy, unless it was changed while the save was on its way (picks, columns or edits:
 * then the new choice stays in the draft and saves next). Card edits that save the same as the server's (a trailing
 * or double space still being typed) stay as typed. Missing columns are 1 and missing edits none (the API's
 * presenter leaves them out unless stored). Nothing else changes.
 */
export function adoptCampaignSnapshots(current: NewsletterDraft, sent: NewsletterDraft, serverBlocks: readonly NewsletterBlock[]): { draft: NewsletterDraft; saved: NewsletterDraft } {
  const server = new Map<string, CampaignsBlock>();
  for (const b of serverBlocks) if (b.type === 'campaigns') server.set(b.id, b);
  if (!server.size) return { draft: current, saved: sent };
  // What the section saves (picks and columns), as the PUT sends it.
  const picksOf = (b: CampaignsBlock) => JSON.stringify(blocksToInput([b])[0].data);
  const sentIds = new Map(sent.blocks.flatMap((b) => (b.type === 'campaigns' ? [[b.id, picksOf(b)] as const] : [])));
  const take = (blocks: NewsletterBlock[], onlyUnchanged: boolean) => {
    let changed = false;
    const next = blocks.map((b) => {
      const s = b.type === 'campaigns' ? server.get(b.id) : undefined;
      if (!s || b.type !== 'campaigns') return b;
      if (onlyUnchanged && sentIds.get(b.id) !== picksOf(b)) return b;
      changed = true;
      const selections = campaignSelections(s.data);
      // The presenter leaves columns and overrides out unless stored: missing columns is 1, missing overrides {}.
      const columns = s.data.columns;
      const sameEdits = JSON.stringify(overridesForInput(b.data.overrides, selections)) === JSON.stringify(overridesForInput(s.data.overrides, selections));
      const overrides = sameEdits ? pruneOverrides(b.data.overrides, selections) : s.data.overrides;
      return { ...b, data: {
        selections, campaign_ids: campaignIdsOf(selections), items: s.data.items ?? [], ...(columns ? { columns } : {}), ...(overrides ? { overrides } : {}),
      } };
    });
    return changed ? next : blocks;
  };
  const draftBlocks = take(current.blocks, true);
  const savedBlocks = take(sent.blocks, false);
  return {
    draft: draftBlocks === current.blocks ? current : { ...current, blocks: draftBlocks },
    saved: savedBlocks === sent.blocks ? sent : { ...sent, blocks: savedBlocks },
  };
}
