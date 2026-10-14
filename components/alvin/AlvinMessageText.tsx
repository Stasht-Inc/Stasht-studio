import { Fragment, useState, type ReactNode } from 'react';

// Renders Alvin's answers: plain text with the light Markdown the prompt asks for — **bold**,
// `code`, links (YouTube links play in the chat), numbered and bulleted lists, paragraphs. Built from React elements (never innerHTML),
// so nothing in an answer can inject markup.

// [text](https://…) and bare https:// links. Only http(s) URLs become links, so a javascript: or
// data: URL in an answer stays plain text.
const LINK = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;

// The Get Started tutorials (Sidebar.tsx VIDEO_STEPS): their cards show the step's own title.
const TUTORIAL_TITLES: Record<string, string> = {
  SibZc7okVyU: 'Upload/Sync Media',
  O3PA3deEJSA: 'Create a Campaign',
  Fi6iZpcdrEk: 'Invite Users',
  R47D2pY5ZNo: 'Publish Campaign',
};

// A YouTube video id from a youtube.com/watch, youtu.be or youtube.com/embed link, else null.
export function youTubeId(href: string): string | null {
  const m = href.match(/^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#]|$)/);
  return m ? m[1] : null;
}

// A tutorial video inside the chat: a thumbnail until clicked, then the YouTube player in place.
function AlvinVideo({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <span className="block my-[4px] w-full max-w-[247px] aspect-video rounded-[10px] overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group relative block my-[4px] w-full max-w-[247px] aspect-video rounded-[10px] overflow-hidden bg-[#1e2939] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
    >
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <span className="size-[40px] rounded-full flex items-center justify-center shadow-md" style={{ backgroundImage: 'linear-gradient(135deg, #ff60e0 0%, #6c60ff 100%)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
      </span>
      <span className="absolute left-0 right-0 bottom-0 px-[8px] py-[5px] text-left text-[11px] leading-[14px] font-medium text-white bg-gradient-to-t from-black/70 to-transparent">
        {title}
      </span>
    </button>
  );
}

// Long code (an install snippet) gets its own box with a Copy button.
function CodeCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      el.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <span className="block my-[4px] rounded-[8px] bg-white border border-[#e0deff] overflow-hidden">
      <code className="block px-[9px] py-[7px] text-[11px] leading-[16px] break-all font-mono text-[#1e2939]">{text}</code>
      <button
        type="button"
        onClick={copy}
        className="block w-full border-t border-[#e0deff] px-[9px] py-[5px] text-left text-[11.5px] font-semibold text-[#6c60ff] hover:bg-[#faf9ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6c60ff]"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function link(part: string, key: string): ReactNode {
  const md = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
  const href = md ? md[2] : part.replace(/[.,;:!?]+$/, '');
  const trailing = md ? '' : part.slice(href.length);
  const video = youTubeId(href);
  if (video) {
    return (
      <Fragment key={key}>
        <AlvinVideo id={video} title={TUTORIAL_TITLES[video] ?? (md ? md[1] : 'Watch the video')} />
        {trailing}
      </Fragment>
    );
  }
  return (
    <Fragment key={key}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#6c60ff] underline underline-offset-2 break-all hover:text-[#5246e0]">
        {md ? md[1] : href}
      </a>
      {trailing}
    </Fragment>
  );
}

function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.flatMap((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return [<strong key={`${key}-${i}`} className="font-semibold">{part.slice(2, -2)}</strong>];
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      const code = part.slice(1, -1);
      return [code.length > 40
        ? <CodeCopy key={`${key}-${i}`} text={code} />
        : <code key={`${key}-${i}`} className="px-1 rounded bg-white/70 text-[11.5px]">{code}</code>];
    }
    return part.split(LINK).map((piece, j) =>
      j % 2 === 1 ? link(piece, `${key}-${i}-${j}`) : <Fragment key={`${key}-${i}-${j}`}>{piece}</Fragment>,
    );
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
