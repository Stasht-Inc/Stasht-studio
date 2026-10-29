// Chris, 29 Oct (round 2), item 8: Lists add / edit person Mobile with the Studio country-code picker, saved E.164.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEMBER_DIAL_CODE, MEMBER_PHONE_INCOMPLETE, memberPhoneParts, memberPhoneProblem, memberPhoneValue } from '../../components/leads/lists/memberPhone.ts';

test('starts on +1 like the other Studio phone fields; a stored number splits into code and number', () => {
  assert.equal(MEMBER_DIAL_CODE, '+1');
  assert.deepEqual(memberPhoneParts(null), { countryCode: '+1', number: '' });
  assert.deepEqual(memberPhoneParts('+14165550177'), { countryCode: '+1', number: '4165550177' });
  assert.deepEqual(memberPhoneParts('+447911123456'), { countryCode: '+44', number: '7911123456' });
  assert.deepEqual(memberPhoneParts('4165550177'), { countryCode: '+1', number: '4165550177' });
});

test('saves E.164', () => {
  assert.equal(memberPhoneValue('+1', '(416) 555-0177'), '+14165550177');
  assert.equal(memberPhoneValue('+1', '1 416 555 0177'), '+14165550177', 'a typed leading 1 is not doubled');
  assert.equal(memberPhoneValue('+44', '07911 123456'), '+447911123456', 'the trunk 0 is dropped');
  assert.equal(memberPhoneValue('+91', '+1 416 555 0177'), '+14165550177', 'a pasted +1 number uses its own code');
  assert.equal(memberPhoneValue('+1', '  '), '');
});

test('only incomplete numbers are stopped here; other countries go to the API', () => {
  assert.equal(memberPhoneProblem('+1', ''), null);
  assert.equal(memberPhoneProblem('+1', '416 555 017'), MEMBER_PHONE_INCOMPLETE);
  assert.equal(memberPhoneProblem('+1', '416 555 0177'), null);
  assert.equal(memberPhoneProblem('+44', '7911 123456'), null, 'a UK mobile is not blocked in Studio');
  assert.equal(memberPhoneProblem('+44', '79'), MEMBER_PHONE_INCOMPLETE);
});
