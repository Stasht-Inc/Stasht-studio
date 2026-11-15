// Chris, 11 Nov 2026 (b), point 1: "Send by" has only ONE channel ticked for a new send — Email for a newsletter,
// Text message (SMS) for a Storeel. Both cards still show; ticking the other sends both. Saved drafts keep theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultChannels, toggleChannel } from '../../components/newsletters/lib/audience.ts';
import { emptyDraft, draftFromNewsletter } from '../../components/newsletters/lib/draft.ts';

test('newsletter defaults to Email only, Storeel to Text message only', () => {
  assert.deepEqual(defaultChannels('newsletter'), ['email']);
  assert.deepEqual(defaultChannels('storeel'), ['sms']);
});

test('each call is a fresh array (a tick never changes the default)', () => {
  const a = defaultChannels('storeel');
  a.push('email');
  assert.deepEqual(defaultChannels('storeel'), ['sms']);
});

test('ticking the second channel sends both, in Email-then-Text order', () => {
  assert.deepEqual(toggleChannel(defaultChannels('storeel'), 'email'), ['email', 'sms']);
  assert.deepEqual(toggleChannel(defaultChannels('newsletter'), 'sms'), ['email', 'sms']);
});

test('a new newsletter draft starts Email only', () => {
  assert.deepEqual(emptyDraft().channels, ['email']);
});

test('a saved draft keeps its stored channels', () => {
  assert.deepEqual(draftFromNewsletter({ channels: ['email', 'sms'] }).channels, ['email', 'sms']);
  assert.deepEqual(draftFromNewsletter({ channels: ['sms'] }).channels, ['sms']);
  assert.deepEqual(draftFromNewsletter({}).channels, ['email']);
});
