import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchVehicles, SEARCH_LIMIT } from './vehicle-search.js';

const fleet = [
  { id: 'ev5-air', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', listPrice: 61170, bodyType: 'SUV' },
  { id: 'ev5-earth', make: 'Kia', model: 'EV5', variant: 'Earth AWD', listPrice: 64770, bodyType: 'SUV' },
  { id: 'ev6', make: 'Kia', model: 'EV6', variant: 'Air', listPrice: 59590, bodyType: 'SUV' },
  { id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic', listPrice: 46990, bodyType: 'SUV', powertrain: 'phev' },
  { id: 'my', make: 'Tesla', model: 'Model Y', variant: 'Premium RWD', listPrice: 58900, bodyType: 'SUV' }
];

test('an empty query returns nothing rather than the whole fleet', () => {
  assert.deepEqual(searchVehicles(fleet, ''), []);
  assert.deepEqual(searchVehicles(fleet, '   '), []);
});

test('matching on the model groups every trim under one heading', () => {
  const groups = searchVehicles(fleet, 'ev5');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].modelLabel, 'Kia EV5');
  assert.deepEqual(groups[0].items.map(v => v.id), ['ev5-air', 'ev5-earth']);
});

test('matching on the make returns every model that make sells', () => {
  const groups = searchVehicles(fleet, 'kia');
  assert.deepEqual(groups.map(g => g.modelLabel), ['Kia EV5', 'Kia EV6']);
});

test('the make and model can be typed together', () => {
  const groups = searchVehicles(fleet, 'kia 5');
  assert.deepEqual(groups.map(g => g.modelLabel), ['Kia EV5']);
});

test('the variant is searchable too', () => {
  const groups = searchVehicles(fleet, 'earth');
  assert.deepEqual(groups[0].items.map(v => v.id), ['ev5-earth']);
});

test('matching ignores case and surrounding space', () => {
  assert.equal(searchVehicles(fleet, '  SEALION  ')[0].modelLabel, 'BYD Sealion 6');
});

test('no match returns an empty list, not everything', () => {
  assert.deepEqual(searchVehicles(fleet, 'zzz'), []);
});

test('the limit counts variants across groups, not groups', () => {
  const groups = searchVehicles(fleet, 'kia', 2);
  assert.equal(groups.flatMap(g => g.items).length, 2);
});

test('the default limit is eight', () => {
  assert.equal(SEARCH_LIMIT, 8);
});
