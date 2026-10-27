// [wdy2xh2p3e] CASL consent for imported lists. Express = they asked to hear from you (never expires); implied =
// customers and recent enquiries (the API leaves them out once older than 6 months).
import type { ConsentType } from '../../../services/newslettersAPI.ts';

export const CONSENT_OPTIONS: ReadonlyArray<{ value: ConsentType; label: string }> = [
  { value: 'express', label: 'They signed up or asked to hear from us (express consent)' },
  { value: 'implied', label: 'They’re customers or enquired recently (implied consent)' },
];

export const CONSENT_HINT = 'In Canada, implied consent lasts 6 months. After that, we leave these people out.';

export function consentLabel(type: ConsentType | null | undefined): string {
  if (type === 'express') return 'Express consent';
  if (type === 'implied') return 'Implied consent';
  return 'Consent not recorded';
}
