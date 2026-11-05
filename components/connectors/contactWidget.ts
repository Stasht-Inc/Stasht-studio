// The Contact Us Widget card on the Connectors page (pages/MarketplacePage.tsx).
//
// Chris + Deepak, 5 Nov 2026 (point 8): the widget is Business-plan only, gated like the Website Catalogue's card. GET
// /widgets says business_plan_required (the API's effective plan: a salesperson covered by a Business main account is
// Business). Widgets a Teams account already has keep working on its website, so its card still shows them and Manage
// still opens the list (install code, delete); creating or editing a widget goes to the plans.
import type { ConnectorCardOverride } from './catalog';

export const BUSINESS_ONLY_LINE = 'Available on the Business plan.';

export interface ContactWidgetCard {
  disabled: boolean;
  /** open = the widget manager; billing = Billing with the plans open (openBillingUpgrade); upgrade = the Starter gate. */
  action: 'open' | 'billing' | 'upgrade';
  override?: ConnectorCardOverride;
}

export function contactWidgetCard({
  isStarter,
  businessPlanRequired,
  status,
}: {
  isStarter: boolean;
  /** From GET /widgets; null until it answers (or from an older API): the usual card, the API still refuses changes. */
  businessPlanRequired: boolean | null;
  /** The card's status line when the account has widgets ("1 widget · 1 live · …"), else undefined. */
  status: string | undefined;
}): ContactWidgetCard {
  if (isStarter) return { disabled: true, action: 'upgrade' };
  if (businessPlanRequired !== true) return { disabled: false, action: 'open' };
  if (status === undefined) {
    return { disabled: false, action: 'billing', override: { line: BUSINESS_ONLY_LINE, actionLabel: 'See plans', outlined: false } };
  }
  return {
    disabled: false,
    action: 'open',
    override: {
      badge: { label: 'Connected', tone: 'green' },
      line: `${status} · changes need the Business plan`,
      actionLabel: 'Manage',
      outlined: true,
    },
  };
}

/**
 * Extra buttons on a widget's row in the manager's list when the account is not on Business (review of 5 Nov 2026): it
 * can't open the editor, but may still switch an existing widget off and on (PATCH {status} alone) and delete it. A draft
 * is set Live from the install guide. Business owners do both in the editor, so they get none here.
 */
export function teamsRowActions(
  status: 'draft' | 'live' | 'paused',
  businessPlanRequired: boolean,
): { toggle: { label: 'Pause' | 'Resume'; status: 'paused' | 'live' } | null; canDelete: boolean } {
  if (!businessPlanRequired) return { toggle: null, canDelete: false };
  const toggle = status === 'live'
    ? { label: 'Pause' as const, status: 'paused' as const }
    : status === 'paused' ? { label: 'Resume' as const, status: 'live' as const } : null;
  return { toggle, canDelete: true };
}
