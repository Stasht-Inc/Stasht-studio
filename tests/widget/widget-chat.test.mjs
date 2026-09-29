// tests/widget/widget-chat.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_MESSAGE_MAX, CHAT_MAX_FILES, CHAT_MAX_FILE_BYTES, CHAT_FILE_TYPES, CHAT_TOKEN_TTL_MS,
  POLL_OPEN_MS, POLL_CLOSED_MS, POLL_CLOSED_WINDOW_MS, publicPersonFrom, chatStorageKey, readChatToken, writeChatToken,
  clearChatToken, messagesUrl, chatMessageFrom, mergeMessages, lastMessageId, acceptChatFiles, chatSendProblem,
  nextPollDelay, backoffDelay, hasUnreadTeamMessage, autoReplyAnchor, firstServerError,
} from '../../public/widget-core.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 29, 15, 0, 0);
const TOKEN = 'a'.repeat(48);

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    has: (k) => data.has(k),
  };
}

test('limits and timings match the API and the spec', () => {
  assert.equal(CHAT_MESSAGE_MAX, 1000);
  assert.equal(CHAT_MAX_FILES, 3);
  assert.equal(CHAT_MAX_FILE_BYTES, 5 * 1024 * 1024);
  assert.deepEqual(CHAT_FILE_TYPES, ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
  assert.equal(CHAT_TOKEN_TTL_MS, 30 * DAY);
  assert.deepEqual([POLL_OPEN_MS, POLL_CLOSED_MS, POLL_CLOSED_WINDOW_MS], [3000, 15000, 60 * 60 * 1000]);
});

test('the token is stored per widget as {token, updatedAt}', () => {
  const s = memoryStorage();
  assert.equal(chatStorageKey('w_abcdefghij'), 'stasht-widget-chat:w_abcdefghij');
  assert.equal(writeChatToken(s, 'w_abcdefghij', TOKEN, NOW), true);
  assert.deepEqual(JSON.parse(s.getItem('stasht-widget-chat:w_abcdefghij')), { token: TOKEN, updatedAt: NOW });
  assert.deepEqual(readChatToken(s, 'w_abcdefghij', NOW + 29 * DAY), { token: TOKEN, updatedAt: NOW });
  assert.equal(readChatToken(s, 'w_bbbbbbbbbb', NOW), null, 'another widget has its own conversation');
});

test('a token 30 days old, or a malformed one, is dropped', () => {
  const key = chatStorageKey('w_abcdefghij');
  const old = memoryStorage({ [key]: JSON.stringify({ token: TOKEN, updatedAt: NOW - 30 * DAY }) });
  assert.equal(readChatToken(old, 'w_abcdefghij', NOW), null);
  assert.equal(old.has(key), false);

  for (const bad of ['not json', JSON.stringify({ token: '', updatedAt: NOW }), JSON.stringify({ token: TOKEN }), JSON.stringify({ token: 'x'.repeat(65), updatedAt: NOW })]) {
    const s = memoryStorage({ [key]: bad });
    assert.equal(readChatToken(s, 'w_abcdefghij', NOW), null, bad);
    assert.equal(s.has(key), false, bad);
  }

  const s = memoryStorage();
  writeChatToken(s, 'w_abcdefghij', TOKEN, NOW);
  clearChatToken(s, 'w_abcdefghij');
  assert.equal(s.has(key), false);
});

test('blocked storage never throws', () => {
  const blocked = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  assert.equal(readChatToken(blocked, 'w_abcdefghij', NOW), null);
  assert.equal(writeChatToken(blocked, 'w_abcdefghij', TOKEN, NOW), false);
  assert.doesNotThrow(() => clearChatToken(blocked, 'w_abcdefghij'));
});

test('chatMessageFrom keeps only safe, renderable messages', () => {
  const m = chatMessageFrom({
    id: 12, from: 'team', body: 'Hi Jordan', sent_at: '2026-09-29T20:30:00+05:30',
    attachments: [
      { url: 'https://cdn.example/a.jpg', filename: 'a.jpg', content_type: 'image/jpeg' },
      { url: 'https://cdn.example/q.pdf', filename: 'q.pdf', content_type: 'application/pdf' },
      { url: 'javascript:alert(1)', filename: 'x', content_type: 'image/png' },
    ],
    sender: { name: 'Sam', avatar_url: 'http://insecure/x.jpg', initials: 'SC', color: '#10B981' },
  });
  assert.equal(m.id, 12);
  assert.equal(m.from, 'team');
  assert.equal(m.body, 'Hi Jordan');
  assert.equal(m.sentAt.toISOString(), '2026-09-29T15:00:00.000Z');
  assert.deepEqual(m.attachments, [
    { url: 'https://cdn.example/a.jpg', filename: 'a.jpg', isImage: true },
    { url: 'https://cdn.example/q.pdf', filename: 'q.pdf', isImage: false },
  ]);
  assert.deepEqual(m.sender, { name: 'Sam', avatarUrl: null, initials: 'SC', color: '#10B981' });

  assert.equal(chatMessageFrom({ id: 13, from: 'visitor', body: 'Hi', sender: { name: 'Nope' } }).sender, null, 'visitors have no sender');
  assert.equal(chatMessageFrom({ id: 14, from: 'team', body: 'Hi', sender: null }).sender, null);
  assert.equal(chatMessageFrom({ id: 15, from: 'team', body: '', attachments: [{ url: 'https://cdn.example/a.jpg', filename: 'a.jpg', content_type: 'image/jpeg' }] }).body, '');
  for (const bad of [null, {}, { id: 0, from: 'team', body: 'x' }, { id: 1, from: 'bot', body: 'x' }, { id: 2, from: 'team', body: '  ', attachments: [] }]) {
    assert.equal(chatMessageFrom(bad), null, JSON.stringify(bad));
  }
});

test('mergeMessages orders by id and drops duplicates; lastMessageId and messagesUrl page from the newest', () => {
  const a = { id: 3 };
  const b = { id: 1 };
  const c = { id: 2 };
  const b2 = { id: 1, body: 'newer copy' };
  assert.deepEqual(mergeMessages([a, b], [c, b2]), [b2, c, a]);
  assert.equal(lastMessageId([a, b, c]), 3);
  assert.equal(lastMessageId([]), 0);
  assert.equal(messagesUrl('https://studio.stasht.com/api/react', 'w_abcdefghij'), 'https://studio.stasht.com/api/react/widgets/w_abcdefghij/messages');
  assert.equal(messagesUrl('https://studio.stasht.com/api/react', 'w_abcdefghij', 41), 'https://studio.stasht.com/api/react/widgets/w_abcdefghij/messages?after=41');
});

test('acceptChatFiles: 3 per message, photos and PDFs, 5 MB each', () => {
  const file = (name, type, size = 1000) => ({ name, type, size });

  let r = acceptChatFiles(0, [file('a.jpg', 'image/jpeg'), file('b.webp', 'image/webp'), file('c.pdf', 'application/pdf')]);
  assert.equal(r.accepted.length, 3);
  assert.equal(r.error, null);

  r = acceptChatFiles(2, [file('a.png', 'image/png'), file('b.png', 'image/png')]);
  assert.deepEqual(r.accepted.map((f) => f.name), ['a.png']);
  assert.equal(r.error, 'You can attach up to 3 files per message.');

  r = acceptChatFiles(0, [file('notes.txt', 'text/plain'), file('clip.mov', 'video/quicktime')]);
  assert.deepEqual(r.accepted, []);
  assert.equal(r.error, 'You can attach JPG, PNG, GIF or WebP photos and PDF files.');

  r = acceptChatFiles(0, [file('huge.pdf', 'application/pdf', 5 * 1024 * 1024 + 1), file('ok.pdf', 'application/pdf', 5 * 1024 * 1024)]);
  assert.deepEqual(r.accepted.map((f) => f.name), ['ok.pdf']);
  assert.equal(r.error, 'huge.pdf is over 5 MB.');
});

test('chatSendProblem: words or a file, at most 1,000 characters', () => {
  assert.equal(chatSendProblem('  ', 0), 'Type a message or attach a file.');
  assert.equal(chatSendProblem('', 1), null);
  assert.equal(chatSendProblem('Hi', 0), null);
  assert.equal(chatSendProblem('a'.repeat(1000), 0), null);
  assert.equal(chatSendProblem('a'.repeat(1001), 0), 'Messages can be up to 1,000 characters.');
  assert.equal(chatSendProblem('😀'.repeat(1000), 0), null, 'counted like the server: characters, not UTF-16 units');
});

test('nextPollDelay: 3 s open; 15 s closed for an hour after the last message; then stop', () => {
  assert.equal(nextPollDelay({ open: true, lastActivityAt: NOW - 5 * 60 * 60 * 1000, now: NOW }), 3000);
  assert.equal(nextPollDelay({ open: false, lastActivityAt: NOW - 59 * 60 * 1000, now: NOW }), 15000);
  assert.equal(nextPollDelay({ open: false, lastActivityAt: NOW - 60 * 60 * 1000, now: NOW }), null);
  assert.equal(nextPollDelay({ open: false, lastActivityAt: 0, now: NOW }), null);
});

test('backoffDelay doubles after failures, capped at a minute', () => {
  assert.equal(backoffDelay(3000, 0), 3000);
  assert.equal(backoffDelay(3000, 1), 6000);
  assert.equal(backoffDelay(3000, 3), 24000);
  assert.equal(backoffDelay(3000, 10), 60000);
  assert.equal(backoffDelay(15000, 2), 60000);
});

test('hasUnreadTeamMessage: a team message newer than the last look', () => {
  const msgs = [
    { id: 1, from: 'visitor', sentAt: new Date(NOW + 1000) },
    { id: 2, from: 'team', sentAt: new Date(NOW - 1000) },
  ];
  assert.equal(hasUnreadTeamMessage(msgs, NOW), false);
  assert.equal(hasUnreadTeamMessage([...msgs, { id: 3, from: 'team', sentAt: new Date(NOW + 5000) }], NOW), true);
  assert.equal(hasUnreadTeamMessage([{ id: 4, from: 'team', sentAt: null }], NOW), false);
});

test('autoReplyAnchor: after the message just sent from the form, else after the first visitor message', () => {
  const list = [{ id: 5, from: 'visitor' }, { id: 6, from: 'team' }, { id: 9, from: 'visitor' }];
  assert.equal(autoReplyAnchor(list, 9), 9);
  assert.equal(autoReplyAnchor(list, null), 5);
  assert.equal(autoReplyAnchor(list, 42), 5, 'an id that is not in the list falls back');
  assert.equal(autoReplyAnchor([{ id: 6, from: 'team' }], null), null);
  assert.equal(autoReplyAnchor([], null), null);
});

test('firstServerError picks the first validation message', () => {
  assert.equal(
    firstServerError({ message: 'The given data was invalid.', errors: { 'files.0': ['Each file can be 5 MB at most.'] } }, 'fallback'),
    'Each file can be 5 MB at most.',
  );
  assert.equal(firstServerError({ errors: { body: 'Too long' } }, 'fallback'), 'Too long');
  assert.equal(firstServerError(null, 'fallback'), 'fallback');
  assert.equal(firstServerError({ message: 'Server Error' }, 'fallback'), 'fallback');
});

test('publicPersonFrom: first name, https photo, two-letter initials, safe colour', () => {
  assert.deepEqual(
    publicPersonFrom({ name: ' Sam ', avatar_url: 'https://cdn.example/s.jpg', initials: 'sc', color: '#10B981' }),
    { name: 'Sam', avatarUrl: 'https://cdn.example/s.jpg', initials: 'SC', color: '#10B981' },
  );
  assert.deepEqual(publicPersonFrom({ name: 'Andrew', initials: 'AVD', color: 'red' }), { name: 'Andrew', avatarUrl: null, initials: 'AV', color: '#6C60FF' });
  assert.equal(publicPersonFrom({ name: '' }), null);
  assert.equal(publicPersonFrom(null), null);
});
