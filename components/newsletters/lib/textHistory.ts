// The Text section's own undo / redo (review, 5 Nov): saved html snapshots, so Cmd+Z / Cmd+Shift+Z always lands on clean
// html the email allows, whatever the browser did to the editable DOM. A burst of typing is one step; formatting (bold,
// italic, link, size, paste, drop) is a step of its own. Pure.

export interface TextHistory {
  snapshots: string[];
  index: number;
  /** What made the current snapshot, and when (typing within TYPING_MS joins it). */
  lastKind: 'start' | 'typing' | 'format';
  lastAt: number;
}

export const TYPING_MS = 1000;
const MAX = 100;

export function createHistory(html: string): TextHistory {
  return { snapshots: [html], index: 0, lastKind: 'start', lastAt: 0 };
}

export function recordHistory(h: TextHistory, html: string, kind: 'typing' | 'format', now: number): TextHistory {
  if (html === h.snapshots[h.index]) return h;
  const kept = h.snapshots.slice(0, h.index + 1);
  if (kind === 'typing' && h.lastKind === 'typing' && now - h.lastAt < TYPING_MS && kept.length > 1) {
    kept[kept.length - 1] = html;
    return { snapshots: kept, index: kept.length - 1, lastKind: 'typing', lastAt: now };
  }
  kept.push(html);
  const trimmed = kept.length > MAX ? kept.slice(kept.length - MAX) : kept;
  return { snapshots: trimmed, index: trimmed.length - 1, lastKind: kind, lastAt: now };
}

export function undoHistory(h: TextHistory): { history: TextHistory; html: string | null } {
  if (h.index === 0) return { history: h, html: null };
  const history = { ...h, index: h.index - 1, lastKind: 'format' as const };
  return { history, html: history.snapshots[history.index] };
}

export function redoHistory(h: TextHistory): { history: TextHistory; html: string | null } {
  if (h.index >= h.snapshots.length - 1) return { history: h, html: null };
  const history = { ...h, index: h.index + 1, lastKind: 'format' as const };
  return { history, html: history.snapshots[history.index] };
}
