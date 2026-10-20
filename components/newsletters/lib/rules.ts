// Limits from spec §8. The web API enforces the same numbers; Studio stops people earlier.
export const LIMITS = {
  name: 120,
  subject: 150,
  preview_text: 200,
  from_name: 80,
  sms_text: 120,
  blocks: 40,
  title: 200,
  text_html: 20000,
  button_label: 40,
  url: 2000,
} as const;

export function isPlausibleEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
