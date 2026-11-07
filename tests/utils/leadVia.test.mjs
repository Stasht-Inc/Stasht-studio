// Chris 7 Nov (point 8): people added to a newsletter list become leads. Their "Via" line names the list they came
// from (GET /leads source_list), instead of "Direct message".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadViaText } from '../../utils/leadVia.ts';

test('a lead from a list says which list', () => {
  assert.equal(leadViaText({ story: null, source: 'memory', source_list: { id: 4, name: 'Subscriber list sept 30th 2026' } }), 'List: Subscriber list sept 30th 2026');
});

test('campaign, widget and direct leads read as before', () => {
  assert.equal(leadViaText({ story: { id: 1, title: 'Fall show' }, source: 'memory', source_list: null }), 'Via: Fall show');
  assert.equal(leadViaText({ story: { id: 1, title: 'Fall show' }, source: 'memory', source_list: { id: 4, name: 'X' } }), 'Via: Fall show', 'a campaign wins');
  assert.equal(leadViaText({ story: null, source: 'widget' }), 'Website widget');
  assert.equal(leadViaText({ story: null, source: 'memory' }), 'Direct message');
  assert.equal(leadViaText({ story: null, source: 'memory', source_list: { id: 4, name: '  ' } }), 'Direct message', 'a blank list name is not shown');
});
