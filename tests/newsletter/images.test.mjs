import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, imageFileProblem } from '../../components/newsletters/lib/images.ts';

test('images: jpg, png, gif, webp up to 5 MB (POST /newsletters/images)', () => {
  assert.equal(IMAGE_ACCEPT, 'image/jpeg,image/png,image/gif,image/webp');
  assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
  assert.equal(imageFileProblem({ type: 'image/png', size: 1000 }), null);
  assert.equal(imageFileProblem({ type: 'image/webp', size: MAX_IMAGE_BYTES }), null);
  assert.equal(imageFileProblem({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }), 'Images can be up to 5 MB. Choose a smaller one.');
  assert.equal(imageFileProblem({ type: 'image/svg+xml', size: 10 }), 'Use a JPG, PNG, GIF or WebP image.');
  assert.equal(imageFileProblem({ type: 'application/pdf', size: 10 }), 'Use a JPG, PNG, GIF or WebP image.');
  assert.equal(imageFileProblem({ type: '', size: 10 }), 'Use a JPG, PNG, GIF or WebP image.');
});
