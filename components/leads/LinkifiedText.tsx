// Message text with its https:// links clickable (ClickUp wdy2xh1tdp: the website widget's AI now
// sends the business's page links). Built as React text and <a> elements — never
// dangerouslySetInnerHTML — and only https: URLs become links; sentence punctuation after a URL
// (.,;:!?)) isn't part of it. Same rule as linkParts() in public/widget-core.js.

const URL_IN_TEXT = /https:\/\/[^\s<>"'`]+/gi;
const URL_TRAILING = /[.,;:!?)]+$/;

export type TextPart = { text: string; href?: string };

export function linkParts(body: string | null | undefined): TextPart[] {
  const text = String(body ?? '');
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const raw = match[0].replace(URL_TRAILING, '');
    const index = match.index ?? 0;
    let href: string | null = null;
    try {
      const url = new URL(raw);
      href = url.protocol === 'https:' && url.hostname ? url.href : null;
    } catch {
      href = null;
    }
    if (!href) continue;
    if (index > last) parts.push({ text: text.slice(last, index) });
    parts.push({ text: raw, href });
    last = index + raw.length;
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
