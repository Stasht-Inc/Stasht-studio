// The text block's allowed HTML (spec §4.2), the same list as the API's NewsletterHtmlSanitizer:
// p, br, strong, em, a[href https/mailto], ul/ol/li; b→strong, i→em, div/h1–h6→p. Scripts, styles, forms and
// media are dropped with their content; other tags are unwrapped (their words stay); every attribute but a
// safe href goes. Used both ways: clean what the browser's contentEditable produces before saving, and turn
// stored HTML into nodes that React renders, so no HTML string is ever injected into the page. The API
// sanitises again on its side.
import { LIMITS } from './rules.ts';
import { httpsUrl } from './urls.ts';

export type TextTag = 'p' | 'strong' | 'em' | 'ul' | 'ol' | 'li';
export type TextNode =
  | { kind: 'text'; text: string }
  | { kind: 'br' }
  | { kind: 'el'; tag: TextTag; children: TextNode[] }
  | { kind: 'a'; href: string; children: TextNode[] };

const TAGS: Record<string, TextTag | 'a' | 'br'> = {
  p: 'p', div: 'p', h1: 'p', h2: 'p', h3: 'p', h4: 'p', h5: 'p', h6: 'p',
  strong: 'strong', b: 'strong', em: 'em', i: 'em', ul: 'ul', ol: 'ol', li: 'li', a: 'a', br: 'br',
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

/**
 * Pasted HTML (from a web page, Word or Google Docs) as allowed nodes. Word's conditional markers and Google
 * Docs' all-wrapping non-bold <b> are removed first. A single paragraph comes back as its words, so a paste
 * into the middle of a line stays on that line.
 */
export function pastedTextNodes(html: string): TextNode[] {
  const cleaned = String(html ?? '')
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
