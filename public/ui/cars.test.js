import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterVehicles, cardModel } from './cars.js';
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
