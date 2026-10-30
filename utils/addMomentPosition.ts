// Where the public page's "Add a moment" bar puts a guest's moment: at the END of the timeline, i.e. after the last
// post shown (after_post_id). Linked memories can't be an after_post_id, so a trailing one is skipped; with no posts
// at all the answer is null (the API's "no position").

export interface TimelineItem {
  type: 'post' | 'linked';
  id: string | number;
}

export function endOfTimelinePostId(items: readonly TimelineItem[] | null | undefined): string | null {
  if (!items) return null;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item && item.type === 'post' && item.id !== null && item.id !== undefined && String(item.id) !== '') return String(item.id);
  }
  return null;
}
