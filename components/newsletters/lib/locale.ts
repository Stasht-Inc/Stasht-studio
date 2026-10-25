// The person's language for dates and numbers (the browser's), with en-US where there is none.
export function userLocale(): string {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language : '';
    if (lang && Intl.DateTimeFormat.supportedLocalesOf([lang]).length) return lang;
  } catch {
    // An odd language tag: fall back.
  }
  return 'en-US';
}
