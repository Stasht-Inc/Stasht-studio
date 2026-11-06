// Chris, 6 Nov 2026 (point 1): every reason / error shown above the Storeel page's actions reads like an error:
// "*Add a campaign title" — an asterisk first, no full stop at the end (red, left-aligned: StoreelLivePreview's page).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asErrorLine, actionLines } from '../../components/storeel/lib/actionLines.ts';

test('an asterisk first, no full stop at the end', () => {
  assert.equal(asErrorLine('Add a campaign title.'), '*Add a campaign title');
  assert.equal(asErrorLine('  Pick a category.  '), '*Pick a category');
  assert.equal(asErrorLine('Pick at least one item from your Website Catalogue.'), '*Pick at least one item from your Website Catalogue');
  // Only the last full stop goes; a question or a sentence inside stays.
  assert.equal(asErrorLine("Your changes couldn't be saved. Check your connection and try again."), "*Your changes couldn't be saved. Check your connection and try again");
  assert.equal(asErrorLine('Is this right?'), '*Is this right?');
  // Never two asterisks, never an empty line.
  assert.equal(asErrorLine('*Already marked.'), '*Already marked');
  assert.equal(asErrorLine('   '), '');
  assert.equal(asErrorLine(null), '');
});

test('nothing to say: no lines', () => {
  assert.deepEqual(actionLines({ actionError: null, saveReason: null, sendReason: null }), []);
});

test('why Save is off', () => {
  assert.deepEqual(actionLines({ actionError: null, saveReason: 'Add a campaign title.', sendReason: 'Choose who gets this Storeel.' }), [
    { id: 'st-save-reason', text: '*Add a campaign title', alert: false },
  ]);
});

test('why only Save & Send is off', () => {
  assert.deepEqual(actionLines({ actionError: null, saveReason: null, sendReason: 'Choose who gets this Storeel.' }), [
    { id: 'st-send-reason', text: '*To send now: Choose who gets this Storeel', alert: false },
  ]);
});

test('a refused save (or the server) is said first, as an alert, in the same style', () => {
  assert.deepEqual(actionLines({ actionError: 'Pick at least one item from your Website Catalogue.', saveReason: null, sendReason: 'Choose email, text or both.' }), [
    { id: 'st-action-error', text: '*Pick at least one item from your Website Catalogue', alert: true },
    { id: 'st-send-reason', text: '*To send now: Choose email, text or both', alert: false },
  ]);
});

test('the same words are never said twice', () => {
  assert.deepEqual(actionLines({ actionError: 'Add a campaign title.', saveReason: 'Add a campaign title.', sendReason: null }), [
    { id: 'st-save-reason', text: '*Add a campaign title', alert: true },
  ]);
});
