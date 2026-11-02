// tests/utils/memoryDetailPath.test.mjs
// Imports the TypeScript source directly — needs Node >= 22.18 (built-in type stripping).
//
// GET /memory-detail/{id} (3 Nov 2026): a Private (published=3) parent campaign's linked campaigns are readable only
// with that page's access token, so the public campaign page passes it along when it has one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDetailPath } from '../../utils/memoryDetailPath.ts';

test('no token: the plain path (public / view-only pages, signed-in owners and members)', () => {
  assert.equal(memoryDetailPath('902'), '/memory-detail/902');
  assert.equal(memoryDetailPath(902, null), '/memory-detail/902');
  assert.equal(memoryDetailPath(902, ''), '/memory-detail/902');
  assert.equal(memoryDetailPath(902, '   '), '/memory-detail/902');
});

test("the page's token goes along as ?access_token=, encoded", () => {
  assert.equal(memoryDetailPath(902, 'abc123'), '/memory-detail/902?access_token=abc123');
  assert.equal(memoryDetailPath('902', ' a b&c=d/ '), '/memory-detail/902?access_token=a%20b%26c%3Dd%2F');
});

test('the id is encoded too', () => {
  assert.equal(memoryDetailPath('9/2'), '/memory-detail/9%2F2');
});
