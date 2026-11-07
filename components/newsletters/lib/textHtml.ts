// The text block's allowed HTML (spec §4.2), the same list as the API's NewsletterHtmlSanitizer:
// p, br, strong, em, a[href https/mailto], ul/ol/li; b→strong, i→em, div/h1–h6→p; and (Chris, 5 Nov) a span with
// one of the toolbar's font sizes, <span style="font-size:14|16|20|24px">, and/or (Chris, 6 Nov) one of its font
// families, <span style="font-size:20px;font-family:STACK"> (lib/fonts.ts; either part alone too). Chris, 7 Nov: a size is
// now written as its style, <span data-size="large" style="font-family:STACK">, and older px spans read as their style.
// Scripts, styles, forms and
// media are dropped with their content; other tags are unwrapped (their words stay); every attribute but a
// safe href (or that font size) goes. Used both ways: clean what the browser's contentEditable produces before saving, and turn
// stored HTML into nodes that React renders, so no HTML string is ever injected into the page. The API
// sanitises again on its side.
import type { FontKey } from '../../../services/newslettersAPI.ts';
import { LIMITS } from './rules.ts';
import { httpsUrl } from './urls.ts';
import { fontStack, styleFontFamily } from './fonts.ts';
import { TYPE_STYLES, USUAL_SCALE, styleOfPx } from './typeScale.ts';

export type TextTag = 'p' | 'strong' | 'em' | 'ul' | 'ol' | 'li';
export type TextNode =
  | { kind: 'text'; text: string }
  | { kind: 'br' }
  | { kind: 'el'; tag: TextTag; children: TextNode[] }
  | { kind: 'a'; href: string; children: TextNode[] }
  /** A font size and/or a font family (Chris, 6 Nov; no key: none). px: the size STYLE, named by its usual px (14 Small,
   *  16 Normal, 20 Large, 24 X-Large; null: none). Chris, 7 Nov: it is written <span data-size="large"> and drawn at the
   *  newsletter's own px for that style (lib/typeScale.ts). */
  | { kind: 'size'; px: number | null; font?: FontKey; children: TextNode[] };

/** The toolbar's font sizes in px (lib/sectionStyle.ts TEXT_SIZES; the API's NewsletterHtmlSanitizer::FONT_SIZES). */
export const FONT_SIZE_PX: readonly number[] = [14, 16, 20, 24];

/** The px of a style's font-size when it is one of FONT_SIZE_PX (written "font-size: Npx"), else null. */
export function styleFontSize(style: string | null): number | null {
  for (const declaration of String(style ?? '').toLowerCase().split(';')) {
    const m = /^\s*font-size\s*:\s*(\d{2})px\s*$/.exec(declaration);
    if (m) {
      const px = Number(m[1]);
      return FONT_SIZE_PX.includes(px) ? px : null;
    }
  }
  return null;
}

const TAGS: Record<string, TextTag | 'a' | 'br' | 'span'> = {
  p: 'p', div: 'p', h1: 'p', h2: 'p', h3: 'p', h4: 'p', h5: 'p', h6: 'p',
  strong: 'strong', b: 'strong', em: 'em', i: 'em', ul: 'ul', ol: 'ol', li: 'li', a: 'a', br: 'br', span: 'span',
};
// Dropped with everything inside. Void tags (img, input) need no entry: unknown tags are dropped anyway.
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'head', 'title',
  'form', 'textarea', 'select', 'button', 'video', 'audio', 'canvas',
]);
const BLOCK_TAGS = new Set<TextTag>(['p', 'ul', 'ol']);
const NBSP = '\u00a0';
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: NBSP };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole: string, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ent.toLowerCase()] ?? whole;
  });
}

function attrValue(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attrs);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? '');
}

/** https:// links and mailto: addresses only (and nothing the API's safeHref would refuse). */
export function safeLinkHref(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^mailto:/i.test(v)) {
    return v.length <= LIMITS.url && /^mailto:[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/i.test(v) ? v : null;
  }
  const href = httpsUrl(v);
  return href && !/['\\]/.test(href) ? href : null;
}

function pushText(list: TextNode[], text: string): void {
  if (!text) return;
  const last = list[list.length - 1];
  if (last && last.kind === 'text') last.text += text;
  else list.push({ kind: 'text', text });
}

export function parseTextHtml(html: string | null | undefined): TextNode[] {
  const root: TextNode[] = [];
  const stack: Array<{ tag: string; children: TextNode[] }> = [{ tag: '#root', children: root }];
  const top = (): TextNode[] => stack[stack.length - 1].children;
  const closeTo = (tag: string): void => {
    for (let i = stack.length - 1; i > 0; i--) {
      if (stack[i].tag === tag) {
        stack.length = i;
        return;
      }
    }
  };
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|</g;
  const source = String(html ?? '');
  let skipping: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const [whole, slash, rawName, attrs, text] = m;
    if (whole.startsWith('<!--')) continue;
    if (rawName === undefined) {
      if (!skipping) pushText(top(), text !== undefined ? decodeEntities(text) : '<');
      continue;
    }
    const name = rawName.toLowerCase();
    if (skipping) {
      if (slash && name === skipping) skipping = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!slash && !/\/\s*$/.test(attrs)) skipping = name;
      continue;
    }
    const tag = TAGS[name];
    if (!tag) continue; // unknown tag: drop it, keep its text
    if (tag === 'br') {
      if (!slash) top().push({ kind: 'br' });
      continue;
    }
    if (slash) {
      closeTo(tag);
      continue;
    }
    if (tag === 'a') {
      const href = safeLinkHref(attrValue(attrs, 'href'));
      if (href) {
        const node = { kind: 'a' as const, href, children: [] as TextNode[] };
        top().push(node);
        stack.push({ tag: 'a', children: node.children });
      } else {
        stack.push({ tag: 'a', children: top() }); // unsafe link: keep the words, drop the link
      }
      continue;
    }
    if (tag === 'span') {
      const style = attrValue(attrs, 'style');
      // A size style (Chris, 7 Nov) wins over a px; an older px span is read as the style it was.
      const named = attrValue(attrs, 'data-size');
      const px = named !== null && (TYPE_STYLES as readonly string[]).includes(named) ? USUAL_SCALE[named as keyof typeof USUAL_SCALE] : styleFontSize(style);
      const font = styleFontFamily(style);
      if (px !== null || font !== null) {
        const node: Extract<TextNode, { kind: 'size' }> = { kind: 'size', px, ...(font ? { font } : {}), children: [] };
        top().push(node);
        stack.push({ tag: 'span', children: node.children });
      } else {
        stack.push({ tag: 'span', children: top() }); // any other span: keep the words (its </span> closes only it)
      }
      continue;
    }
    // A paragraph or list never sits inside a font size (inline): it ends any size that is open.
    if (BLOCK_TAGS.has(tag as TextTag)) {
      const inSpan = stack.findIndex((e) => e.tag === 'span');
      if (inSpan > 0) stack.length = inSpan;
    }
    if (tag === 'p') closeTo('p');
    const node = { kind: 'el' as const, tag, children: [] as TextNode[] };
    top().push(node);
    stack.push({ tag, children: node.children });
  }
  return root;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function serializeNode(n: TextNode): string {
  if (n.kind === 'text') return esc(n.text);
  if (n.kind === 'br') return '<br>';
  if (n.kind === 'a') return `<a href="${esc(n.href)}">${n.children.map(serializeNode).join('')}</a>`;
  if (n.kind === 'size') {
    const inner = n.children.map(serializeNode).join('');
    const open = spanOpen(n.px, n.font ?? null);
    return inner === '' || !open ? inner : `${open}${inner}</span>`;
  }
  return `<${n.tag}>${n.children.map(serializeNode).join('')}</${n.tag}>`;
}

/**
 * The canonical opening tag for a size style and/or a font, the style first (Chris, 7 Nov; the API's
 * NewsletterHtmlSanitizer::styleOpen / spanOpen): <span data-size="large" style="font-family:STACK">; null for neither.
 */
export function spanOpen(px: number | null, font: FontKey | null): string | null {
  const size = styleOfPx(px);
  const style = font ? ` style="font-family:${fontStack(font)}"` : '';
  if (size) return `<span data-size="${size}"${style}>`;
  return style ? `<span${style}>` : null;
}

/** Back to HTML. Loose top-level words go into paragraphs so every line is a block in the email. */
export function serializeTextNodes(nodes: TextNode[]): string {
  const out: string[] = [];
  let run: TextNode[] = [];
  const flush = () => {
    if (run.some((n) => !(n.kind === 'text' && !n.text.trim()))) out.push(`<p>${run.map(serializeNode).join('')}</p>`);
    run = [];
  };
  for (const n of nodes) {
    if (n.kind === 'el' && BLOCK_TAGS.has(n.tag)) {
      flush();
      out.push(serializeNode(n));
    } else if (n.kind === 'el' && n.tag === 'li') {
      flush();
      out.push(`<ul>${serializeNode(n)}</ul>`);
    } else {
      run.push(n);
    }
  }
  flush();
  return out.join('');
}

/** Google Docs marks bold and italic with styled spans: <span style="font-weight:700"> → <strong>, font-style:italic → <em>. */
function styledSpans(html: string): string {
  const closers: string[] = [];
  return html.replace(/<span\b([^>]*)>|<\/span\s*>/gi, (tag, attrs: string | undefined) => {
    if (attrs === undefined) return closers.pop() ?? '';
    const style = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    const css = (style?.[2] ?? style?.[3] ?? '').toLowerCase();
    const bold = /font-weight\s*:\s*(bold|bolder|[6-9]00)/.test(css);
    const italic = /font-style\s*:\s*italic/.test(css);
    closers.push(`${italic ? '</em>' : ''}${bold ? '</strong>' : ''}</span>`);
    return `<span>${bold ? '<strong>' : ''}${italic ? '<em>' : ''}`;
  });
}

/** Word's bullet paragraphs (class MsoListParagraph..., the bullet in an mso-list:Ignore span) → <ul><li>. Best effort. */
function wordLists(html: string): string {
  if (!/MsoListParagraph/i.test(html)) return html;
  const items = html.replace(/<p\b[^>]*class\s*=\s*["']?MsoListParagraph[^>]*>([\s\S]*?)<\/p\s*>/gi, (_m, inner: string) => {
    let body = inner
      .replace(/<!\[if !supportLists\]>[\s\S]*?<!\[endif\]>/gi, '')
      .replace(/<span\b[^>]*mso-list\s*:\s*Ignore[^>]*>(?:[^<]|<span\b[^>]*>[^<]*<\/span\s*>)*<\/span\s*>/gi, '');
    // A bullet left as plain text: ·, o, §, •, or "1." / "a)" followed by spaces.
    body = body.replace(/^(\s|&nbsp;|\u00a0)*([\u00b7o\u00a7\u2022\-]|\d+[.)]|[a-z][.)])(\s|&nbsp;|\u00a0)+/i, '');
    return `<li>${body}</li>`;
  });
  return items.replace(/(?:<li>[\s\S]*?<\/li>\s*)+/g, (run) => `<ul>${run.trim()}</ul>`);
}

/**
 * Pasted HTML (from a web page, Word or Google Docs) as allowed nodes. Word's conditional markers and Google
 * Docs' all-wrapping non-bold <b> are removed first. A single paragraph comes back as its words, so a paste
 * into the middle of a line stays on that line.
 */
export function pastedTextNodes(html: string): TextNode[] {
  const cleaned = styledSpans(wordLists(String(html ?? '')))
    .replace(/<!\[(?:if|endif)[^\]]*\]>/gi, '')
    .replace(/<b\b[^>]*(?:font-weight:\s*normal|docs-internal-guid)[^>]*>/gi, '<span>');
  const nodes = parseTextHtml(cleaned).filter((n) => !(n.kind === 'text' && !n.text.trim()));
  if (nodes.length === 1 && nodes[0].kind === 'el' && nodes[0].tag === 'p') return nodes[0].children;
  return nodes;
}

export function sanitizeTextHtml(html: string): string {
  return serializeTextNodes(parseTextHtml(html));
}

function plainText(nodes: TextNode[]): string {
  return nodes.map((n) => (n.kind === 'text' ? n.text : n.kind === 'br' ? ' ' : plainText(n.children))).join('');
}

export function textHtmlIsEmpty(html: string | null | undefined): boolean {
  return plainText(parseTextHtml(html)).split(NBSP).join(' ').trim() === '';
}

/** What the text editor holds (contentEditable's innerHTML), cleaned for saving. A blank editor (Chrome leaves
 *  <p><br></p> behind) is '', so the placeholder shows and the section counts as empty. */
export function editorHtml(raw: string): string {
  const html = sanitizeTextHtml(raw);
  return textHtmlIsEmpty(html) ? '' : html;
}

/** A run of words' size and font (null: none). */
interface RunStyle { px: number | null; font: FontKey | null }
const NO_STYLE: RunStyle = { px: null, font: null };
const styleKey = (st: RunStyle): string => `${st.px ?? ''}|${st.font ?? ''}`;
const NO_STYLE_KEY = styleKey(NO_STYLE);
const styledText = (text: string, st: RunStyle): TextNode => (st.px === null && st.font === null ? { kind: 'text', text }
  : { kind: 'size', px: st.px, ...(st.font ? { font: st.font } : {}), children: [{ kind: 'text', text }] });

/**
 * A font size or font family on the text model (review, 5 Nov: no execCommand / <font>, so nothing escapes the editor's
 * own undo; Chris, 6 Nov: the font family works the same way). range: plain-text character offsets [start, end)
 * counted over text nodes only, or null for everything. Inside the range the words get the patch (px 16 = Normal: no
 * size; font null = Default: no font) and keep the other part; outside, each word keeps what it had. Sizes and fonts
 * are then put back as few spans as possible, only ever around words and inline formatting, never around a paragraph,
 * list or item.
 */
export function restyleTextNodes(nodes: TextNode[], patch: { px?: number | null; font?: FontKey | null }, range: { start: number; end: number } | null): TextNode[] {
  const apply = (st: RunStyle): RunStyle => ({
    px: 'px' in patch ? (patch.px === 16 ? null : patch.px ?? null) : st.px,
    font: 'font' in patch ? patch.font ?? null : st.font,
  });
  const pos = { n: 0 };
  const flatten = (list: TextNode[], inherited: RunStyle): TextNode[] => list.flatMap((node): TextNode[] => {
    if (node.kind === 'br') return [node];
    if (node.kind === 'size') {
      return flatten(node.children, { px: node.px === null ? inherited.px : node.px === 16 ? null : node.px, font: node.font ?? inherited.font });
    }
    if (node.kind !== 'text') return [{ ...node, children: flatten(node.children, inherited) }];
    const start = pos.n;
    pos.n += node.text.length;
    const cuts = range ? [range.start, range.end].filter((c) => c > start && c < pos.n).map((c) => c - start) : [];
    const bounds = [0, ...cuts, node.text.length];
    const out: TextNode[] = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const text = node.text.slice(bounds[i], bounds[i + 1]);
      if (!text) continue;
      const from = start + bounds[i];
      const inside = !range || (from >= range.start && from < range.end);
      out.push(styledText(text, inside ? apply(inherited) : inherited));
    }
    return out;
  });
  return groupSizes(flatten(nodes, NO_STYLE));
}

export function resizeTextNodes(nodes: TextNode[], px: number, range: { start: number; end: number } | null): TextNode[] {
  return restyleTextNodes(nodes, { px }, range);
}

/** A font family (null: Default) on the selected words, or on everything when range is null. */
export function fontTextNodes(nodes: TextNode[], font: FontKey | null, range: { start: number; end: number } | null): TextNode[] {
  return restyleTextNodes(nodes, { font }, range);
}

export function fontTextHtml(html: string, font: FontKey | null, range: { start: number; end: number } | null): string {
  return serializeTextNodes(fontTextNodes(parseTextHtml(html), font, range));
}

interface TextContext { px: number | null; font: FontKey | null; bold: boolean; italic: boolean; link: boolean; anchor: TextNode | null }
/** Every text node with its offset and what it sits in. */
function eachText(nodes: TextNode[], visit: (text: string, from: number, ctx: TextContext) => void): void {
  let n = 0;
  const walk = (list: TextNode[], ctx: TextContext) => {
    for (const node of list) {
      if (node.kind === 'text') { visit(node.text, n, ctx); n += node.text.length; }
      else if (node.kind === 'size') walk(node.children, { ...ctx, px: node.px ?? ctx.px, font: node.font ?? ctx.font });
      else if (node.kind === 'a') walk(node.children, { ...ctx, link: true, anchor: node });
      else if (node.kind === 'el') walk(node.children, { ...ctx, bold: ctx.bold || node.tag === 'strong', italic: ctx.italic || node.tag === 'em' });
    }
  };
  walk(nodes, { px: null, font: null, bold: false, italic: false, link: false, anchor: null });
}

/** What the character at index `at` sits in, or null when there is none. */
function charContext(nodes: TextNode[], at: number): TextContext | null {
  let found: TextContext | null = null;
  eachText(nodes, (text, from, ctx) => {
    if (!found && text && at >= from && at < from + text.length) found = ctx;
  });
  return found;
}

/** What the character before the caret sits in (the first character at the very start); for a selection, its first. */
function contextAt(nodes: TextNode[], chars: number): TextContext | null {
  let last: TextContext | null = null;
  eachText(nodes, (text, _from, ctx) => { if (text) last = ctx; });
  return charContext(nodes, Math.max(chars - 1, 0)) ?? last;
}

/** The font size (px; null: Normal) where the caret (or a selection's start) is: what the size button shows. */
export function sizeAtOffset(nodes: TextNode[], chars: number): number | null {
  return contextAt(nodes, chars)?.px ?? null;
}

/** The font where the caret (or a selection's start) is: what the Font button shows. */
export function fontAt(nodes: TextNode[], chars: number): FontKey | null {
  return contextAt(nodes, chars)?.font ?? null;
}

/**
 * Bold / italic / link where the caret is, or, for a selection [start, end), whether all of it is (Chris, 6 Nov: the
 * B / I / link buttons show a pressed state).
 */
export function formatAt(nodes: TextNode[], start: number, end = start): { bold: boolean; italic: boolean; link: boolean } {
  if (end <= start) {
    const ctx = contextAt(nodes, start);
    // Link: only inside one (review, 6 Nov). Just before or after it, typing is not linked, unlike bold and italic.
    const before = start > 0 ? charContext(nodes, start - 1) : null;
    const after = charContext(nodes, start);
    const inLink = !!before?.anchor && before.anchor === after?.anchor;
    return { bold: !!ctx?.bold, italic: !!ctx?.italic, link: inLink };
  }
  const all = { bold: true, italic: true, link: true };
  let any = false;
  eachText(nodes, (text, from, ctx) => {
    if (!text || from + text.length <= start || from >= end) return;
    any = true;
    all.bold &&= ctx.bold;
    all.italic &&= ctx.italic;
    all.link &&= ctx.link;
  });
  return any ? all : { bold: false, italic: false, link: false };
}

/** A node's one style key (styleKey) when all its words share it; 'any' for no words; 'mixed' otherwise. */
type Uniform = string | 'any' | 'mixed';
const isBlock = (n: TextNode) => n.kind === 'el' && (n.tag === 'p' || n.tag === 'ul' || n.tag === 'ol' || n.tag === 'li');

function uniformSize(n: TextNode): Uniform {
  if (n.kind === 'text') return NO_STYLE_KEY;
  if (n.kind === 'br') return 'any';
  if (n.kind === 'size') return styleKey({ px: n.px, font: n.font ?? null });
  const seen = new Set<string>();
  for (const c of n.children) {
    const u = uniformSize(c);
    if (u === 'mixed') return 'mixed';
    if (u !== 'any') seen.add(u);
  }
  return seen.size === 0 ? 'any' : seen.size === 1 ? [...seen][0] : 'mixed';
}

function stripSizes(n: TextNode): TextNode[] {
  if (n.kind === 'size') return n.children.flatMap(stripSizes);
  if (n.kind === 'el' || n.kind === 'a') return [{ ...n, children: mergeTexts(n.children.flatMap(stripSizes)) }];
  return [n];
}

function mergeTexts(list: TextNode[]): TextNode[] {
  const out: TextNode[] = [];
  for (const n of list) {
    const last = out[out.length - 1];
    if (n.kind === 'text' && last?.kind === 'text') out[out.length - 1] = { kind: 'text', text: last.text + n.text };
    else out.push(n);
  }
  return out;
}

/** The style a key stands for (styleKey). */
function styleOfKey(key: string): RunStyle {
  const [px, font] = key.split('|');
  return { px: px ? Number(px) : null, font: (font || null) as FontKey | null };
}

/** Runs of neighbours with one size and font become one span around them; mixed inline elements are opened up. */
function groupSizes(list: TextNode[]): TextNode[] {
  const out: TextNode[] = [];
  let run: TextNode[] = [];
  let runPx: string | undefined;
  const flush = () => {
    if (!run.length) return;
    const flat = mergeTexts(run.flatMap(stripSizes));
    if (runPx !== undefined && runPx !== NO_STYLE_KEY) {
      const st = styleOfKey(runPx);
      out.push({ kind: 'size', px: st.px, ...(st.font ? { font: st.font } : {}), children: flat });
    } else out.push(...flat);
    run = [];
    runPx = undefined;
  };
  for (const n of list) {
    if (isBlock(n)) {
      flush();
      out.push({ ...(n as Extract<TextNode, { kind: 'el' }>), children: groupSizes((n as Extract<TextNode, { kind: 'el' }>).children) });
      continue;
    }
    const u = uniformSize(n);
    if (u === 'mixed') {
      flush();
      out.push({ ...(n as Extract<TextNode, { kind: 'el' | 'a' }>), children: groupSizes((n as Extract<TextNode, { kind: 'el' | 'a' }>).children) });
    } else if (u === 'any' || runPx === undefined || runPx === u) {
      if (u !== 'any') runPx = u;
      run.push(n);
    } else {
      flush();
      run = [n];
      runPx = u;
    }
  }
  flush();
  return mergeTexts(out);
}

export function resizeTextHtml(html: string, px: number, range: { start: number; end: number } | null): string {
  return serializeTextNodes(resizeTextNodes(parseTextHtml(html), px, range));
}
