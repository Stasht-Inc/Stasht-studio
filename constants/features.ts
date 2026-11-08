// Feature switches for Studio. Pure (no imports), so `node --test` loads it.
//
// DocuSign hidden everywhere (Deepak, 8 Nov 2026): the Connectors card, its connect modal and OAuth callback, the
// sidebar badge's status call, every Add Widget chooser, the Send for signature modal, the envelopes panel and any
// DocuSign document already on a campaign (campaign page and published page). Nothing is deleted: set
// `docusign: true` to bring it all back. Data is untouched; the status endpoint is not called while it's off.
export const FEATURES = {
  docusign: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

/** Whether a feature is on. `features` is for tests; the app always reads FEATURES. */
export function featureEnabled(name: FeatureName, features: Readonly<Record<FeatureName, boolean>> = FEATURES): boolean {
  return features[name] === true;
}

/** DocuSign shown and its endpoints called (see above). */
export const DOCUSIGN_ENABLED: boolean = featureEnabled('docusign');
