// Chris, 4 Nov 2026, point 9, step 3 Send: the campaign as tracked Storeels to a newsletter-style audience
// (POST /memories/{id}/storeel-audience-count and /storeel-send). The text each person gets is counted in parts the
// way the web API counts it (StoreelBroadcastText: first-text intro with a long first name, the message, the tracked
// link, the YES/NO question, the reply line), with the newsletter text rules (smsParts.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STOREEL_WORST_NAME, storeelSmsText, storeelSmsParts, storeelSmsPreview, storeelQuestion, senderLabelFor,
} from '../../components/storeel/lib/storeelSms.ts';
import {
  NOT_AVAILABLE_ERROR, countFromResponse, sendFailure, sendProblem, sentMessage,
} from '../../components/storeel/lib/storeelSend.ts';
import { smsSegments, MAX_SMS_PARTS, SMS_BODY_MAX } from '../../components/newsletters/lib/smsParts.ts';

const BASE = 'https://restapi.stasht.com';

test('the text as the API builds it: intro, message, tracked link, YES/NO question, reply line', () => {
  const text = storeelSmsText({ sender: 'Samantha Smith, Serpa Chrysler', message: '  Come see our spring open house.  ', slug: 'spring-open-house', isCar: false, viewOnly: false });
  assert.equal(text, [
    `Hi ${STOREEL_WORST_NAME},`,
    'This message came from Samantha Smith, Serpa Chrysler.',
    '',
    'Come see our spring open house.',
    '',
    `${BASE}/share/memory/spring-open-house?s=${'x'.repeat(22)}`,
    '',
    'Want to see more like this? Reply YES. Reply NO to stop.',
    '',
    'Reply to this message to respond directly. Reply STOP to unsubscribe.',
  ].join('\n'));
  assert.equal(STOREEL_WORST_NAME.length, 30, 'StoreelBroadcastText::WORST_NAME');
});

test('car campaigns keep the vehicles question; a view-only campaign link keeps ?viewonly=1', () => {
  assert.equal(storeelQuestion(true), 'Want to see more vehicles like this? Reply YES. Reply NO to stop.');
  assert.equal(storeelQuestion(false), 'Want to see more like this? Reply YES. Reply NO to stop.');
  const text = storeelSmsText({ sender: 'Sam', message: 'Hi', slug: 'jeep', isCar: true, viewOnly: true });
  assert.ok(text.includes(`${BASE}/share/memory/jeep?viewonly=1&s=${'x'.repeat(22)}`));
  assert.ok(text.includes('more vehicles like this'));
  // Not saved yet or no slug: a stand-in of a typical length.
  assert.ok(storeelSmsText({ sender: 'Sam', message: 'Hi', slug: null, isCar: false, viewOnly: false }).includes(`${BASE}/share/memory/`));
});

test('who the text says it came from: the sender, and the business in its property view (StoreelSendService::senderLabel)', () => {
  assert.equal(senderLabelFor('Samantha Smith', null), 'Samantha Smith');
  assert.equal(senderLabelFor('Samantha Smith', 'Serpa Chrysler'), 'Samantha Smith, Serpa Chrysler');
  assert.equal(senderLabelFor('  ', null), 'Someone');
});

test('parts are counted on the whole text, with the API words when it is too long', () => {
  const short = storeelSmsParts({ sender: 'Sam', message: 'Come see us.', slug: 'abc', isCar: false, viewOnly: false });
  assert.equal(short.parts, smsSegments(storeelSmsText({ sender: 'Sam', message: 'Come see us.', slug: 'abc', isCar: false, viewOnly: false })).segments);
  assert.equal(short.parts, 2, 'the intro, link, question and reply line already take more than one text');
  assert.equal(short.tooLong, false);
  assert.equal(short.problem, null);

  const many = storeelSmsParts({ sender: 'Sam', message: 'x'.repeat(1300), slug: 'abc', isCar: false, viewOnly: false });
  assert.ok(many.parts > MAX_SMS_PARTS);
  assert.equal(many.problem, `This text would go out as ${many.parts} text messages, more than the ${MAX_SMS_PARTS} allowed. Shorten your message or remove emoji.`);

  // Emoji: 70 per part, and the 1,600 limit says the API's words when the parts still fit.
  const emoji = storeelSmsParts({ sender: 'Sam', message: '🎉 Big sale', slug: 'abc', isCar: false, viewOnly: false });
  assert.equal(emoji.unicode, true);
  const long = storeelSmsParts({ sender: 'Sam', message: 'y'.repeat(1500), slug: 'abc', isCar: false, viewOnly: false }, null);
  assert.ok(long.length > SMS_BODY_MAX);
  assert.equal(long.problem, `This text is too long to send as a text message (${long.length.toLocaleString('en-US')} of 1,600 characters, with your name, the link and the reply line). Shorten it, or untick Text message.`);
});

test('what text recipients get, in one line', () => {
  assert.equal(storeelSmsPreview('Sam, Serpa', ' Come see us. ', false),
    'Hi (their first name), this message came from Sam, Serpa. Come see us. (link to your campaign) Want to see more like this? Reply YES. Reply NO to stop. Reply STOP to unsubscribe.');
  assert.ok(storeelSmsPreview('Sam', '', true).includes('Your message (link to your campaign) Want to see more vehicles'));
});

const ZERO = { email: 0, sms: 0, skipped: { no_email: 0, no_phone: 0, unsubscribed: 0, duplicate: 0 } };

test('Send now checks: who, how, the message, the text, nobody reachable, the per-send cap', () => {
  const base = { audience: [{ type: 'list', id: 7 }], channels: ['email'], message: 'Hi', counts: { ...ZERO, email: 3 }, smsProblem: null, limit: null };
  assert.equal(sendProblem(base), null);
  assert.equal(sendProblem({ ...base, audience: [] }), 'Choose who gets this Storeel.');
  assert.equal(sendProblem({ ...base, channels: [] }), 'Choose email, text or both.');
  assert.equal(sendProblem({ ...base, message: '  ' }), 'Write the message people will get with your campaign.');
  assert.equal(sendProblem({ ...base, channels: ['sms'], counts: { ...ZERO, sms: 2 }, smsProblem: 'Too long.' }), 'Too long.');
  assert.equal(sendProblem({ ...base, counts: ZERO }), 'Nobody here can get this Storeel yet.');
  assert.equal(sendProblem({ ...base, limit: { max_messages: 1000, needed: 1200, over_limit: true } }),
    'This Storeel would go out as 1,200 messages, more than the 1,000 one send can make. Send it to fewer people at a time.');
  assert.equal(sendProblem({ ...base, audience: [{ type: 'person', email: 'jordan@example' }] }), 'Enter an email address like name@example.com.');
  assert.equal(sendProblem({ ...base, counts: null }), null, 'still counting: the API decides');
});

test('the count answer: the newsletter counts, the Storeel cap, and the allowance when the API sends it', () => {
  const body = {
    success: true,
    data: { email: 120, sms: 40, skipped: { no_email: 3, no_phone: 80, unsubscribed: 2, duplicate: 5 } },
    storeel: { max_messages: 1000, needed: 160, over_limit: false, sms: null },
    allowance: { plan: 'Professional', email_limit: 5000, sms_limit: 500, email_used: 10, sms_used: 0, resets_at: '2026-12-01T05:00:00Z' },
  };
  // apiRequest wraps the server body once more: {success, data: body}.
  const r = countFromResponse({ success: true, data: body });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.counts, body.data);
  assert.deepEqual(r.data.limit, { max_messages: 1000, needed: 160, over_limit: false });
  assert.equal(r.data.allowance.email_limit, 5000);
  const nested = countFromResponse({ success: true, data: { ...body, allowance: undefined, storeel: { ...body.storeel, allowance: body.allowance } } });
  assert.equal(nested.data.allowance.sms_limit, 500, 'or inside storeel');
  assert.equal(countFromResponse({ success: true, data: { success: true, data: body.data } }).data.allowance, null);
  const unavailable = countFromResponse({ success: false, code: 'not_available', statusCode: 503, message: 'Sending Storeels to lists is not available yet.' });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.error, NOT_AVAILABLE_ERROR);
  assert.equal(unavailable.unavailable, true);
  const forbidden = countFromResponse({ success: false, statusCode: 403, message: 'You can’t send this campaign.' });
  assert.equal(forbidden.forbidden, true);
});

test('a refused send says why, under the field when the API names one', () => {
  assert.deepEqual(sendFailure({ ok: false, status: 503, code: 'not_available', error: 'x', fieldErrors: {} }), { message: NOT_AVAILABLE_ERROR, fieldErrors: {}, unavailable: true });
  assert.match(NOT_AVAILABLE_ERROR, /isn.t available yet/);
  assert.deepEqual(sendFailure({ ok: false, status: 503, code: 'storeels_paused', error: 'Sending Storeels is paused right now. Please try again later.', fieldErrors: {} }),
    { message: 'Sending Storeels is paused right now. Please try again later.', fieldErrors: {} });
  const field = sendFailure({ ok: false, status: 422, error: 'Keep it short.', fieldErrors: { message: 'Keep it short.' } });
  assert.deepEqual(field, { message: 'Keep it short.', fieldErrors: { message: 'Keep it short.' } });
  const person = sendFailure({ ok: false, status: 422, error: 'unsub', fieldErrors: { 'audience.0.email': 'unsub', audience: 'unsub' } });
  assert.equal(person.fieldErrors['audience.0.email'], 'unsub');
  const limit = sendFailure({ ok: false, status: 422, code: 'storeel_limit', error: 'This Storeel would go out as 1,200 messages, more than the 1,000 one send can make.', fieldErrors: { audience: 'This Storeel would go out as 1,200 messages, more than the 1,000 one send can make.' } });
  assert.equal(limit.message, 'This Storeel would go out as 1,200 messages, more than the 1,000 one send can make.');
  const allowance = sendFailure({ ok: false, status: 422, error: 'This needs 10 emails, but your plan has 0 left this month.', fieldErrors: { allowance: 'This needs 10 emails, but your plan has 0 left this month.' } });
  assert.equal(allowance.allowance, 'This needs 10 emails, but your plan has 0 left this month.');
  assert.equal(sendFailure({ ok: false, status: 409, code: 'busy', error: 'Someone else is adding this person.', fieldErrors: {}, conflict: true }).message, 'Someone else is adding this person.');
  assert.equal(sendFailure({ ok: false, status: 429, rateLimited: true, error: 'Too many requests. Wait a minute and try again.', fieldErrors: {} }).message, 'Too many requests. Wait a minute and try again.');
  assert.equal(sendFailure({ ok: false, status: 403, error: 'You can’t send this campaign.', fieldErrors: {} }).forbidden, true);
  // The newsletter sending gate (review fixes 8.1): the API's own words, not the newsletter draft's.
  assert.equal(sendFailure({ ok: false, status: 503, code: 'newsletters_paused', paused: 'all', error: 'Newsletters are paused right now. Your draft is saved. Try again later.', fieldErrors: {} }).message,
    'Sending is paused right now. Try again later.');
  assert.equal(sendFailure({ ok: false, status: 409, code: 'newsletters_account_paused', paused: 'account', conflict: false, error: 'x', fieldErrors: {} }).message,
    'Sending is paused for your account. Contact Stasht support to turn it back on.');
});

const sent = (over = {}) => ({
  broadcast_id: 'u-1', memory_id: 3021, status: 'sent', channels: ['email', 'sms'], subject: 'Spring', replayed: false, published_now: false, texts_wait_until: null,
  counts: { recipients: 3, sent: 3, queued: 0, failed: 0, email: { sent: 2, queued: 0, failed: 0 }, sms: { sent: 1, queued: 0, failed: 0 }, skipped: { total: 1 } },
  ...over,
});

test('the toast after Send now: what went, what is still going, held texts, a campaign just published', () => {
  assert.equal(sentMessage(sent()), 'Sent: 2 emails and 1 text.');
  assert.equal(sentMessage(sent({ channels: ['email'], counts: { ...sent().counts, recipients: 1, sent: 1, email: { sent: 1, queued: 0, failed: 0 }, sms: { sent: 0, queued: 0, failed: 0 } } })), 'Sent: 1 email.');
  assert.equal(sentMessage(sent({ status: 'sending', counts: { ...sent().counts, recipients: 160, sent: 20, queued: 140, email: { sent: 20, queued: 100, failed: 0 }, sms: { sent: 0, queued: 40, failed: 0 } } })),
    'Sending 120 emails and 40 texts. It can take a few minutes.');
  assert.equal(sentMessage(sent({ counts: { ...sent().counts, sent: 2, failed: 1, sms: { sent: 0, queued: 0, failed: 1 } } })), "Sent: 2 emails. 1 couldn't be sent.");
  const held = sentMessage(sent({ status: 'sending', texts_wait_until: '2026-11-05T13:00:00Z', counts: { ...sent().counts, sent: 2, queued: 1, sms: { sent: 0, queued: 1, failed: 0 } } }), 'en-US', 'America/Toronto');
  assert.equal(held, 'Sent: 2 emails. Texts go out at 8:00 AM (quiet hours).');
  // Chris 9 Nov 2026 (point 6, review M2/M3): the mode the API says it went out in; none named when it doesn't say.
  assert.equal(sentMessage(sent({ published_now: true })), 'Sent: 2 emails and 1 text. Your campaign is now published.');
  assert.equal(sentMessage(sent({ published_now: true, published: 1 })), 'Sent: 2 emails and 1 text. Your campaign is now published (Public).');
  assert.equal(sentMessage(sent({ published_now: true, published: 2 })), 'Sent: 2 emails and 1 text. Your campaign is now published (View Only).');
  // A published campaign whose mode the send changed:
  assert.equal(sentMessage(sent({ publish_switched: true, published: 1 })), 'Sent: 2 emails and 1 text. Your campaign is now Public.');
  assert.equal(sentMessage(sent({ publish_switched: true, published: 2 })), 'Sent: 2 emails and 1 text. Your campaign is now View Only.');
  assert.equal(sentMessage(sent({ publish_switched: false, published: 2 })), 'Sent: 2 emails and 1 text.');
});
