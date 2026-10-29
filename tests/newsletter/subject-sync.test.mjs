// Chris, 29 Oct: the subject follows the name until the person edits the subject themselves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSubjectForName } from '../../components/newsletters/lib/subjectSync.ts';
import { LIMITS } from '../../components/newsletters/lib/rules.ts';

test('an empty subject takes the name', () => {
  assert.equal(nextSubjectForName('', 'O', ''), 'O');
  assert.equal(nextSubjectForName('', 'October deals', '   '), 'October deals', 'only spaces counts as empty');
});

test('a subject still equal to the name keeps following it', () => {
  assert.equal(nextSubjectForName('Oct', 'Octo', 'Oct'), 'Octo');
  assert.equal(nextSubjectForName('October', 'Octobe', 'October'), 'Octobe', 'deleting a letter');
  assert.equal(nextSubjectForName('O', '', 'O'), '', 'clearing the name clears the copied subject');
});

test('a subject the person typed is never changed', () => {
  assert.equal(nextSubjectForName('Oct', 'Octo', 'Big deals'), 'Big deals');
  assert.equal(nextSubjectForName('Oct', 'Octo', 'Oct!'), 'Oct!', 'one letter different is still edited');
  // An existing draft whose subject differs from its name is already edited.
  assert.equal(nextSubjectForName('October Newsletter 2026', 'October Newsletter', 'October deals are here'), 'October deals are here');
});

test('a copied subject keeps to the subject limit', () => {
  const long = 'x'.repeat(LIMITS.subject + 20);
  assert.equal(nextSubjectForName('', long, '').length, LIMITS.subject);
});
