import { Fragment, type ReactNode } from 'react';

// Renders Alvin's answers: plain text with the light Markdown the prompt asks for — **bold**,
// `code`, numbered and bulleted lists, paragraphs. Built from React elements (never innerHTML),
// so nothing in an answer can inject markup.

function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${key}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={`${key}-${i}`} className="px-1 rounded bg-white/70 text-[11.5px]">{part.slice(1, -1)}</code>;
    }
    return <Fragment key={`${key}-${i}`}>{part}</Fragment>;
  });
}

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ol' | 'ul'; items: string[]; start: number; nested: boolean };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const ul = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const last = out[out.length - 1];

    if (ol || ul) {
      const kind = ol ? 'ol' : 'ul';
      const item = ol ? ol[2] : ul![2];
      // Bullets indented under a numbered step are its sub-points.
      const nested = !ol && ul![1].length >= 2;
      // A step list interrupted by a sub-point or a note keeps its numbering (start = the step's own number).
      if (last && last.kind === kind && last.nested === nested) last.items.push(item);
      else out.push({ kind, items: [item], start: ol ? parseInt(ol[1], 10) || 1 : 1, nested });
    } else if (line.trim() === '') {
      out.push({ kind: 'p', lines: [] });
    } else if (last && last.kind === 'p' && last.lines.length > 0) {
      last.lines.push(line);
    } else {
      out.push({ kind: 'p', lines: [line] });
    }
  }
  return out.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

export default function AlvinMessageText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-[6px]">
      {blocks(text).map((b, i) => {
        if (b.kind === 'p') {
          return (
            <p key={i}>
              {b.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(line, `${i}-${j}`)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i} start={b.kind === 'ol' && b.start !== 1 ? b.start : undefined} className={`${b.kind === 'ol' ? 'list-decimal' : 'list-disc'} ${b.nested ? 'pl-[36px]' : 'pl-[18px]'} flex flex-col gap-[3px]`}>
            {b.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}`)}</li>)}
          </List>
        );
      })}
    </div>
  );
}
