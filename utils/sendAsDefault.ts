// Leads › "+ Send Message" › "Send as" (Chris / Deepak, 16 Nov 2026): which business the new conversation is filed
// under. The web API (LeadConversationStartController) needs one when the account is on 2+ team properties; the
// dialog picks it for the person, and they can still change it:
//   - only one business: that one (the picker is hidden then);
//   - a property view: the property being viewed;
//   - the main account: the business's own property — the one internal property this account created
//     (GET /properties: is_creator + account_type 'internal', not the viewer's own External account). With none, or
//     more than one such property, there is no reliable answer, so nothing is picked and the person chooses.

type Row = Record<string, any> | null | undefined;

export interface SendAsOption { id: string; row?: Row }

/** The business's own property: created by this account (is_creator) and explicitly internal. */
export function isOwnBusinessProperty(row: Row): boolean {
  if (!row || row.is_creator !== true) return false;
  if (typeof row.account_type !== 'string' || row.account_type.trim().toLowerCase() !== 'internal') return false;
  return row.is_own_external_account !== true;
}

/** The option id to start on, or '' (none picked). `viewPropertyId`: the property view's property, else null. */
export function defaultSendAs(options: readonly SendAsOption[], viewPropertyId?: string | number | null): string {
  if (options.length === 0) return '';
  if (options.length === 1) return options[0].id;
  if (viewPropertyId !== null && viewPropertyId !== undefined && String(viewPropertyId) !== '') {
    return options.find((o) => o.id === String(viewPropertyId))?.id ?? '';
  }
  const own = options.filter((o) => isOwnBusinessProperty(o.row));
  return own.length === 1 ? own[0].id : '';
}
