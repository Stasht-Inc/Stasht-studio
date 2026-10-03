// tests/widget/widget-ai.test.mjs — the widget AI (spec 2026-09-29 part 2 §3; always on since 2026-10-03).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPING_DELAY_MS, AI_RUN_GAP_MS, AI_NOTICE, campaignFrom, campaignCardText, bodyWithoutLink, chatMessageFrom,
  aiNoticeBefore, autoReplyAnchor, joinedText, repJoinedBefore,
} from '../../public/widget-core.js';

const H = 60 * 60 * 1000;
const at = (hours) => new Date(Date.UTC(2026, 9, 5, 0, 0, 0) + hours * H);
const visitor = (id, hours) => ({ id, from: 'visitor', sentAt: at(hours), isAi: false, autoReply: false });
const ai = (id, hours) => ({ id, from: 'team', sentAt: at(hours), isAi: true, autoReply: false });
const rep = (id, hours, name = 'Sam') => ({
  id, from: 'team', sentAt: at(hours), isAi: false, autoReply: false, sender: { name, avatarUrl: null, initials: name[0], color: '#6C60FF' },
});
const notice = (id, hours) => ({ id, from: 'team', sentAt: at(hours), isAi: true, autoReply: true });
const LINK = 'https://restapi.stasht.com/share/memory/suvs-abc?s=Tok3n';

test('constants match the spec', () => {
  assert.equal(TYPING_DELAY_MS, 600);
  assert.equal(AI_RUN_GAP_MS, 12 * H);
  assert.equal(AI_NOTICE, "You're chatting with our AI assistant. A team member can join at any time.");
  assert.doesNotMatch(AI_NOTICE, /business hours/, 'the AI answers at any hour now');
});

test('chatMessageFrom reads the AI flags and the campaign card, on team messages only', () => {
  const m = chatMessageFrom({
    id: 20, from: 'team', body: `Here you go: ${LINK}`, sender: null,
    is_ai: true, auto_reply: false, campaign: { title: 'SUVs under $40,000', url: LINK, vehicles: 6 },
  });
  assert.equal(m.isAi, true);
  assert.equal(m.autoReply, false);
  assert.deepEqual(m.campaign, { title: 'SUVs under $40,000', url: LINK, linkText: LINK, vehicles: 6 });

  const n = chatMessageFrom({ id: 21, from: 'team', body: 'Thanks!', is_ai: true, auto_reply: true });
  assert.deepEqual([n.isAi, n.autoReply, n.campaign], [true, true, null]);

  const v = chatMessageFrom({ id: 22, from: 'visitor', body: 'Hi', is_ai: true, auto_reply: true, campaign: { title: 'x', url: LINK } });
  assert.deepEqual([v.isAi, v.autoReply, v.campaign], [false, false, null], 'visitors are never the AI');

  const older = chatMessageFrom({ id: 23, from: 'team', body: 'From an API without the flags' });
  assert.deepEqual([older.isAi, older.autoReply, older.campaign], [false, false, null]);

  assert.equal(chatMessageFrom({ id: 24, from: 'team', body: 'x', is_ai: 'yes' }).isAi, false, 'only a real true counts');
  assert.equal(chatMessageFrom({ id: 25, from: 'team', body: 'x', auto_reply: true }).autoReply, false, 'a notice is always an AI message');
});

test('campaignFrom keeps only an https link with a title', () => {
  assert.deepEqual(campaignFrom({ title: ' Hybrids ', url: LINK, vehicles: 2 }), { title: 'Hybrids', url: LINK, linkText: LINK, vehicles: 2 });
  assert.equal(campaignFrom({ title: 'Hybrids', url: 'http://insecure.example/x' }), null);
  assert.equal(campaignFrom({ title: '', url: LINK }), null);
  assert.equal(campaignFrom({ title: 'x', url: 'javascript:alert(1)' }), null);
  assert.equal(campaignFrom(null), null);
  assert.equal(campaignFrom({ title: 'x', url: LINK, vehicles: -3 }).vehicles, 0);
  assert.equal(campaignFrom({ title: 'x', url: LINK, vehicles: '6' }).vehicles, 0);
});

test('campaignCardText', () => {
  assert.equal(campaignCardText(6), 'View 6 vehicles');
  assert.equal(campaignCardText(1), 'View 1 vehicle');
  assert.equal(campaignCardText(0), 'View vehicles');
});

test('bodyWithoutLink drops the link the card carries', () => {
  assert.equal(bodyWithoutLink(`Here are 6 SUVs under $40,000: ${LINK}`, LINK), 'Here are 6 SUVs under $40,000:');
  assert.equal(bodyWithoutLink(`Take a look  ${LINK}\nAny questions?`, LINK), 'Take a look\nAny questions?');
  assert.equal(bodyWithoutLink('No link here.', LINK), 'No link here.');
  assert.equal(bodyWithoutLink(`Only ${LINK}`, ''), `Only ${LINK}`);
});

test('aiNoticeBefore: the first AI reply of each run', () => {
  assert.deepEqual([...aiNoticeBefore([visitor(1, 0), ai(2, 0), visitor(3, 0.1), ai(4, 0.1)])], [2], 'one run');
  assert.deepEqual([...aiNoticeBefore([visitor(1, 0), ai(2, 0), visitor(3, 13), ai(4, 13)])], [2, 4], 'more than 12 h apart: a new run');
  assert.deepEqual([...aiNoticeBefore([visitor(1, 0), ai(2, 0), visitor(3, 1), rep(4, 1), visitor(5, 2), ai(6, 2)])], [2, 6], 'a rep in between');
  assert.deepEqual([...aiNoticeBefore([visitor(1, 0), notice(2, 0), visitor(3, 1), ai(4, 1)])], [4], 'the after-hours notice is not an AI reply');
  assert.deepEqual([...aiNoticeBefore([visitor(1, 0), rep(2, 0)])], []);
  assert.deepEqual([...aiNoticeBefore([])], []);
  assert.deepEqual([...aiNoticeBefore([visitor(1, 0), { ...ai(2, 0), sentAt: null }, visitor(3, 20), { ...ai(4, 20), sentAt: null }])], [2], 'unknown times continue the run');
});

test('autoReplyAnchor: an AI reply or the after-hours notice replaces the automatic reply', () => {
  assert.equal(autoReplyAnchor([visitor(5, 0), ai(6, 0)], 5), null, 'answered by the AI in the same request');
  assert.equal(autoReplyAnchor([visitor(5, 0), notice(6, 0)], null), null, 'the notice, loaded again later');
  assert.equal(autoReplyAnchor([visitor(5, 0), rep(6, 0)], null), 5, 'a person replying later keeps it');
  assert.equal(autoReplyAnchor([visitor(5, 0)], 5, true), null, 'switched off when /submit came back with replies');
  assert.equal(autoReplyAnchor([visitor(5, 0)], 5), 5);
});

test('joinedText', () => {
  assert.equal(joinedText('Sam'), 'Sam has joined the conversation');
  assert.equal(joinedText('  Sam '), 'Sam has joined the conversation');
  assert.equal(joinedText(''), 'A team member has joined the conversation');
});

test('repJoinedBefore: a rep taking over from the AI', () => {
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), visitor(3, 0.1), rep(4, 0.2)])], [4], 'the first rep message after the AI');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), rep(3, 0.2), visitor(4, 0.3), rep(5, 0.4), rep(6, 2)])], [3],
    'only once while the rep keeps the chat');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), rep(3, 1), visitor(4, 14), ai(5, 14), rep(6, 15)])], [3, 6],
    'the AI answered again after the takeover lapsed: the rep joins again');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), rep(3, 1), visitor(4, 13), rep(5, 13)])], [3, 5],
    '12 h+ since the last rep message in a conversation the AI touched: a new takeover');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), rep(3, 1), visitor(4, 12.5), rep(5, 12.9)])], [3],
    'under 12 h since the last rep message: still the same takeover');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), notice(2, 0), rep(3, 1)])], [3], 'after the fallback notice too');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), rep(3, 0.5, 'Sam'), rep(4, 0.6, 'Alex')])], [3]);
});

test('repJoinedBefore: never in a conversation the AI never touched, nor for the AI or unnamed messages', () => {
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), rep(2, 0), visitor(3, 20), rep(4, 20)])], [], 'reps only, even 12 h+ apart');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), visitor(3, 0.1), ai(4, 0.1)])], []);
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), { ...rep(3, 1), sender: null }, rep(4, 1.1)])], [4],
    'a team message without a sender is skipped; the next person still joins');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), { ...rep(3, 1), sentAt: null }, visitor(4, 20), { ...rep(5, 20), sentAt: null }])], [3],
    'unknown times count as no gap');
  assert.deepEqual([...repJoinedBefore([])], []);
});

test('repJoinedBefore works on messages straight from the API', () => {
  const list = [
    { id: 1, from: 'visitor', body: 'Hi', sent_at: '2026-10-05T10:00:00Z' },
    { id: 2, from: 'team', body: 'Hello! How can I help?', is_ai: true, auto_reply: false, sender: null, sent_at: '2026-10-05T10:00:05Z' },
    { id: 3, from: 'team', body: 'Hi, Sam here.', is_ai: false, sender: { name: 'Sam', initials: 'SR', color: '#0ea5e9' }, sent_at: '2026-10-05T10:02:00Z' },
  ].map(chatMessageFrom);
  const joined = repJoinedBefore(list);
  assert.deepEqual([...joined], [3]);
  assert.equal(joinedText(list.find((m) => joined.has(m.id)).sender.name), 'Sam has joined the conversation');
});
