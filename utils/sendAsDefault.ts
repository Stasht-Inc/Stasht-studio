// Leads › "+ Send Message" › "Send as" (Chris / Deepak, 16 Nov 2026): which business the new conversation is filed
// under. The web API (LeadConversationStartController) needs one when the account is on 2+ team properties; the
// dialog picks it for the person, and they can still change it:
//   - only one business: that one (the picker is hidden then);
//   - a property view: the property being viewed;
//   - the main account: the business's own property — the one internal property this account created
//     (GET /properties: is_creator + account_type 'internal', not the viewer's own External account). With none, or
//     more than one such property, there is no reliable answer, so nothing is picked and the person chooses.
//
// The business itself (Chris, 20 Nov 2026: "you need to be able to send as business. Where is Royal Woodshop?"): in the
// main account's view, when it has no own internal property and the picker shows (2+ properties, or the only one is
// someone's External account), the account itself is the first option (SEND_AS_BUSINESS — sent as send_as: 'account',
// filed under no property, signed and sent as the business). It is also what starts picked whenever the rules above
// leave nothing picked.

type Row = Record<string, any> | null | undefined;

export interface SendAsOption { id: string; row?: Row }

/** The option id of the business itself (the account in use) in "Send as". */
export const SEND_AS_BUSINESS = '__business__';

/**
 * Whether "Send as" offers the business itself: main-account view only, when the business has no property of its own,
 * and only when there is a choice to make — 2+ properties, or one that is not an internal business (an External
 * account: filing under it is not "the business").
 * A single internal property (a salesperson's dealership) keeps the picker hidden, as before.
 */
export function offersBusiness(properties: readonly SendAsOption[], inPropertyView: boolean): boolean {
  if (inPropertyView || properties.length === 0) return false;
  // The business's own property already stands for the business (16 Nov rule): no second option of the same name.
  if (properties.some((o) => isOwnBusinessProperty(o.row))) return false;
  if (properties.length >= 2) return true;
  const row = properties[0].row;
  return !(row && typeof row.account_type === 'string' && row.account_type.trim().toLowerCase() === 'internal');
}

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
  if (own.length === 1) return own[0].id;
  return options.some((o) => o.id === SEND_AS_BUSINESS) ? SEND_AS_BUSINESS : '';
}
