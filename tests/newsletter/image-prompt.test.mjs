import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_CREDITS, imageGenerateError, imagePromptSeed } from '../../components/newsletters/lib/imagePrompt.ts';

const blocks = [
  { id: 't1', type: 'title', data: { text: 'Spring sale', size: 'large' } },
  { id: 'x1', type: 'text', data: { html: '<p>Solid oak <strong>dining tables</strong> &amp; chairs.</p><p>This week only.</p>' } },
  { id: 'i1', type: 'image', data: { url: '', alt: '' } },
  { id: 'b1', type: 'button', data: { label: 'Shop', url: 'https://x.test', color: '#000' } },
  { id: 'x2', type: 'text', data: { html: '<p>Free delivery in Toronto</p>' } },
];

test('image prompt: subject, then the nearest text above and below the Image section', () => {
  assert.equal(imagePromptSeed('Royal Wood spring sale', blocks, 'i1'),
    'Royal Wood spring sale. Solid oak dining tables & chairs. This week only. Spring sale');
  // Only the two closest text sections; a duplicate of the subject is left out.
  assert.equal(imagePromptSeed('Spring sale', blocks, 'i1'), 'Spring sale. Solid oak dining tables & chairs. This week only');
});

test('image prompt: empty when there is nothing to use, and cut at a word to 400', () => {
  assert.equal(imagePromptSeed('', [{ id: 'i1', type: 'image', data: { url: '', alt: '' } }], 'i1'), '');
  const long = imagePromptSeed('word '.repeat(200), [], 'i1');
  assert.ok(long.length <= 400);
  assert.ok(long.endsWith('word'));
});

test('image prompt: errors read as the server words, with short fallbacks', () => {
  assert.equal(imageGenerateError({ ok: false, status: 402, code: 'no_credits' }), `You're out of AI credits. Images use ${IMAGE_CREDITS}.`);
  assert.equal(imageGenerateError({ ok: false, status: 422, code: 'content_policy', error: "This prompt isn't allowed. Try different words." }), "This prompt isn't allowed. Try different words.");
  assert.equal(imageGenerateError({ ok: false, status: 502, error: 'Bad gateway junk' }), "We couldn't create an image. Try again.");
  assert.equal(imageGenerateError({ ok: false, rateLimited: true, error: 'Too many images. Wait a minute.' }), 'Too many images. Wait a minute.');
});
