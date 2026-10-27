import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSentTo } from '../../components/newsletters/lib/phoneDisplay.ts';

test('formatSentTo groups North American numbers as +1 416 555 0100', () => {
  assert.equal(formatSentTo('+14165550100'), '+1 416 555 0100');
  assert.equal(formatSentTo(' +1 (416) 555-0100 '), '+1 416 555 0100');
});

test('formatSentTo splits the country code from other supported numbers', () => {
  assert.equal(formatSentTo('+447911123456'), '+44 7911123456');
  assert.equal(formatSentTo('+919876543210'), '+91 9876543210');
});

test('formatSentTo leaves unknown codes, odd lengths and emails as they are', () => {
  assert.equal(formatSentTo('+79123456789'), '+79123456789');
  assert.equal(formatSentTo('+1416555010'), '+1416555010');
  assert.equal(formatSentTo('samantha@serpachrysler.ca'), 'samantha@serpachrysler.ca');
  assert.equal(formatSentTo('Sam+1@x.co'), 'Sam+1@x.co');
  assert.equal(formatSentTo(''), '');
});
