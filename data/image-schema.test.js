import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImageRecord } from './image-schema.js';

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

test('every version of CC BY and CC BY-SA is accepted, versioned or not', () => {
  // A full run lost six cars — the Tesla Model 3 among them — to an allowlist
  // that stopped at 3.0/4.0 while Commons returned "CC BY 2.0" and a bare
  // "CC BY-SA". Every version of both is free; the version was never the
  // thing worth checking.
  for (const licence of ['CC BY', 'CC BY 1.0', 'CC BY 2.0', 'CC BY 2.5', 'CC BY 3.0', 'CC BY 4.0']) {
    assert.equal(validateImageRecord({ ...valid, licence }).valid, true, licence);
  }
  for (const licence of ['CC BY-SA', 'CC BY-SA 1.0', 'CC BY-SA 2.0', 'CC BY-SA 2.5', 'CC BY-SA 3.0']) {
    assert.equal(validateImageRecord({ ...valid, licence }).valid, true, licence);
  }
});

test('non-commercial and no-derivatives licences are still rejected', () => {
  // Both exclusions are load-bearing, and neither is about attribution. NC
  // forbids commercial use; ND forbids derivative works, and every image here
  // is cropped to 3:2 — an ND image is unusable however carefully it is
  // credited. These must not match on their "CC BY" prefix.
  for (const licence of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 4.0', 'CC BY-NC-ND 3.0']) {
    assert.equal(validateImageRecord({ ...valid, licence }).valid, false, licence);
  }
});

test('a licence that merely starts with a free one is rejected', () => {
  // The anchor, tested directly: without it, anything prefixed "CC BY" passes.
  for (const licence of ['CC BY 4.0 with exceptions', 'Not CC BY 4.0', 'CC BY 4.0 (press use only)']) {
    assert.equal(validateImageRecord({ ...valid, licence }).valid, false, licence);
  }
});

test('an unversioned share-alike licence still requires the modification note', () => {
  // REQUIRES_MODIFICATION_NOTE matches on "BY-SA" anywhere, so widening the
  // allowlist must not have opened a path where a share-alike image is
  // committed without recording that it was cropped.
  const noNote = { ...valid, licence: 'CC BY-SA' };
  delete noNote.note;
  assert.equal(validateImageRecord(noNote).valid, false);
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

// The dimensions assertion moved to public/ui/image-constants.test.js along
// with the constant itself — this file validates record shape, not pixels.
