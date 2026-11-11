// Online means someone is actually at Studio (Chris 11 Nov 2026): a tab left open and visible overnight kept its person
// "online" for ever, so a chat assigned to them was never released when the visitor wrote again (rule D). No mouse,
// key, touch or scroll for PRESENCE_IDLE_MS → no more heartbeats (and "offline" at once); the next interaction beats.
export const PRESENCE_IDLE_MS = 10 * 60_000;

/** Whether a Studio tab should keep its person online: visible and used within PRESENCE_IDLE_MS. */
export function isPresenceActive(visible: boolean, lastActivityAt: number, now: number): boolean {
  return visible && now - lastActivityAt < PRESENCE_IDLE_MS;
}
