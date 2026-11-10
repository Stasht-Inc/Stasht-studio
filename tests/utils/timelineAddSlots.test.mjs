// tests/utils/timelineAddSlots.test.mjs
// Chris, 9 Nov 2026 (point 5): the desktop campaign page's "+" (Add Widget) moved from the left timeline list to the
// right-hand timeline of cards: one under the "Timeline • N moments" header (the top) and one after every moment card,
// including the last. Each "+" inserts after that moment (after_post_id).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addSlotAfter, timelineAddSlots, collaboratorAddWidgetOptions } from '../../utils/timelineAddSlots.ts';
import { addWidgetOptions } from '../../components/widgets/addWidgetOptions.ts';

const post = (id) => ({ type: 'post', id });
const linked = (id) => ({ type: 'linked', id: String(id) });

test('a "+" follows every moment card (its id, as a string); none follows a linked campaign', () => {
  assert.equal(addSlotAfter(post('11')), '11');
  assert.equal(addSlotAfter(post(42)), '42');
  assert.equal(addSlotAfter(linked(90)), undefined);
  assert.equal(addSlotAfter(post('')), undefined);
  assert.equal(addSlotAfter(post(null)), undefined);
  assert.equal(addSlotAfter(null), undefined);
});

test('the right timeline\'s "+" in order: the top (null), then after each moment — the last one too', () => {
  assert.deepEqual(timelineAddSlots([post(11), post(12), post(13)]), [null, '11', '12', '13']);
  assert.deepEqual(timelineAddSlots([post(11), linked(90), post(12), linked(91)]), [null, '11', '12']);
  assert.deepEqual(timelineAddSlots([]), [null], 'an empty campaign still has the top "+"');
  assert.deepEqual(timelineAddSlots(null), [null]);
});

test('the collaborator view offers what its own left "+" offered: no Share Request a Moment, no AI Creator', () => {
  const owner = addWidgetOptions({ docuSign: false });
  assert.deepEqual(collaboratorAddWidgetOptions(owner).map((o) => o.label),
    ['Moment', 'Call to Action', 'Voice to Text', 'HTML', 'Youtube', 'Quote']);
  const withDocuSign = addWidgetOptions({ docuSign: true, docuSignFeature: true });
  assert.deepEqual(collaboratorAddWidgetOptions(withDocuSign).map((o) => o.kind).slice(-1), ['docusign']);
});
