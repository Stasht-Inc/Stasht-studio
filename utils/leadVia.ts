/** What a lead's "Via" line needs (services/leadsAPI.ts Lead). */
export interface LeadViaInput {
  story: { title?: string | null } | null;
  source?: 'memory' | 'widget';
  // Chris 7 Nov: a direct lead made from a newsletter list (GET /leads source_list).
  source_list?: { id: number; name: string; added_at?: string | null } | null;
}

/** Text for a lead's "Via" line: its campaign, the website widget, the newsletter list it came from, or a direct message. */
export function leadViaText(lead: LeadViaInput): string {
  if (lead.story?.title) return `Via: ${lead.story.title}`;
  if (lead.source === 'widget') return 'Website widget';
  const list = lead.source_list?.name?.trim();
  return list ? `List: ${list}` : 'Direct message';
}

/** When a list lead was added to the list (the thread's "added from the list" row); else the lead's first date. */
export function listAddedAt(lead: { first_seen_at?: string | null; source_list?: LeadViaInput['source_list'] }): string | null {
  return lead.source_list?.added_at || lead.first_seen_at || null;
}
