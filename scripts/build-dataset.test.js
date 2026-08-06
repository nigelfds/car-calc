import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joinImages } from './build-dataset.js';

const families = [{ id: 'kia-ev5' }, { id: 'byd-seal' }];
const images = {
  'kia-ev5': {
    file: 'kia-ev5.webp',
    source: 'https://commons.wikimedia.org/wiki/File:Kia_EV5_001.jpg',
    author: 'A Photographer',
    licence: 'CC BY 4.0'
  }
};

test('a family with an image record carries it into the aggregate', () => {
  const { joined } = joinImages(families, images);
  assert.equal(joined.find(f => f.id === 'kia-ev5').image.file, 'kia-ev5.webp');
});

test('a family without an image record is untouched and carries no image key', () => {
  const { joined } = joinImages(families, images);
  const seal = joined.find(f => f.id === 'byd-seal');
  assert.equal('image' in seal, false);
});

test('an empty image map leaves every family unchanged', () => {
  const { joined, errors } = joinImages(families, {});
  assert.deepEqual(errors, []);
  assert.deepEqual(joined, families);
});

test('an image keyed to an unknown family is an error, not a silent no-op', () => {
  // Catches a typo'd family id in car-images.json, which would otherwise mean an
  // image that is committed, validated, and never rendered anywhere.
  const { errors } = joinImages(families, { ...images, 'kia-ev99': images['kia-ev5'] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /kia-ev99/);
});

test('an invalid image record is reported against its family id', () => {
  const { errors } = joinImages(families, { 'kia-ev5': { file: 'NOPE.png' } });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /kia-ev5/);
});

test('joining does not mutate the families passed in', () => {
  const input = [{ id: 'kia-ev5' }];
  joinImages(input, images);
  assert.equal('image' in input[0], false);
});
