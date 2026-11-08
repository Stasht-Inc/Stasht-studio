// tests/utils/verificationCodeWording.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// Chris, 8 Nov 2026 (b, point 1): "nobody knows what OTP is. Let's change to Send Verification Code".
// No sign-in / sign-up / verify screen shows the word "OTP" any more — neither Studio's own text nor a
// message an older API server still sends ("Invalid OTP code"), which friendlyCodeMessage rewrites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { friendlyCodeMessage, isCodeSentMessage } from '../../utils/verificationCodeWording.ts';

test('old API messages read as plain "verification code" wording', () => {
  const cases = {
    'Invalid OTP code': "That code isn't right. Please check it and try again.",
    'Invalid OTP.': "That code isn't right. Please check it and try again.",
    'OTP has expired. Please request a new one.': 'That code has expired. Please request a new one.',
    'OTP has expired.': 'That code has expired. Please request a new one.',
    'OTP has expired. Please try logging in again.': 'That code has expired. Please try signing in again.',
    'This OTP has already been used.': 'That code has already been used. Please try signing in again.',
    'No OTP found. Please request a new one.': "We couldn't find a code for you. Please request a new one.",
    'Failed to send OTP. Please try again later.': "We couldn't send your verification code. Please try again later.",
    'Failed to send OTP': "We couldn't send your verification code. Please try again.",
    'Failed to resend OTP': "We couldn't send a new verification code. Please try again.",
    'OTP has been resent to your phone number': 'A new verification code has been sent to your phone number',
    'OTP has been resent to your email': 'A new verification code has been sent to your email',
    'OTP has been sent to your email': 'Your verification code has been sent to your email',
    'OTP sent successfully.': 'Your verification code has been sent.',
    'OTP verified successfully': 'Code verified',
    'Failed to verify OTP': "We couldn't check your code. Please try again.",
    'New device detected. An OTP has been sent to your email for verification.':
      "New device detected. We've sent a verification code to your email.",
    'The otp field must be 6 characters.': 'The verification code field must be 6 characters.',
  };
  for (const [before, after] of Object.entries(cases)) {
    assert.equal(friendlyCodeMessage(before), after, before);
  }
});

test('any other message mentioning OTP is reworded, everything else passes through', () => {
  assert.equal(friendlyCodeMessage('An OTP is on its way'), 'A verification code is on its way');
  assert.equal(friendlyCodeMessage('Enter the OTP we sent'), 'Enter the verification code we sent');
  assert.equal(friendlyCodeMessage('otp required'), 'Verification code required');
  assert.equal(friendlyCodeMessage('This email is already registered'), 'This email is already registered');
  assert.equal(friendlyCodeMessage("That code isn't right. Please check it and try again."), "That code isn't right. Please check it and try again.");
  assert.equal(friendlyCodeMessage(''), undefined);
  assert.equal(friendlyCodeMessage(undefined), undefined);
  assert.equal(friendlyCodeMessage(null), undefined);
  // Falsy result keeps the `friendlyCodeMessage(res.message) || 'fallback'` pattern working.
  assert.equal(friendlyCodeMessage('') || 'fallback', 'fallback');
});

test('the phone sign-up "code sent" check accepts old and new API wording', () => {
  assert.equal(isCodeSentMessage('User registered successfully. An OTP has been sent to your phone number for verification.'), true);
  assert.equal(isCodeSentMessage("User registered successfully. We've sent a verification code to your phone number."), true);
  assert.equal(isCodeSentMessage('User registered successfully. Please check your email and click the activation link to activate your account.'), false);
  assert.equal(isCodeSentMessage(undefined), false);
});

// ---- No screen text says OTP --------------------------------------------------------------------
// Scans the sign-in / sign-up / verify screens for the word "OTP" inside string literals and JSX text,
// ignoring comments and developer logging (console.* / devLog), which people never see.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCREENS = [
  'pages/LoginPage.tsx',
  'pages/SignupPage.tsx',
  'pages/PropertyRegisterPage.tsx',
  'pages/PersonalAccountRegisterPage.tsx',
  'components/DeviceVerificationModal.tsx',
  'contexts/AuthContext.tsx',
  'utils/authUtils.ts',
];

function visibleOtpLines(src) {
  const hits = [];
  let inBlockComment = false;
  let inLog = false; // inside a multi-line console.*( / devLog( call
  src.split('\n').forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\{?\/\*.*?\*\/\}?/g, '');
    const open = line.indexOf('/*');
    if (open !== -1) { line = line.slice(0, open); inBlockComment = true; }
    line = line.replace(/(^|[^:'"`])\/\/.*$/, '$1');
    if (inLog) { if (/\);\s*$/.test(line)) inLog = false; return; }
    if (/\b(console\.(log|error|warn|info|debug)|devLog)\(/.test(line)) {
      if (!/\);\s*$/.test(line)) inLog = true;
      return;
    }
    if (/\bOTP\b/.test(line)) hits.push(`${i + 1}: ${raw.trim()}`);
  });
  return hits;
}

for (const file of SCREENS) {
  test(`${file} shows no "OTP" text`, () => {
    const hits = visibleOtpLines(readFileSync(ROOT + file, 'utf8'));
    assert.deepEqual(hits, [], `user-visible "OTP" left in ${file}:\n${hits.join('\n')}`);
  });
}

test('the sign-in button says Send Verification Code', () => {
  const src = readFileSync(ROOT + 'pages/LoginPage.tsx', 'utf8');
  assert.match(src, /<span>Send Verification Code<\/span>/);
  const signup = readFileSync(ROOT + 'pages/SignupPage.tsx', 'utf8');
  assert.match(signup, /Send Verification Code/);
});
