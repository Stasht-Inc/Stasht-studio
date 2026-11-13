import type { NewsletterBlock } from '../../../services/newslettersAPI.ts';
import { decodeEntities } from './textHtml.ts';

/** POST /newsletters/images/generate: the prompt's limit (NewsletterAssetsController::IMAGE_PROMPT_MAX). */
export const IMAGE_PROMPT_MAX = 1000;
/** What "Generate image" costs (NewsletterAssetsController::IMAGE_CREDITS). */
export const IMAGE_CREDITS = 5;
/** The prefilled prompt is kept short so it's easy to edit. */
const SEED_MAX = 400;

function plain(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<\/(p|li|h\d)>/gi, '. ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').trim();
}

function textOf(block: NewsletterBlock | undefined): string {
  if (!block) return '';
  if (block.type === 'title') return plain(block.data.text ?? '');
  if (block.type === 'text') return plain(block.data.html ?? '');
  return '';
}

/**
 * The "Generate image" prompt to start from (Chris, 13 Nov): the subject plus the nearest Title/Text sections around
 * the Image section (the one above first, then below), cut at a word to SEED_MAX. Empty when there is nothing to use.
 */
export function imagePromptSeed(subject: string, blocks: NewsletterBlock[], imageId: string): string {
  const at = blocks.findIndex((b) => b.id === imageId);
  const parts: string[] = [];
  const add = (s: string) => {
    const t = s.trim().replace(/[.\s]+$/, '');
    if (t && !parts.some((p) => p.toLowerCase() === t.toLowerCase())) parts.push(t);
  };
  add(plain(subject ?? ''));
  if (at >= 0) {
    // Up to two text sections: the closest above, then the closest below, then the next ones out.
    const near: string[] = [];
    for (let d = 1; d < blocks.length && near.length < 2; d++) {
      for (const i of [at - d, at + d]) {
        const t = textOf(blocks[i]);
        if (t && near.length < 2) near.push(t);
      }
    }
    near.forEach(add);
  }
  let out = parts.join('. ');
  if (out.length > SEED_MAX) {
    const cut = out.slice(0, SEED_MAX);
    const last = cut.lastIndexOf(' ');
    out = (last > SEED_MAX / 2 ? cut.slice(0, last) : cut).replace(/[\s,;:.-]+$/, '');
  }
  return out;
}

/** The words shown under the prompt for a failed "Generate image". */
export function imageGenerateError(res: { ok: boolean; code?: string; status?: number; error?: string; planRequired?: boolean; rateLimited?: boolean; fieldErrors?: Record<string, string> }): string {
  if (res.code === 'no_credits' || res.status === 402) return res.error || `You're out of AI credits. Images use ${IMAGE_CREDITS}.`;
  if (res.code === 'content_policy') return res.error || "This prompt isn't allowed. Try different words.";
  if (res.planRequired) return res.error || 'Newsletters are available on paid plans.';
  if (res.rateLimited) return res.error || 'Too many images. Wait a minute.';
  if (res.fieldErrors?.prompt) return res.fieldErrors.prompt;
  if (res.status && res.status >= 400 && res.status < 500 && res.error) return res.error;
  return "We couldn't create an image. Try again.";
}
