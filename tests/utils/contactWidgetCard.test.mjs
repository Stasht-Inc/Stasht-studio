// tests/utils/contactWidgetCard.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris + Deepak, 5 Nov 2026 (point 8): the Contact Us widget is Business-plan only, shown like the Website Catalogue's
// card on Teams ("Available on the Business plan." + See plans). Widgets a Teams account already has keep working: its
// card still shows them (Manage opens the list: install code and delete; creating or editing goes to the plans).
// GET /widgets says business_plan_required (the API's effective plan: a salesperson covered by a Business main account
// is Business).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactWidgetCard, BUSINESS_ONLY_LINE } from '../../components/connectors/contactWidget.ts';

test('Business: the usual card (Connect, or Manage once there are widgets)', () => {
  assert.deepEqual(contactWidgetCard({ isStarter: false, businessPlanRequired: false, status: undefined }), { disabled: false, action: 'open' });
  assert.deepEqual(contactWidgetCard({ isStarter: false, businessPlanRequired: false, status: '1 widget · 1 live' }), { disabled: false, action: 'open' });
});

test('Teams without widgets: "Available on the Business plan." with See plans, like the Website Catalogue', () => {
  const card = contactWidgetCard({ isStarter: false, businessPlanRequired: true, status: undefined });
  assert.equal(card.action, 'billing');
  assert.equal(card.disabled, false);
  assert.deepEqual(card.override, { line: 'Available on the Business plan.', actionLabel: 'See plans', outlined: false });
  assert.equal(BUSINESS_ONLY_LINE, 'Available on the Business plan.');
});

test('Teams with widgets: they keep working, Manage still opens them', () => {
  const card = contactWidgetCard({ isStarter: false, businessPlanRequired: true, status: '2 widgets · 1 live · on 1 website · 3 leads' });
  assert.equal(card.action, 'open');
  assert.deepEqual(card.override, {
    badge: { label: 'Connected', tone: 'green' },
    line: '2 widgets · 1 live · on 1 website · 3 leads · changes need the Business plan',
    actionLabel: 'Manage',
    outlined: true,
  });
});

test('Starter keeps the Connectors gate (clicking opens the upgrade plans)', () => {
  assert.deepEqual(contactWidgetCard({ isStarter: true, businessPlanRequired: true, status: undefined }), { disabled: true, action: 'upgrade' });
  assert.deepEqual(contactWidgetCard({ isStarter: true, businessPlanRequired: true, status: '1 widget' }), { disabled: true, action: 'upgrade' });
});

test('no answer yet (or an older API without the field): the usual card; the API still refuses changes', () => {
  assert.deepEqual(contactWidgetCard({ isStarter: false, businessPlanRequired: null, status: undefined }), { disabled: false, action: 'open' });
});

// Review of 5 Nov 2026: a Teams owner can still switch an existing widget off and on, and delete it (the API allows
// DELETE and PATCH {status: paused | live} on any plan). Business owners do both in the editor, as before.
import { teamsRowActions } from '../../components/connectors/contactWidget.ts';

test('Teams list rows: Pause a live widget, Resume a paused one, Delete any', () => {
  assert.deepEqual(teamsRowActions('live', true), { toggle: { label: 'Pause', status: 'paused' }, canDelete: true });
  assert.deepEqual(teamsRowActions('paused', true), { toggle: { label: 'Resume', status: 'live' }, canDelete: true });
  assert.deepEqual(teamsRowActions('draft', true), { toggle: null, canDelete: true }, 'a draft is set Live from the install guide');
});

test('Business list rows keep only Edit and Install (pause and delete are in the editor)', () => {
  assert.deepEqual(teamsRowActions('live', false), { toggle: null, canDelete: false });
});
