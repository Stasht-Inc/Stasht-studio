// Message text with its https:// links clickable (ClickUp wdy2xh1tdp: the website widget's AI now
// sends the business's page links). Used for OUTGOING messages only (AI and staff): what visitors
// and contacts send stays plain text. Built as React text and <a> elements — never
// dangerouslySetInnerHTML. A link shows the URL without "https://"; its href is the full URL.
//
// Same rules as linkParts() in public/widget-core.js: one strict ASCII grammar, identical to the
// server's WidgetAiLinks::URL_GRAMMAR, so the server's link guard and the browser read the same URL.

export const URL_GRAMMAR = 'https?://([A-Za-z0-9.\\-]+)(?::[0-9]+)?(?:[/?#][!#-&(-;=?-\\[\\]-_a-z~%]*)?';
const URL_TRAILING = /[.,;:!?)]+$/;

export type TextPart = { text: string; href?: string };

function linkHref(raw: string, literalHost: string): string | null {
  if (raw.includes('\\') || !/^https:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== literalHost.toLowerCase()) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function linkParts(body: string | null | undefined): TextPart[] {
  const text = String(body ?? '');
  const parts: TextPart[] = [];
  const re = new RegExp(URL_GRAMMAR, 'gi');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const after = text[match.index + match[0].length];
    if (after === '\\' || after === '@') {
      // Browsers would read another host here: the whole run stays plain text.
      const run = /^\S*/.exec(text.slice(match.index))?.[0] ?? '';
      re.lastIndex = match.index + Math.max(run.length, 1);
      continue;
    }
    const raw = match[0].replace(URL_TRAILING, '');
    const href = linkHref(raw, match[1]);
    if (!href) continue;
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: raw.replace(/^https:\/\//i, ''), href });
    last = match.index + raw.length;
  }
  if (last < text.length || parts.length === 0) parts.push({ text: text.slice(last) });
  return parts;
}

export default function LinkifiedText({ text, linkClassName = '' }: { text: string; linkClassName?: string }) {
  return (
    <>
      {linkParts(text).map((part, i) => (part.href ? (
        <a
          key={i}
          href={part.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 font-medium ${linkClassName}`}
        >
          {part.text}
        </a>
      ) : (
        <span key={i}>{part.text}</span>
      )))}
    </>
  );
}
