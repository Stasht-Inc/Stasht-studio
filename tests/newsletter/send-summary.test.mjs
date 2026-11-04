// The confirm dialogs' count rows (newsletter Send and the Storeel flow's Send now): "1 person", never "1 people".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peopleCount } from '../../components/newsletters/lib/audience.ts';

test('people are counted in proper English, numbers as before', () => {
  assert.equal(peopleCount(1, 'en-US'), '1 person');
  assert.equal(peopleCount(0, 'en-US'), '0 people');
  assert.equal(peopleCount(2, 'en-US'), '2 people');
  assert.equal(peopleCount(1180, 'en-US'), '1,180 people');
});
