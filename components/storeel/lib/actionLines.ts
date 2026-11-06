// Chris, 6 Nov 2026 (point 1): the lines above the Storeel page's actions (why a button is off, a refused save, the
// server's answer) read like an error — "*Add a campaign title": an asterisk first, no full stop at the end — and
// show red and left-aligned (CreateMemory). Pure, so `node --test` loads it.

/** "Add a campaign title." → "*Add a campaign title". */
export function asErrorLine(text: string | null | undefined): string {
  const body = String(text ?? '').trim().replace(/^\*+\s*/, '').replace(/\.+$/, '').trim();
  return body ? `*${body}` : '';
}

export interface ActionLine {
  /** The element id (the buttons' aria-describedby points at the reasons). */
  id: 'st-action-error' | 'st-save-reason' | 'st-send-reason';
  text: string;
  /** Said out loud when it appears (a refused save / the server's answer). */
  alert: boolean;
}

/**
 * What is said above the actions, in order: a refused save (or the server's answer), then why Save is off — else why
 * only Save & Send is off. The same words are never said twice.
 */
export function actionLines({ actionError, saveReason, sendReason }: {
  actionError: string | null | undefined;
  saveReason: string | null | undefined;
  sendReason: string | null | undefined;
}): ActionLine[] {
  const error = asErrorLine(actionError);
  const reason: ActionLine | null = saveReason
    ? { id: 'st-save-reason', text: asErrorLine(saveReason), alert: false }
    : sendReason ? { id: 'st-send-reason', text: asErrorLine(`To send now: ${sendReason}`), alert: false } : null;
  if (reason && error && reason.text === error) return [{ ...reason, alert: true }];
  const lines: ActionLine[] = [];
  if (error) lines.push({ id: 'st-action-error', text: error, alert: true });
  if (reason && reason.text) lines.push(reason);
  return lines;
}
