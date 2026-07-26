import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreVehicle, rankVehicles } from './rank.js';

const car = (id, over = {}) => ({
  id, listPrice: 55000, bootLitresSeatsUp: 450, rangeKm: 450,
  warrantyYears: 5, seats: 5, bodyType: 'SUV', ...over
});

test('a bigger boot scores higher when boot space is wanted', () => {
  const prefs = { minBootLitres: 500 };
  assert.ok(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), prefs) >
    scoreVehicle(car('small', { bootLitresSeatsUp: 520 }), prefs)
  );
});

test('boot space barely matters when it was never mentioned', () => {
  const prefs = {};
  const spread = Math.abs(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), prefs) -
    scoreVehicle(car('small', { bootLitresSeatsUp: 300 }), prefs)
  );
  const bootSpread = Math.abs(
    scoreVehicle(car('big', { bootLitresSeatsUp: 700 }), { minBootLitres: 500 }) -
    scoreVehicle(car('small', { bootLitresSeatsUp: 300 }), { minBootLitres: 500 })
  );
  assert.ok(spread < bootSpread, 'an unstated preference carries less weight');
});

test('longer range scores higher when range is wanted', () => {
  const prefs = { minRangeKm: 400 };
  assert.ok(
    scoreVehicle(car('far', { rangeKm: 600 }), prefs) >
    scoreVehicle(car('near', { rangeKm: 410 }), prefs)
  );
});

test('ranking is deterministic — same input, same order, every time', () => {
  const fleet = [car('a'), car('b', { bootLitresSeatsUp: 600 }), car('c', { rangeKm: 520 })];
  const prefs = { minBootLitres: 500, minRangeKm: 400 };
  const first = rankVehicles(fleet, prefs).map(r => r.vehicle.id);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(rankVehicles(fleet, prefs).map(r => r.vehicle.id), first);
  }
});

test('ranking respects the limit', () => {
  const fleet = Array.from({ length: 12 }, (_, i) => car(`v${i}`));
  assert.equal(rankVehicles(fleet, {}, 3).length, 3);
});

test('each result carries human-readable reasons', () => {
  const ranked = rankVehicles([car('a', { bootLitresSeatsUp: 700 })], { minBootLitres: 500 });
  assert.ok(Array.isArray(ranked[0].reasons));
  assert.ok(ranked[0].reasons.length > 0);
  assert.equal(typeof ranked[0].reasons[0], 'string');
});

test('an empty fleet ranks to an empty list', () => {
  assert.deepEqual(rankVehicles([], { minBootLitres: 500 }), []);
});

test('ties break on a stable, documented rule rather than array order', () => {
  const fleet = [car('zzz'), car('aaa')];
  assert.deepEqual(rankVehicles(fleet, {}).map(r => r.vehicle.id), ['aaa', 'zzz']);
});
