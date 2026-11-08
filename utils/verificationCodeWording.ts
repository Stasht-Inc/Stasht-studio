// Chris, 8 Nov 2026: "nobody knows what OTP is". Sign-in screens say "verification code" / "code".
// The web API now sends that wording too, but an older server (or the mobile API behind SSO) can
// still answer "Invalid OTP code" — friendlyCodeMessage rewrites any such message before it is shown.

const KNOWN: Array<[RegExp, string]> = [
  [/^invalid otp( code)?\.?$/i, "That code isn't right. Please check it and try again."],
  [/^otp has expired\.?( please request a new one\.?)?$/i, 'That code has expired. Please request a new one.'],
  [/^otp has expired\. please try logging in again\.?$/i, 'That code has expired. Please try signing in again.'],
  [/^this otp has already been used\.?$/i, 'That code has already been used. Please try signing in again.'],
  [/^no otp found\. please request a new one\.?$/i, "We couldn't find a code for you. Please request a new one."],
  [/^failed to send otp\. please try again later\.?$/i, "We couldn't send your verification code. Please try again later."],
  [/^failed to send otp(\. please try again)?\.?$/i, "We couldn't send your verification code. Please try again."],
  [/^failed to resend otp(\. please try again)?\.?$/i, "We couldn't send a new verification code. Please try again."],
  [/^otp has been resent to your (phone number|email)\.?$/i, 'A new verification code has been sent to your $1'],
  [/^otp has been sent to your (phone number|email)\.?$/i, 'Your verification code has been sent to your $1'],
  [/^otp sent successfully\.?$/i, 'Your verification code has been sent.'],
  [/^otp verified successfully\.?$/i, 'Code verified'],
  [/^failed to verify otp\.?$/i, "We couldn't check your code. Please try again."],
  [/an otp has been sent to your (phone number|email) for verification\.?/i, "We've sent a verification code to your $1."],
];

/** The message with "OTP" reworded; undefined for an empty message (so `|| 'fallback'` still works). */
export function friendlyCodeMessage(message?: string | null): string | undefined {
  if (!message) return undefined;
  let text = message;
  for (const [pattern, replacement] of KNOWN) {
    if (pattern.test(text)) {
      text = text.replace(pattern, replacement);
      break;
    }
  }
  if (!/\botp\b/i.test(text)) return text;
  text = text
    .replace(/\b(a)n otp\b/gi, '$1 verification code')
    .replace(/\botp codes?\b/gi, 'verification code')
    .replace(/\botps\b/gi, 'verification codes')
    .replace(/\botp\b/gi, 'verification code');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** True when a sign-up response says a code went to the phone (old "OTP" or new "verification code" wording). */
export function isCodeSentMessage(message?: string | null): boolean {
  return !!message && /\bOTP\b|verification code/i.test(message);
}
