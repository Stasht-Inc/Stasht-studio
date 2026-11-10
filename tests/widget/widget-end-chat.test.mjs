// tests/widget/widget-end-chat.test.mjs — ✕ → "Would you like to end this chat?" (Chris, 10 Nov 2026)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldConfirmEnd, endChatUrl, chatForgottenElsewhere, chatStorageKey, END_CHAT_QUESTION,
} from '../../public/widget-core.js';

const TOKEN = 'a'.repeat(48);

test('✕ asks to end only once there is a conversation', () => {
  assert.equal(shouldConfirmEnd({ phase: 'chat', token: TOKEN }), true);
  assert.equal(shouldConfirmEnd({ phase: 'form', token: null }), false); // no chat yet: ✕ just closes
  assert.equal(shouldConfirmEnd({ phase: 'chat', token: null, provisional: true }), false); // first send still on its way
  assert.equal(shouldConfirmEnd({ phase: 'chat', token: '' }), false);
  assert.equal(shouldConfirmEnd(), false);
  assert.equal(END_CHAT_QUESTION, 'Would you like to end this chat?');
});

test('the end call goes to the widget-scoped /end route', () => {
  assert.equal(endChatUrl('https://studio.stasht.com/api/react', 'w_abc123defg'), 'https://studio.stasht.com/api/react/widgets/w_abc123defg/end');
});

test('another tab forgetting this widget\'s chat resets this tab; other keys and new tokens do not', () => {
  const key = chatStorageKey('w_abc123defg');
  assert.equal(chatForgottenElsewhere({ key, newValue: null }, 'w_abc123defg'), true);
  assert.equal(chatForgottenElsewhere({ key, newValue: '{"token":"x","updatedAt":1}' }, 'w_abc123defg'), false);
  assert.equal(chatForgottenElsewhere({ key: chatStorageKey('w_other00000'), newValue: null }, 'w_abc123defg'), false);
  assert.equal(chatForgottenElsewhere(null, 'w_abc123defg'), false);
});
