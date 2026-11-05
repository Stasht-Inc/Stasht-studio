// The text block's allowed HTML (spec §4.2), the same list as the API's NewsletterHtmlSanitizer:
// p, br, strong, em, a[href https/mailto], ul/ol/li; b→strong, i→em, div/h1–h6→p; and (Chris, 5 Nov) a span with
// one of the toolbar's font sizes, <span style="font-size:14|16|20|24px">. Scripts, styles, forms and
// media are dropped with their content; other tags are unwrapped (their words stay); every attribute but a
// safe href (or that font size) goes. Used both ways: clean what the browser's contentEditable produces before saving, and turn
// stored HTML into nodes that React renders, so no HTML string is ever injected into the page. The API
// sanitises again on its side.
import { LIMITS } from './rules.ts';
import { httpsUrl } from './urls.ts';

export type TextTag = 'p' | 'strong' | 'em' | 'ul' | 'ol' | 'li';
export type TextNode =
  | { kind: 'text'; text: string }
  | { kind: 'br' }
  | { kind: 'el'; tag: TextTag; children: TextNode[] }
  | { kind: 'a'; href: string; children: TextNode[] }
  | { kind: 'size'; px: number; children: TextNode[] };

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
      const px = styleFontSize(attrValue(attrs, 'style'));
      if (px !== null) {
        const node = { kind: 'size' as const, px, children: [] as TextNode[] };
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
    return inner === '' ? '' : `<span style="font-size:${n.px}px">${inner}</span>`;
  }
  return `<${n.tag}>${n.children.map(serializeNode).join('')}</${n.tag}>`;
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

/**
 * A font size on the text model (review, 5 Nov: no execCommand / <font>, so nothing escapes the editor's own undo).
 * range: plain-text character offsets [start, end) counted over text nodes only, or null for everything. Inside the
 * range the words get `px` (16 = Normal: no size); outside, each word keeps the size it had. Sizes are then put back
 * as few spans as possible, only ever around words and inline formatting, never around a paragraph, list or item.
 */
export function resizeTextNodes(nodes: TextNode[], px: number, range: { start: number; end: number } | null): TextNode[] {
  const target = px === 16 ? null : px;
  const pos = { n: 0 };
  const flatten = (list: TextNode[], inherited: number | null): TextNode[] => list.flatMap((node): TextNode[] => {
    if (node.kind === 'br') return [node];
    if (node.kind === 'size') return flatten(node.children, node.px === 16 ? null : node.px);
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
      const size = inside ? target : inherited;
      out.push(size === null ? { kind: 'text', text } : { kind: 'size', px: size, children: [{ kind: 'text', text }] });
    }
    return out;
  });
  return groupSizes(flatten(nodes, null));
}

type Uniform = number | null | 'any' | 'mixed';
const isBlock = (n: TextNode) => n.kind === 'el' && (n.tag === 'p' || n.tag === 'ul' || n.tag === 'ol' || n.tag === 'li');

function uniformSize(n: TextNode): Uniform {
  if (n.kind === 'text') return null;
  if (n.kind === 'br') return 'any';
  if (n.kind === 'size') return n.px;
  const seen = new Set<number | null>();
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

/** Runs of neighbours with one size become one span around them; mixed inline elements are opened up. */
function groupSizes(list: TextNode[]): TextNode[] {
  const out: TextNode[] = [];
  let run: TextNode[] = [];
  let runPx: number | null | undefined;
  const flush = () => {
    if (!run.length) return;
    const flat = mergeTexts(run.flatMap(stripSizes));
    if (typeof runPx === 'number') out.push({ kind: 'size', px: runPx, children: flat });
    else out.push(...flat);
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
