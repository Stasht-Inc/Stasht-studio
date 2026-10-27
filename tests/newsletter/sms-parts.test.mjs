// [wdy2xh2p3f] SMS parts, ported from app/Services/Newsletter/NewsletterSms.php; the cases are
// tests/Unit/Newsletter/NewsletterSmsTest.php's, so Studio counts exactly what the API counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsSegments, finalSmsText, smsPartsInfo, MAX_SMS_PARTS, SMS_LINK_STAND_IN } from '../../components/newsletters/lib/smsParts.ts';

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

test('parts per person, the emoji warning and the 3-part limit', () => {
  assert.equal(MAX_SMS_PARTS, 3);
  const short = smsPartsInfo('Serpa Chrysler', 'October deals are here.');
  assert.deepEqual([short.parts, short.unicode, short.tooLong], [1, false, false]);
  const long = smsPartsInfo('Serpa Chrysler', r('a')(120));
  assert.equal(long.parts, 2);
  const emoji = smsPartsInfo('Serpa Chrysler', 'Sale 😀');
  assert.deepEqual([emoji.parts, emoji.unicode], [2, true]); // 16 + 7 + 64 + 23 = 110 units > 70
  const tooLong = smsPartsInfo('Serpa Chrysler', r('ą')(120));
  assert.equal(tooLong.tooLong, true);
  assert.equal(tooLong.problem, `This text is too long once sent (${tooLong.parts} parts). Shorten it or remove emoji.`);
  assert.equal(short.problem, null);
});
