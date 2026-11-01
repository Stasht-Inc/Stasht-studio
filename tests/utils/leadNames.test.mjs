// Review (batch 3): Leads → Groups crashed the whole app ("Something went wrong") when a group held a lead with no
// account: GET /lead-groups sends that member's name as null (LeadGroupsController@index) and getInitials(null)
// threw. Initials and the shown name now cope with a missing name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialsOf, groupMemberName } from '../../utils/leadNames.ts';

test('initials of a name, and of nothing at all', () => {
  assert.equal(initialsOf('Bon Sun'), 'BS');
  assert.equal(initialsOf('  ava   chen  park '), 'AC', 'extra spaces are not words');
  assert.equal(initialsOf('Cher'), 'C');
  assert.equal(initialsOf(null), '?');
  assert.equal(initialsOf(undefined), '?');
  assert.equal(initialsOf('   '), '?');
  assert.equal(initialsOf('ava@example.com'), 'A', 'an email used as the name');
  assert.equal(initialsOf('+1 416 555 0100'), '?', 'a phone number has no letters to show');
});

test('a group member with no account still gets a name', () => {
  assert.equal(groupMemberName({ lead_id: 1, name: 'Bon Sun', profile_image: null }), 'Bon Sun');
  assert.equal(groupMemberName({ lead_id: 2, name: null, profile_image: null }), 'Guest');
  assert.equal(groupMemberName({ lead_id: 3, name: '  ', profile_image: null }), 'Guest');
  assert.equal(groupMemberName({ lead_id: 4, name: null, email: 'ava@example.com', profile_image: null }), 'ava@example.com', 'how they can be reached, when the API sends it');
  assert.equal(groupMemberName({ lead_id: 5, name: null, email: null, phone: '+14165550100', profile_image: null }), '+14165550100');
});
