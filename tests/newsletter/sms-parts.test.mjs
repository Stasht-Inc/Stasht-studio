// [wdy2xh2p3f] SMS parts, ported from app/Services/Newsletter/NewsletterSms.php; the cases are
// tests/Unit/Newsletter/NewsletterSmsTest.php's, so Studio counts exactly what the API counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsSegments, finalSmsText, smsPartsInfo, smsPartsLabel, MAX_SMS_PARTS, SMS_BODY_MAX, SMS_LINK_STAND_IN } from '../../components/newsletters/lib/smsParts.ts';

const r = (s) => s.repeat.bind(s);

test('plain text is GSM-7 with 160 characters in one part and 153 after', () => {
  assert.deepEqual(smsSegments('Hello'), { encoding: 'GSM-7', segments: 1, units: 5 });
  assert.equal(smsSegments(r('a')(160)).segments, 1);
  assert.equal(smsSegments(r('a')(161)).segments, 2);
  assert.equal(smsSegments(r('a')(306)).segments, 2);
  assert.equal(smsSegments(r('a')(307)).segments, 3);
  assert.equal(smsSegments('').segments, 0);
});

test('extension characters take two places', () => {
  const x = smsSegments('Price: 20€ [today]');
  assert.deepEqual([x.encoding, x.units], ['GSM-7', 21]);
  assert.equal(smsSegments(r('€')(81)).segments, 2); // 162 places
});

test('emoji or other characters switch to UCS-2 with 70 then 67 per part', () => {
  const x = smsSegments('Sale 😀');
  assert.deepEqual([x.encoding, x.units, x.segments], ['UCS-2', 7, 1]); // the emoji is 2 UTF-16 units
  assert.equal(smsSegments(r('a')(70) + 'ą').segments, 2);
  assert.equal(smsSegments(r('ą')(135)).segments, 3);
});

test('an escape pair never splits across parts', () => {
  const text = r('a')(152) + '€' + r('a')(151) + '€' + r('a')(152);
  const x = smsSegments(text);
  assert.deepEqual([x.encoding, x.units], ['GSM-7', 459]);
  assert.equal(x.segments, 4);
  assert.equal(smsSegments(r('a')(152) + '€' + r('a')(151) + '€' + r('a')(151)).segments, 3);
  assert.equal(smsSegments(r('a')(158) + '€').segments, 1);
});

test('an emoji never splits across parts', () => {
  const text = r('ą')(66) + '😀' + r('ą')(66); // 134 UTF-16 units = 2 x 67 on paper
  const x = smsSegments(text);
  assert.deepEqual([x.encoding, x.units], ['UCS-2', 134]);
  assert.equal(x.segments, 3);
  assert.equal(smsSegments(r('ą')(67) + '😀' + r('ą')(65)).segments, 2);
});

test('the final text is the business name, the text, the link and the STOP line (NewsletterRenderer::sms)', () => {
  assert.equal(SMS_LINK_STAND_IN, `https://restapi.stasht.com/n/r/${'x'.repeat(32)}`);
  assert.equal(finalSmsText('Serpa Chrysler', 'October deals are here.'), `Serpa Chrysler: October deals are here.\n${SMS_LINK_STAND_IN}\nReply STOP to opt out.`);
  // From name: plain punctuation, at most 25 characters, trailing space dropped; none → no prefix.
  assert.equal(finalSmsText('Serpa Chrysler Jeep Dodge Ram of Toronto', 'Hi').split(':')[0], 'Serpa Chrysler Jeep Dodge');
  assert.equal(finalSmsText('  ', '  Hi “there”…  ').split('\n')[0], 'Hi "there"...');
});

test('parts per person and the emoji warning; a long text goes out as one long text (Chris, 3 Nov)', () => {
  const short = smsPartsInfo('Serpa Chrysler', 'October deals are here.');
  assert.deepEqual([short.parts, short.unicode, short.tooLong], [1, false, false]);
  const long = smsPartsInfo('Serpa Chrysler', r('a')(120));
  assert.equal(long.parts, 2);
  const emoji = smsPartsInfo('Serpa Chrysler', 'Sale 😀');
  assert.deepEqual([emoji.parts, emoji.unicode], [2, true]); // 16 + 7 + 64 + 23 = 110 units > 70
  // 120 "ą" used to be refused (4 parts > 3): now it simply goes out as 4 texts.
  const four = smsPartsInfo('Serpa Chrysler', r('ą')(120));
  assert.deepEqual([four.parts, four.tooLong, four.problem], [4, false, null]);
  // 700 GSM-7 characters: 16 + 700 + 1 + 63 + 1 + 22 = 803 → 6 parts of 153.
  const six = smsPartsInfo('Serpa Chrysler', r('a')(700));
  assert.deepEqual([six.parts, six.length, six.tooLong], [6, 803, false]);
  assert.equal(short.problem, null);
});

// Review (3 Nov): at most 10 parts (the API's newsletters.sms.max_segments default), in the API's words.
test('at most 10 parts: 11 is refused, in the API\'s words', () => {
  assert.equal(MAX_SMS_PARTS, 10);
  const ten = smsPartsInfo('Serpa Chrysler', r('a')(1427)); // 16 + 1,427 + 87 = 1,530 = 10 x 153
  assert.deepEqual([ten.parts, ten.tooLong, ten.problem], [10, false, null]);
  const eleven = smsPartsInfo('Serpa Chrysler', r('a')(1428));
  assert.deepEqual([eleven.parts, eleven.tooLong], [11, true]);
  assert.equal(eleven.problem, 'This text would go out as 11 text messages, more than the 10 allowed. Shorten it or remove emoji.');
  // Emoji: 67 a part, so far fewer characters fit.
  const emoji = smsPartsInfo('Serpa Chrysler', 'Sale 😀 '.repeat(90));
  assert.equal(emoji.tooLong, true);
  assert.match(emoji.problem, /^This text would go out as \d+ text messages, more than the 10 allowed\. Shorten it or remove emoji\.$/);
});

test('with no part limit, Twilio\'s 1,600 characters as sent is still refused, in the API\'s words', () => {
  assert.equal(SMS_BODY_MAX, 1600);
  const fits = smsPartsInfo('Serpa Chrysler', r('a')(1497), null); // 16 + 1,497 + 87 = 1,600
  assert.deepEqual([fits.length, fits.tooLong, fits.problem], [1600, false, null]);
  const over = smsPartsInfo('Serpa Chrysler', r('a')(1498), null);
  assert.equal(over.tooLong, true);
  assert.equal(over.problem, 'This text is too long to send as a text message (1,601 of 1,600 characters, with your name, the link and "Reply STOP to opt out."). Shorten it, or untick Text message.');
  // An emoji counts two (UTF-16), as the API counts it.
  assert.equal(smsPartsInfo('Serpa Chrysler', `${r('a')(1496)}😀`, null).tooLong, true);
  // The part limit comes first when both apply (as NewsletterSendCheck::smsTooLong).
  assert.match(smsPartsInfo('Serpa Chrysler', r('a')(1498)).problem, /^This text would go out as 11 text messages/);
});

test('the hint says how many texts it is sent as, and the most', () => {
  assert.equal(smsPartsLabel(1), 'Sent as 1 text message (max 10).');
  assert.equal(smsPartsLabel(3), 'Sent as 3 text messages (max 10).');
});
