// tests/utils/phoneUtils.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhonePrefill, splitPrefillPhone, splitTypedPhone, toE164, isPlausibleSplitPhone, isValidCollaboratorPhone, collaboratorPhoneValue } from '../../utils/phoneUtils.ts';

test('parsePhonePrefill splits stored numbers for a split field', () => {
  assert.deepEqual(parsePhonePrefill('+12892211807'), { countryCode: '+1', number: '2892211807' });
  assert.deepEqual(parsePhonePrefill('12892211807'), { countryCode: '+1', number: '2892211807' });
  assert.deepEqual(parsePhonePrefill('+44 7911 123456'), { countryCode: '+44', number: '7911123456' });
  assert.deepEqual(parsePhonePrefill(''), { countryCode: null, number: '' });
});

test('splitTypedPhone moves a pasted country code into the selector', () => {
  assert.deepEqual(splitTypedPhone('+1', '+12892211807'), { countryCode: '+1', number: '2892211807' });
  assert.deepEqual(splitTypedPhone('+1', '+44 7911 123456'), { countryCode: '+44', number: '7911123456' });
  assert.deepEqual(splitTypedPhone('+44', '+1 (289) 221-1807'), { countryCode: '+1', number: '2892211807' });
});

test('splitTypedPhone leaves everything else alone', () => {
  assert.deepEqual(splitTypedPhone('+1', '(289) 221-1807'), { countryCode: '+1', number: '(289) 221-1807' });
  assert.deepEqual(splitTypedPhone('+1', ''), { countryCode: '+1', number: '' });
  // Still typing the code: nothing after it yet, so the box is not cleared.
  assert.deepEqual(splitTypedPhone('+1', '+'), { countryCode: '+1', number: '+' });
  assert.deepEqual(splitTypedPhone('+1', '+44'), { countryCode: '+1', number: '+44' });
  // A code the selector does not offer stays in the box.
  assert.deepEqual(splitTypedPhone('+1', '+7 912 345 6789'), { countryCode: '+1', number: '+7 912 345 6789' });
});

test('toE164 joins the code and digits only', () => {
  assert.equal(toE164('+1', '2892211807'), '+12892211807');
  assert.equal(toE164('+1', '(289) 221-1807'), '+12892211807');
  assert.equal(toE164('+1', '289.221.1807'), '+12892211807');
  assert.equal(toE164('+91', '98765 43210'), '+919876543210');
  assert.equal(toE164('+1', ''), '');
  assert.equal(toE164('+1', ' - ( ) '), '');
});

test('toE164 does not double a prefix', () => {
  assert.equal(toE164('+1', '1 289 221 1807'), '+12892211807');
  assert.equal(toE164('+1', '+12892211807'), '+12892211807');
  assert.equal(toE164('+44', '07911 123456'), '+447911123456');
  assert.equal(toE164('+1', '+7 912 345 6789'), '+79123456789');
});

test('isPlausibleSplitPhone: +1 needs 10 digits, others at least 7', () => {
  assert.equal(isPlausibleSplitPhone('+1', '2892211807'), true);
  assert.equal(isPlausibleSplitPhone('+1', '1 289 221 1807'), true);
  assert.equal(isPlausibleSplitPhone('+1', '289221180'), false);
  assert.equal(isPlausibleSplitPhone('+1', '28922118071'), false);
  assert.equal(isPlausibleSplitPhone('+44', '7911123456'), true);
  assert.equal(isPlausibleSplitPhone('+61', '412345678'), true);
  assert.equal(isPlausibleSplitPhone('+44', '791112'), false);
  assert.equal(isPlausibleSplitPhone('+44', '0791112'), false);
  assert.equal(isPlausibleSplitPhone('+91', '1234567890123456'), false);
  assert.equal(isPlausibleSplitPhone('+1', ''), false);
  assert.equal(isPlausibleSplitPhone('+1', '+7 912 345 6789'), true);
  assert.equal(isPlausibleSplitPhone('+1', '+4'), false);
});

test('splitPrefillPhone always yields a code the selector offers', () => {
  assert.deepEqual(splitPrefillPhone('+447911123456'), { countryCode: '+44', number: '7911123456' });
  assert.deepEqual(splitPrefillPhone('14163028755'), { countryCode: '+1', number: '4163028755' });
  assert.deepEqual(splitPrefillPhone('4163028755'), { countryCode: '+1', number: '4163028755' });
  assert.deepEqual(splitPrefillPhone(''), { countryCode: '+1', number: '' });
  assert.deepEqual(splitPrefillPhone(null), { countryCode: '+1', number: '' });
  // Unsupported code: kept whole, and still sent correctly.
  const ru = splitPrefillPhone('+79123456789');
  assert.deepEqual(ru, { countryCode: '+1', number: '+79123456789' });
  assert.equal(toE164(ru.countryCode, ru.number), '+79123456789');
});

test('isValidCollaboratorPhone: +1 needs exactly 10 digits', () => {
  assert.equal(isValidCollaboratorPhone('+1', '289221180'), false);
  assert.equal(isValidCollaboratorPhone('+1', '2892211807'), true);
  assert.equal(isValidCollaboratorPhone('+1', '(289) 221-1807'), true);
  assert.equal(isValidCollaboratorPhone('+1', '1 289 221 1807'), true); // leading 1 dropped
  assert.equal(isValidCollaboratorPhone('+1', '28922118071'), false);
  assert.equal(isValidCollaboratorPhone('+1', ''), false);
  assert.equal(isValidCollaboratorPhone('+1', '   '), false);
});

test('isValidCollaboratorPhone: other codes accept 6–15 digits', () => {
  assert.equal(isValidCollaboratorPhone('+44', '12345'), false);
  assert.equal(isValidCollaboratorPhone('+44', '123456'), true);
  assert.equal(isValidCollaboratorPhone('+44', '07911 123456'), true); // trunk 0 dropped
  assert.equal(isValidCollaboratorPhone('+91', '9876543210'), true);
  assert.equal(isValidCollaboratorPhone('+91', '1234567890123456'), false);
});

test('isValidCollaboratorPhone: a typed international number uses its own code', () => {
  assert.equal(isValidCollaboratorPhone('+44', '+12892211807'), true);
  assert.equal(isValidCollaboratorPhone('+44', '+1289221180'), false);
  assert.equal(isValidCollaboratorPhone('+1', '+44 7911 123456'), true);
  assert.equal(isValidCollaboratorPhone('+1', '+'), false);
  assert.equal(isValidCollaboratorPhone('+1', '+7 912 345 6789'), true); // unsupported code: plausibility only
});

test('collaboratorPhoneValue stores E.164', () => {
  assert.equal(collaboratorPhoneValue('+1', '(289) 221-1807'), '+12892211807');
  assert.equal(collaboratorPhoneValue('+44', '07911 123456'), '+447911123456');
  assert.equal(collaboratorPhoneValue('+1', '+44 7911 123456'), '+447911123456');
});
