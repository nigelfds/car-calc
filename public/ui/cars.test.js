import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterVehicles, cardModel, datasetStats } from './cars.js';
import { rankVehicles } from '../../calc/rank.js';

const fleet = [
  { id: 'a', familyId: 'fa', make: 'Kia', model: 'EV5', bodyType: 'SUV', bootLitresSeatsUp: 513, rangeKm: 400, seats: 5, listPrice: 56000 },
  { id: 'b', familyId: 'fb', make: 'BYD', model: 'Dolphin', bodyType: 'Hatch', bootLitresSeatsUp: 345, rangeKm: 340, seats: 5, listPrice: 34000 }
];
const families = [
  { id: 'fa', summary: 'Roomy electric SUV.', pros: ['Big boot'], cons: ['Slow charging'], sources: ['https://x'], images: ['https://press/a.jpg'] }
];

test('body type filters the fleet', () => {
  assert.deepEqual(filterVehicles(fleet, { bodyTypes: ['SUV'] }).map(v => v.id), ['a']);
});

test('a boot minimum excludes cars that fall short', () => {
  assert.deepEqual(filterVehicles(fleet, { minBootLitres: 500 }).map(v => v.id), ['a']);
});

test('filters combine', () => {
  assert.equal(filterVehicles(fleet, { bodyTypes: ['SUV'], minRangeKm: 500 }).length, 0);
});

test('an empty filter returns everything', () => {
  assert.equal(filterVehicles(fleet, {}).length, 2);
});

test('a card carries its family review when one exists', () => {
  const card = cardModel(fleet[0], families);
  assert.equal(card.summary, 'Roomy electric SUV.');
  assert.deepEqual(card.pros, families[0].pros ?? []);
});

test('a card without a family still renders', () => {
  const card = cardModel(fleet[1], families);
  assert.equal(card.summary, null);
  assert.equal(card.make, 'BYD');
});

// Car imagery is gone from the UI: no photography, and no body-type
// silhouette standing in for it. A family may still carry an `images` array
// in the data (the schema keeps it optional), but the card model must not
// surface it, or a future renderer will silently start painting cars again.
test('the card model does not carry an image, even when the family has one', () => {
  const withImages = [{ ...families[0], images: ['https://press/a.jpg'] }];
  const card = cardModel(fleet[0], withImages);
  assert.equal(card.image, undefined);
  assert.ok(!('image' in card), 'cardModel must not expose an image field');
});

// --- Dataset stats in the header -----------------------------------------
// Written from the data rather than typed into the markup, so the counts
// cannot drift from what actually ships.

test('the stats line counts models and variants and dates the data', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'a', sourcedAt: '2026-07-26' },
      { familyId: 'a', sourcedAt: '2026-07-27' },
      { familyId: 'b', sourcedAt: '2026-07-20' }
    ],
    families: [{ id: 'a' }, { id: 'b' }]
  });
  assert.equal(stats.models, 2);
  assert.equal(stats.variants, 3);
  assert.equal(stats.updated, 'July 2026');
});

test('the date is the most recent sourcedAt, not the first or the clock', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'a', sourcedAt: '2025-02-10' },
      { familyId: 'a', sourcedAt: '2026-11-03' }
    ],
    families: [{ id: 'a' }]
  });
  assert.equal(stats.updated, 'November 2026');
});

test('missing or malformed dates do not produce an Invalid Date', () => {
  const stats = datasetStats({
    vehicles: [{ familyId: 'a' }, { familyId: 'a', sourcedAt: 'not-a-date' }],
    families: [{ id: 'a' }]
  });
  assert.equal(stats.updated, null);
  assert.equal(stats.variants, 2);
});

test('an empty dataset reports zeroes rather than throwing', () => {
  const stats = datasetStats({ vehicles: [], families: [] });
  assert.equal(stats.models, 0);
  assert.equal(stats.variants, 0);
  assert.equal(stats.updated, null);
});

test('models counts families that actually have variants', () => {
  // A family with no rows is not a car anyone can be shown.
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', sourcedAt: '2026-07-27' }],
    families: [{ id: 'a' }, { id: 'orphan' }]
  });
  assert.equal(stats.models, 1);
});
