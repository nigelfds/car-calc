import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageRecord, IMAGE_DIMENSIONS } from './image-schema.js';

const valid = {
  file: 'byd-sealion-6.webp',
  source: 'https://commons.wikimedia.org/wiki/File:BYD_Song_Plus_001.jpg',
  author: 'Alexander Migl',
  licence: 'CC BY-SA 4.0',
  note: 'Cropped and resized. Sold in China as the Song Plus DM-i.'
};

test('a complete record is valid', () => {
  assert.deepEqual(validateImageRecord(valid), { valid: true, errors: [] });
});

test('the file must be a lowercase slug ending in .webp', () => {
  for (const file of ['Byd.webp', 'byd sealion.webp', 'byd-sealion-6.jpg', '../escape.webp']) {
    assert.equal(validateImageRecord({ ...valid, file }).valid, false, file);
  }
});

test('the source must be an https commons URL', () => {
  assert.equal(validateImageRecord({ ...valid, source: 'http://commons.wikimedia.org/wiki/File:x.jpg' }).valid, false);
  assert.equal(validateImageRecord({ ...valid, source: 'https://example.com/x.jpg' }).valid, false);
});

test('author and licence must be non-empty', () => {
  assert.equal(validateImageRecord({ ...valid, author: '' }).valid, false);
  assert.equal(validateImageRecord({ ...valid, licence: '   ' }).valid, false);
});

test('only recognised free licences are accepted', () => {
  for (const licence of ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Public domain']) {
    assert.equal(validateImageRecord({ ...valid, licence }).valid, true, licence);
  }
  // A non-free or unknown licence must not slip through — this is the check that
  // stops an all-rights-reserved press photo being committed by mistake.
  assert.equal(validateImageRecord({ ...valid, licence: 'All rights reserved' }).valid, false);
});

test('a share-alike licence requires the modification to be noted', () => {
  // CC BY-SA obliges us to indicate that the work was changed, and every image
  // here is cropped. A record without that note is not compliant.
  const noNote = { ...valid };
  delete noNote.note;
  assert.equal(validateImageRecord(noNote).valid, false);
  assert.equal(validateImageRecord({ ...noNote, licence: 'CC0' }).valid, true);
});

test('errors name every problem, not just the first', () => {
  const result = validateImageRecord({ file: 'X.png', source: 'nope', author: '', licence: 'CC BY 4.0' });
  assert.ok(result.errors.length >= 3, result.errors.join('; '));
});

test('the canonical dimensions are exported for the crop and the tests to share', () => {
  assert.deepEqual(IMAGE_DIMENSIONS, { width: 900, height: 600 });
});
