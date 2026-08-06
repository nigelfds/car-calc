import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_DIMENSIONS, CAR_IMAGE_DIR } from './image-constants.js';

test('the canonical dimensions are the ones the crop, the renderers and the repo invariant share', () => {
  assert.deepEqual(IMAGE_DIMENSIONS, { width: 900, height: 600 });
});

test('the dimensions are 3:2', () => {
  // Stated as a ratio rather than left implicit in two numbers: the CSS
  // aspect-ratio rules on .car-figure and .compare-head__img are written as
  // 3 / 2, and a change here that broke the ratio would letterbox every card
  // without failing the width/height assertion above.
  assert.equal(IMAGE_DIMENSIONS.width / IMAGE_DIMENSIONS.height, 3 / 2);
});

test('the image directory is relative, so it resolves the same in a page and under public/', () => {
  // An <img src> in a served page resolves it against public/; the Node
  // scripts join it onto publicDir. A leading slash would work in the browser
  // and silently produce an absolute filesystem path in the scripts.
  assert.equal(CAR_IMAGE_DIR, 'images/cars');
  assert.equal(CAR_IMAGE_DIR.startsWith('/'), false);
  assert.equal(CAR_IMAGE_DIR.endsWith('/'), false);
});
