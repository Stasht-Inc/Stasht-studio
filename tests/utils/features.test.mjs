// tests/utils/features.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Deepak, 8 Nov 2026: DocuSign hidden everywhere in Studio, reversibly — one switch (constants/features.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURES, DOCUSIGN_ENABLED, featureEnabled } from '../../constants/features.ts';

test('DocuSign is off: the switch, the helper and the constant agree', () => {
  assert.equal(FEATURES.docusign, false);
  assert.equal(featureEnabled('docusign'), false);
  assert.equal(DOCUSIGN_ENABLED, false);
});

test('featureEnabled reads the given switches (turning DocuSign back on is one edit)', () => {
  assert.equal(featureEnabled('docusign', { docusign: true }), true);
  assert.equal(featureEnabled('docusign', { docusign: false }), false);
  // Only a real `true` turns a feature on.
  assert.equal(featureEnabled('docusign', /** @type {any} */ ({})), false);
  assert.equal(featureEnabled('docusign', /** @type {any} */ ({ docusign: 'yes' })), false);
});
