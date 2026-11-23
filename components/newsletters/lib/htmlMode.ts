// Chris 22 Nov 2026 (Q4, "Edit as HTML"): the newsletter's email is its sections, or a whole email template pasted as
// HTML (the composer's "Sections | HTML" switch). Both are kept whichever shows; the mode showing at Send is what goes
// out. An HTML newsletter goes out by email only (Deepak, 22 Nov): Studio counts, checks and sends it by email, whatever
// was ticked for the sections (the API does the same: NewsletterContentMode::channels). Pure.
import type { ContentMode, NewsletterChannel, RemovedItem } from '../../../services/newslettersAPI.ts';
import type { DraftContent, NewsletterDraft } from './draft.ts';
import { LIMITS } from './rules.ts';
import { formatCount } from './audience.ts';

export const CONTENT_MODE_OPTIONS: ReadonlyArray<{ value: ContentMode; label: string }> = [
  { value: 'sections', label: 'Sections' },
  { value: 'html', label: 'HTML' },
];

/** Under Send by, where Text message was (texts can't carry a pasted email). */
export const EMAIL_ONLY_NOTE = 'HTML emails go out by email only.';
/** Send / Schedule with nothing pasted (the API's NewsletterSendCheck::HTML_EMPTY). */
export const HTML_EMPTY = 'Paste the HTML for your email.';
/** Over LIMITS.html_document (the API's message). */
export const HTML_TOO_LONG = `HTML can be up to ${LIMITS.html_document.toLocaleString('en-US')} characters.`;

export function isHtmlMode(d: { content?: DraftContent | null }): boolean {
  return d.content?.mode === 'html';
}

/** The channels it goes out on: an HTML newsletter by email only. */
export function sendChannels(d: Pick<NewsletterDraft, 'channels'> & { content?: DraftContent | null }): NewsletterChannel[] {
  return isHtmlMode(d) ? ['email'] : d.channels;
}

/** The draft as it is sent: in HTML mode its channels are email only (for counts, checks and the confirm step). */
export function forSending<T extends Pick<NewsletterDraft, 'channels'> & { content?: DraftContent | null }>(d: T): T {
  return isHtmlMode(d) && (d.channels.length !== 1 || d.channels[0] !== 'email') ? { ...d, channels: ['email'] } : d;
}

/** Studio's own check of the pasted template before Send: something pasted, within the limit (the API checks the rest). */
export function htmlDocumentProblem(html: string): string | null {
  if (html.length > LIMITS.html_document) return HTML_TOO_LONG;
  return html.trim() === '' ? HTML_EMPTY : null;
}

/** "We removed 12 unsupported items" and what they were ("4 scripts, 1 form …"); null when nothing was removed. */
export function removedSummary(removed: readonly RemovedItem[] | null | undefined): { title: string; detail: string } | null {
  const items = (removed ?? []).filter((r) => r && Number.isFinite(r.count) && r.count > 0 && typeof r.label === 'string');
  const total = items.reduce((sum, r) => sum + r.count, 0);
  if (!total) return null;
  return {
    title: `We removed ${formatCount(total)} unsupported ${total === 1 ? 'item' : 'items'}`,
    detail: items.map((r) => r.label).join(', '),
  };
}

// ---- pictures (Chris 22 Nov 2026, Q4 follow-up: pasted templates keep their fonts and pictures)

/** Under the box when the paste had pictures written inside the HTML (data:): Gmail blocks those. */
/** 23 Nov 2026 (Deepak): shown only when the paste has its own unsubscribe link, since ours is always added. */
export const OWN_UNSUBSCRIBE_NOTE = 'Your email has its own unsubscribe link. You can remove it; ours is added.';

/** The paste carries its own unsubscribe link or tag (Mailchimp *|UNSUB|*, a link or text saying unsubscribe). */
export function hasOwnUnsubscribe(html: string): boolean {
  return /unsubscribe|\*\|UNSUB\|\*|\{\{\s*unsubscribe|list-manage\.com\/unsubscribe|\[unsubscribe\]/i.test(html);
}

export const DATA_PICTURES_HINT = 'Gmail blocks pictures saved inside the HTML. Use Add image to upload them.';

/** "3 pictures switched to https" (info: the API draws http:// pictures from https://); null for none. */
export function switchedNote(switched: number | null | undefined): string | null {
  const n = Number.isFinite(switched) ? Math.max(0, Math.floor(switched as number)) : 0;
  if (!n) return null;
  return `${formatCount(n)} ${n === 1 ? 'picture' : 'pictures'} switched to https`;
}

/** "2 pictures didn't load" for the preview's pictures that failed, with their addresses (no repeats); null for none. */
export function brokenPicturesNote(urls: readonly string[]): { title: string; urls: string[] } | null {
  const list = [...new Set(urls.filter((u) => typeof u === 'string' && u.trim() !== ''))];
  if (!list.length) return null;
  return { title: `${formatCount(list.length)} ${list.length === 1 ? "picture didn't" : "pictures didn't"} load`, urls: list };
}

/** The tag Add image puts in the HTML for an uploaded picture (full width on phones, 600 px on a computer). */
export function imageTag(url: string): string {
  const src = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<img src="${src}" alt="" style="display:block;max-width:100%;height:auto;" width="600">`;
}

/** The HTML with `snippet` put where the cursor was (replacing a selection), or at the end on a new line when there is
 *  no cursor; and where the cursor goes after it. */
export function insertSnippet(value: string, snippet: string, start: number | null, end: number | null): { value: string; cursor: number } {
  if (start == null || end == null || start < 0 || end < start || end > value.length) {
    const sep = value === '' || value.endsWith('\n') ? '' : '\n';
    const next = `${value}${sep}${snippet}`;
    return { value: next, cursor: next.length };
  }
  return { value: value.slice(0, start) + snippet + value.slice(end), cursor: start + snippet.length };
}

/**
 * 23 Nov 2026 (Deepak): switching to HTML left the HTML box off screen and the empty preview looked like the place to
 * paste. Brings the box into view, puts the cursor in it and flashes it briefly. Safe to call before the box exists.
 */
export function jumpToHtmlBox(): void {
  if (typeof document === 'undefined') return;
  const run = (tries: number) => {
    const box = document.getElementById('nl-html-document') as HTMLTextAreaElement | null;
    if (!box) {
      if (tries > 0) window.requestAnimationFrame(() => run(tries - 1));
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    box.focus({ preventScroll: true });
    box.setAttribute('data-nl-flash', '');
    window.setTimeout(() => box.removeAttribute('data-nl-flash'), 1600);
  };
  run(10);
}

// ---- your sections as HTML (Chris 23 Nov 2026, A)

/** Above the HTML box while it holds the sections' HTML made by the API (POST /newsletters/{id}/sections-html). */
export const SECTIONS_AS_HTML_NOTE = 'Your sections as HTML. Paste over it to use another email.';
/** At the bottom of the Content card when that HTML could not be fetched (the box stays empty). */
export const SECTIONS_HTML_FAILED = 'Your sections couldn’t be loaded as HTML. Paste your HTML instead.';

/** Switching to HTML fills the box from the sections only when the box is empty and there is at least one section. */
export function fillsFromSections(d: { content: DraftContent; blocks: readonly unknown[] }): boolean {
  return d.content.html_document.trim() === '' && d.blocks.length > 0;
}

/** The box still holds exactly the generated HTML (the note and "no own-unsubscribe note" apply only then). */
export function isGeneratedHtml(value: string, generated: string | null): boolean {
  return generated !== null && value.trim() !== '' && value.trim() === generated.trim();
}
