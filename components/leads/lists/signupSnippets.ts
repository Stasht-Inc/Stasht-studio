// Website signup form (Royal Wood task 11): the copyable examples shown on a list's management view.
// Pure functions so they can be unit-tested (tests/newsletter/list-signup.test.mjs).

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A plain HTML form: works with no JavaScript. The hidden "website" field is the honeypot — keep it hidden and empty. */
export function htmlFormSnippet(endpoint: string, key: string): string {
  return [
    `<form action="${escapeHtml(endpoint)}" method="post">`,
    `  <input type="hidden" name="key" value="${escapeHtml(key)}">`,
    '  <!-- Optional: where to send people afterwards (your own site, or a domain allowed in Stasht). ?signup=… is added. -->',
    '  <input type="hidden" name="redirect" value="https://www.example.com/thanks">',
    '  <input type="text" name="first_name" placeholder="First name">',
    '  <input type="text" name="last_name" placeholder="Last name">',
    '  <input type="email" name="email" placeholder="Email" required>',
    '  <!-- Leave this hidden and empty: it catches spam bots. -->',
    '  <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">',
    '  <button type="submit">Subscribe</button>',
    '</form>',
  ].join('\n');
}

/** fetch() from the website's own JavaScript: JSON in, JSON out ({ ok, status } or { ok: false, error }). */
export function fetchSnippet(endpoint: string, key: string): string {
  return [
    `const res = await fetch(${JSON.stringify(endpoint)}, {`,
    "  method: 'POST',",
    "  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },",
    '  body: JSON.stringify({',
    `    key: ${JSON.stringify(key)},`,
    '    email: form.email.value,',
    '    first_name: form.first_name.value,',
    '    last_name: form.last_name.value,',
    "    website: form.website.value, // the hidden honeypot field: empty for real people",
    '  }),',
    '});',
    'const data = await res.json();',
    "// data.status: 'confirm_email' (check your inbox) or 'subscribed'. data.error: 'invalid_email', 'not_found' or 'too_many_requests'.",
  ].join('\n');
}

/** The redirect-domains box: one website address per line → host names (the API checks them again). */
export function parseDomains(text: string): string[] {
  return text.split(/[\n,]+/).map((line) => line.trim()).filter(Boolean);
}

