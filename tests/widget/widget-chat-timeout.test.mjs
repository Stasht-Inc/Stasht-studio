// tests/widget/widget-chat-timeout.test.mjs — idle website chats end (Chris, 11 Nov 2026)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatTimeoutMs, chatIdleExpired, goneOutcome, CHAT_TIMEOUT_DEFAULT_MINUTES, CHAT_TIMEOUT_OPTIONS, CHAT_ENDED_TEXT, START_NEW_CHAT,
} from '../../public/widget-core.js';

const MIN = 60 * 1000;

test('the timeout comes from the widget config, 30 minutes by default', () => {
  assert.equal(CHAT_TIMEOUT_DEFAULT_MINUTES, 30);
  assert.deepEqual(CHAT_TIMEOUT_OPTIONS, [15, 30, 60, 240, 1440]);
  assert.equal(chatTimeoutMs({ chat_timeout_minutes: 240 }), 240 * MIN);
  assert.equal(chatTimeoutMs({ chat_timeout_minutes: 15 }), 15 * MIN);
  assert.equal(chatTimeoutMs({}), 30 * MIN); // an older API sends none
  assert.equal(chatTimeoutMs(null), 30 * MIN);
  assert.equal(chatTimeoutMs({ chat_timeout_minutes: 7 }), 30 * MIN); // not one of the choices
});

test('a chat is expired only once it has been quiet for longer than the timeout', () => {
  const now = 10_000 * MIN;
  const timeoutMs = 30 * MIN;
  assert.equal(chatIdleExpired({ lastActivityAt: now - 29 * MIN, timeoutMs, now }), false);
  assert.equal(chatIdleExpired({ lastActivityAt: now - 31 * MIN, timeoutMs, now }), true);
  assert.equal(chatIdleExpired({ lastActivityAt: 0, timeoutMs, now }), false); // nothing known yet
  assert.equal(chatIdleExpired({ lastActivityAt: now - 31 * MIN, timeoutMs: 240 * MIN, now }), false);
  assert.equal(chatIdleExpired(), false);
});

test('a gone chat shows the ended line only while open in front of the visitor; otherwise a fresh start', () => {
  assert.equal(goneOutcome({ open: true, phase: 'chat', messageCount: 3 }), 'ended');
  assert.equal(goneOutcome({ open: false, phase: 'chat', messageCount: 3 }), 'fresh'); // closed: next open is the form
  assert.equal(goneOutcome({ open: true, phase: 'form', messageCount: 0 }), 'fresh');
  assert.equal(goneOutcome({ open: true, phase: 'chat', messageCount: 0 }), 'fresh');
  assert.equal(goneOutcome(), 'fresh');
  assert.equal(CHAT_ENDED_TEXT, 'This chat has ended.');
  assert.equal(START_NEW_CHAT, 'Start a new one');
});
