// tests/utils/exampleContacts.test.mjs — Chris 16 Nov points 7 + 8: every example phone is 1235555555 and every example
// email name@example.com; the real number that was used must not appear anywhere in Studio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const SKIP = new Set(['node_modules', '.git', 'dist', 'dev-dist', '.worktrees', 'test-results', 'playwright-report']);
const TEXT = /\.(tsx?|jsx?|mjs|cjs|html|css|json|md|txt|php|ya?ml)$/i;

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) files(full, out);
    else if (TEXT.test(name) && st.size < 5_000_000) out.push(full);
  }
  return out;
}

const all = files(ROOT);
const source = all.filter((f) => /^(components|pages|utils|hooks|services|contexts|constants|public)\//.test(relative(ROOT, f)) || relative(ROOT, f) === 'index.html');

test('the old real number appears nowhere in Studio', () => {
  const NEEDLE = ['4163', '028755'].join(''); // split so this file never matches itself
  const hits = all.filter((f) => readFileSync(f, 'utf8').includes(NEEDLE)).map((f) => relative(ROOT, f));
  assert.deepEqual(hits, []);
});

test('no old example phone or email is left in the app', () => {
  const OLD = ['416 555 0100', '(555) 123-4567', 'you@example.com', 'john@example.com', 'your.email@example.com', 'e.g. name@example.com'];
  const hits = [];
  for (const f of source) {
    const text = readFileSync(f, 'utf8');
    for (const old of OLD) if (text.includes(old)) hits.push(`${relative(ROOT, f)}: ${old}`);
  }
  assert.deepEqual(hits, []);
});
