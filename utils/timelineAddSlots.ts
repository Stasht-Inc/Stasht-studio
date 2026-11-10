// Chris, 9 Nov 2026 (point 5): "add the + options on the right side, and remove it from the left … it should be in the
// same spot everywhere." On the desktop campaign page the "+" (Add Widget) now sits in the right-hand timeline of cards:
// one under the "Timeline • N moments" header (the top, after_post_id null) and one after every moment card, the last
// one included. Linked campaigns can't be an after_post_id, so no "+" follows them (the left list had none either).
import type { TimelineItem } from './addMomentPosition.ts';
import type { AddWidgetKind, AddWidgetOption } from '../components/widgets/addWidgetOptions.ts';

/** The after_post_id of the "+" drawn after this timeline item, or undefined when none follows it. */
export function addSlotAfter(item: TimelineItem | { type: string; id: unknown } | null | undefined): string | undefined {
  if (!item || item.type !== 'post' || item.id === null || item.id === undefined || String(item.id) === '') return undefined;
  return String(item.id);
}

// The collaborator (shared) view's left "+" offered Moment, Call to Action, Voice to Text, HTML, Youtube, Quote and
// DocuSign — never Share Request a Moment (owner only) or AI Creator. Its right "+" offers exactly those.
const NOT_FOR_COLLABORATORS: ReadonlyArray<AddWidgetKind> = ['request_moment', 'ai_creator'];

export function collaboratorAddWidgetOptions(options: ReadonlyArray<AddWidgetOption>): AddWidgetOption[] {
  return options.filter((o) => !NOT_FOR_COLLABORATORS.includes(o.kind));
}
