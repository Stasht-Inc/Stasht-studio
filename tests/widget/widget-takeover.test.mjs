// tests/widget/widget-takeover.test.mjs — team faces with the assistant, and a rep taking over (ClickUp wdy2xh2upu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../public/widget-core.js';
import {
  chatMessageFrom, repJoinedBefore, aiNoticeBefore, hasUnreadTeamMessage, autoReplyAnchor, AI_RUN_GAP_MS,
  TAKEOVER_EVENTS, STACK_PEOPLE_MAX, ONLINE_NOW, REPLY_SOON, assistantFrom, handlingRep, teamStack, headerTitle,
  headerStatusText, teaserOnlineText, stackPeopleMax, teamOnlineFrom,
} from '../../public/widget-core.js';

const H = 60 * 60 * 1000;
const at = (hours) => new Date(Date.UTC(2026, 9, 29, 0, 0, 0) + hours * H);
const person = (name, avatarUrl = null) => ({ name, avatarUrl, initials: name[0], color: '#6C60FF' });
const visitor = (id, hours) => ({ id, from: 'visitor', sentAt: at(hours), isAi: false, autoReply: false, event: null });
const ai = (id, hours) => ({ id, from: 'team', sentAt: at(hours), isAi: true, autoReply: false, event: null });
const rep = (id, hours, name = 'Chris') => ({ id, from: 'team', sentAt: at(hours), isAi: false, autoReply: false, sender: person(name), event: null });
const takeover = (id, hours, name = 'Chris') => ({ ...rep(id, hours, name), event: 'takeover' });
const handback = (id, hours, name = 'Chris') => ({ ...rep(id, hours, name), event: 'handback' });
const CHIP = 'https://cdn.example.com/chip.png';

test('the new helpers are exported for the embed (read through `import * as core`)', () => {
  for (const name of ['assistantFrom', 'handlingRep', 'teamStack', 'headerTitle', 'headerStatusText', 'teaserOnlineText', 'stackPeopleMax']) {
    assert.equal(typeof core[name], 'function', name);
  }
  assert.deepEqual(TAKEOVER_EVENTS, ['takeover', 'handback']);
  assert.equal(STACK_PEOPLE_MAX, 4);
  assert.equal(ONLINE_NOW, 'Online now');
  assert.equal(REPLY_SOON, "We'll reply soon");
});

test('chatMessageFrom keeps takeover and hand-back events, with their empty body, on team rows only', () => {
  const sender = { name: 'Chris', avatar_url: 'https://cdn.example.com/chris.jpg', initials: 'CB', color: '#10B981' };
  const ev = chatMessageFrom({ id: 9, from: 'team', body: '', sender, is_ai: false, event: 'takeover', sent_at: '2026-10-29T10:00:00+05:30' });
  assert.equal(ev.event, 'takeover');
  assert.equal(ev.body, '');
  assert.equal(ev.sender.name, 'Chris');
  assert.equal(chatMessageFrom({ id: 10, from: 'team', body: '', sender, event: 'handback' }).event, 'handback');

  assert.equal(chatMessageFrom({ id: 11, from: 'team', body: '', sender, event: 'something-else' }), null, 'unknown events stay dropped');
  assert.equal(chatMessageFrom({ id: 12, from: 'visitor', body: '', event: 'takeover' }), null, 'never on a visitor row');
  assert.equal(chatMessageFrom({ id: 13, from: 'team', body: 'Hi', sender }).event, null, 'ordinary messages have none');
  assert.equal(chatMessageFrom({ id: 14, from: 'team', body: 'Hi', sender, event: 'bogus' }).event, null);
});

test('repJoinedBefore: a takeover gets the joined line once, in its own place', () => {
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), takeover(3, 0.1)])], [3], 'no message needed');
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), takeover(3, 0.1), visitor(4, 0.2), rep(5, 0.3)])], [3],
    "the rep's first message after taking over doesn't repeat it");
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), takeover(2, 0)])], [2], 'even before the AI said anything');
});

test('repJoinedBefore: after a hand back the AI answers and the next person joins again', () => {
  const list = [visitor(1, 0), ai(2, 0), takeover(3, 0.1), rep(4, 0.2), handback(5, 0.3), visitor(6, 0.4), ai(7, 0.4), visitor(8, 0.5), rep(9, 0.6)];
  assert.deepEqual([...repJoinedBefore(list)], [3, 9]);
  assert.deepEqual([...repJoinedBefore([visitor(1, 0), ai(2, 0), rep(3, 0.1), handback(4, 0.2), rep(5, 0.3)])], [3],
    'handed back and replied before the AI did: still the same person, no second line');
});

test('aiNoticeBefore: the AI reply after a hand back starts a new run with the notice', () => {
  const list = [visitor(1, 0), ai(2, 0), takeover(3, 0.1), handback(4, 0.2), visitor(5, 0.3), ai(6, 0.3)];
  assert.deepEqual([...aiNoticeBefore(list)], [2, 6]);
});

test('events never light the unread dot nor move the automatic reply', () => {
  assert.equal(hasUnreadTeamMessage([visitor(1, 0), takeover(2, 1)], at(0.5).getTime()), false);
  assert.equal(hasUnreadTeamMessage([visitor(1, 0), takeover(2, 1), rep(3, 1)], at(0.5).getTime()), true);
  assert.equal(autoReplyAnchor([visitor(1, 0), ai(2, 0), takeover(3, 1)]), null, 'the AI answered: no static reply');
});

test('handlingRep follows the server rule: latest person event in 12 h, ended by a hand back or the AI', () => {
  const now = at(1).getTime();
  assert.equal(handlingRep([visitor(1, 0), ai(2, 0)], now), null, 'the AI is answering');
  assert.equal(handlingRep([visitor(1, 0), ai(2, 0), takeover(3, 0.5)], now).name, 'Chris');
  assert.equal(handlingRep([visitor(1, 0), ai(2, 0), rep(3, 0.5, 'Sam')], now).name, 'Sam', 'a reply takes over too');
  assert.equal(handlingRep([ai(2, 0), takeover(3, 0.2), handback(4, 0.5)], now), null);
  assert.equal(handlingRep([takeover(3, 0.2), handback(4, 0.5), rep(5, 0.6, 'Sam')], now).name, 'Sam', 'a reply after a hand back');
  assert.equal(handlingRep([rep(3, 0, 'Sam'), takeover(4, 0.2, 'Chris')], now).name, 'Chris', 'the latest person');
  assert.equal(handlingRep([takeover(3, 0)], at(0).getTime() + AI_RUN_GAP_MS), null, '12 h later the AI is back');
  assert.equal(handlingRep([{ ...takeover(3, 0), sentAt: null }], now).name, 'Chris', 'unknown time counts as recent');
  assert.equal(handlingRep([rep(3, 0), visitor(4, 0.5)], now).name, 'Chris', 'visitor messages change nothing');
  assert.equal(handlingRep(null, now), null);
});

test('assistantFrom: the agent name and picture, only when the assistant is online', () => {
  assert.deepEqual(assistantFrom({ assistant_online: true, agent_name: ' Chip (AI Assistant) ', theme: { logo_url: CHIP } }),
    { name: 'Chip (AI Assistant)', avatarUrl: CHIP });
  assert.deepEqual(assistantFrom({ assistant_online: true, theme: { logo_url: 'http://insecure.example/x.png' } }),
    { name: 'AI assistant', avatarUrl: null });
  assert.equal(assistantFrom({ assistant_online: false, agent_name: 'Chip' }), null);
  assert.equal(assistantFrom({ agent_name: 'Chip' }), null, 'an API that predates it: no assistant face');
  assert.equal(assistantFrom(null), null);
});

test('teamStack: the handler in front, the team once each, at most 4 people, the assistant last', () => {
  const chip = { name: 'Chip', avatarUrl: CHIP };
  const [chris, sam, alex, jo, kim] = ['Chris', 'Sam', 'Alex', 'Jo', 'Kim'].map((n) => person(n));

  assert.deepEqual(teamStack({ team: [chris], assistant: chip }), [{ person: chris }, { assistant: chip }], '1 rep + Chip');
  assert.deepEqual(teamStack({ team: [chris, sam, alex], assistant: chip }).map((f) => f.person?.name ?? 'assistant'),
    ['Chris', 'Sam', 'Alex', 'assistant'], '3 reps + Chip');
  assert.deepEqual(teamStack({ team: [], assistant: chip }), [{ assistant: chip }], 'nobody online: Chip alone');
  assert.deepEqual(teamStack({ team: [chris] }), [{ person: chris }], 'AI off: people only');
  assert.deepEqual(teamStack({ team: [] }), [], 'nobody and no AI: nothing to stack');

  assert.deepEqual(teamStack({ team: [chris, sam], handler: sam, assistant: chip }).map((f) => f.person?.name ?? 'assistant'),
    ['Sam', 'Chris', 'assistant'], 'the rep who took over moves to the front');
  assert.deepEqual(teamStack({ team: [chris], handler: alex, assistant: chip }).map((f) => f.person?.name ?? 'assistant'),
    ['Alex', 'Chris', 'assistant'], 'shown even when not in the online list');
  assert.deepEqual(teamStack({ team: [chris, sam, alex, jo, kim], assistant: chip }).map((f) => f.person?.name ?? 'assistant'),
    ['Chris', 'Sam', 'Alex', 'Jo', 'assistant'], 'four people, then the assistant');
  assert.equal(teamStack({ team: [chris, sam, alex], assistant: chip, max: 2 }).length, 3, 'a narrow panel: two people + the assistant');
  assert.deepEqual(teamStack(), []);
});

test('teamStack works on the config straight from the API', () => {
  const config = {
    assistant_online: true, agent_name: 'Chip (AI Assistant)', theme: { logo_url: CHIP },
    team_online: [{ name: 'Chris', avatar_url: 'https://cdn.example.com/chris.jpg', initials: 'CB', color: '#10B981' }],
  };
  const faces = teamStack({ team: teamOnlineFrom(config), assistant: assistantFrom(config) });
  assert.equal(faces[0].person.avatarUrl, 'https://cdn.example.com/chris.jpg');
  assert.equal(faces[1].assistant.avatarUrl, CHIP);
});

test('header title and status, and the teaser line', () => {
  assert.equal(headerTitle({ business_name: 'Stasht Support', agent_name: 'Chip (AI Assistant)' }), 'Stasht Support');
  assert.equal(headerTitle({ business_name: '  ', agent_name: 'Riley' }), 'Riley');
  assert.equal(headerTitle({}), 'Chat with us');

  const chip = { name: 'Chip', avatarUrl: null };
  assert.equal(headerStatusText([person('Chris')], null), 'Online now');
  assert.equal(headerStatusText([], chip), 'Online now', 'the assistant always answers');
  assert.equal(headerStatusText([], null), "We'll reply soon");

  assert.equal(teaserOnlineText([person('Chris')], chip), '1 online', 'people are counted, not the assistant');
  assert.equal(teaserOnlineText([person('Chris'), person('Sam'), person('Alex')], chip), '3 online');
  assert.equal(teaserOnlineText([], chip), 'Online now');
  assert.equal(teaserOnlineText([], null), '');
});

test('stackPeopleMax: two people on a phone-width panel, else four', () => {
  assert.equal(stackPeopleMax(420), 4);
  assert.equal(stackPeopleMax(360), 4);
  assert.equal(stackPeopleMax(300), 2);
  assert.equal(stackPeopleMax(undefined), 4);
});
