// tests/widget/widget-ai.test.mjs — the after-hours AI in the widget (spec 2026-09-29 part 2 §3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TYPING_DELAY_MS, AI_RUN_GAP_MS, AI_NOTICE, campaignFrom, campaignCardText, bodyWithoutLink, chatMessageFrom,
  aiNoticeBefore, autoReplyAnchor,
} from '../../public/widget-core.js';

const H = 60 * 60 * 1000;
const at = (hours) => new Date(Date.UTC(2026, 9, 5, 0, 0, 0) + hours * H);
const visitor = (id, hours) => ({ id, from: 'visitor', sentAt: at(hours), isAi: false, autoReply: false });
const ai = (id, hours) => ({ id, from: 'team', sentAt: at(hours), isAi: true, autoReply: false });
const rep = (id, hours) => ({ id, from: 'team', sentAt: at(hours), isAi: false, autoReply: false });
const notice = (id, hours) => ({ id, from: 'team', sentAt: at(hours), isAi: true, autoReply: true });
const LINK = 'https://restapi.stasht.com/share/memory/suvs-abc?s=Tok3n';

test('constants match the spec', () => {
  assert.equal(TYPING_DELAY_MS, 600);
  assert.equal(AI_RUN_GAP_MS, 12 * H);
  assert.equal(AI_NOTICE, "You're chatting with our AI assistant outside business hours. A team member will follow up if needed.");
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
