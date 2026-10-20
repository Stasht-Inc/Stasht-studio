import type {
  AudienceItem, Newsletter, NewsletterBlock, NewsletterChannel, NewsletterHeader, NewsletterInput,
} from '../../../services/newslettersAPI.ts';
import { LIMITS, isPlausibleEmail } from './rules.ts';

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
    blocks: Array.isArray(n.blocks) ? n.blocks : [],
    audience: Array.isArray(n.audience) ? n.audience : [],
  };
}

/** The PUT body for a draft: text trimmed, empty text as null. */
export function draftToInput(d: NewsletterDraft): NewsletterInput {
  const input: NewsletterInput = { channels: d.channels, template: d.template, header: d.header, blocks: d.blocks, audience: d.audience };
  for (const key of TEXT_FIELDS) {
    const value = d[key].trim();
    input[key] = value === '' ? null : value;
  }
  return input;
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
  if (d.sms_text.length > LIMITS.sms_text) out.sms_text = tooLong(LIMITS.sms_text);
  const reply = d.reply_to_email.trim();
  if (reply && !isPlausibleEmail(reply)) out.reply_to_email = 'Enter an email address like sales@yourbusiness.com.';
  return out;
}
