// tests/utils/composerCampaign.test.mjs — node --test (imports the TypeScript source).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertDraft, replaceDraft, removeDraft, fallbackDraft, CAMPAIGN_PLACEHOLDER } from '../../utils/composerCampaign.ts';

const draft = `Here are 2 products picked for you:\nOak: https://shop.test/oak\nChair: ${CAMPAIGN_PLACEHOLDER}`;

test('the wording goes in at the cursor on its own lines and the cursor lands after it', () => {
  assert.deepEqual(insertDraft('', 0, 0, draft), { text: draft, cursor: draft.length });
  const r = insertDraft('Hi Pat, as promised. Call me.', 20, 20, draft);
  assert.equal(r.text, `Hi Pat, as promised.\n\n${draft}\n\n Call me.`);
  assert.equal(r.text.slice(0, r.cursor), `Hi Pat, as promised.\n\n${draft}`);
  assert.equal(insertDraft('Hi\n', 3, 3, 'X').text, 'Hi\n\nX');
});

test('a new pick replaces the old wording when it is still there, else goes in at the cursor', () => {
  const box = `Hi\n\n${draft}\n\nThanks`;
  assert.equal(replaceDraft(box, draft, 'NEW', 0, 0).text, 'Hi\n\nNEW\n\nThanks');
  assert.equal(replaceDraft('Hi edited', draft, 'NEW', 9, 9).text, 'Hi edited\n\nNEW');
});

test('removing the chip takes the wording out and never leaves the placeholder', () => {
  assert.equal(removeDraft(`Hi\n\n${draft}\n\nThanks`, draft), 'Hi\n\nThanks');
  assert.equal(removeDraft(`Edited text ${CAMPAIGN_PLACEHOLDER} more`, draft), 'Edited text  more');
});

test('fallback wording carries the placeholder', () => {
  assert.equal(fallbackDraft(1, 'vehicle'), `Here is a vehicle picked for you: ${CAMPAIGN_PLACEHOLDER}`);
  assert.equal(fallbackDraft(3, 'product'), `Here are 3 products picked for you: ${CAMPAIGN_PLACEHOLDER}`);
});
