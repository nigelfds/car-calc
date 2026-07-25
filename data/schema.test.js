import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVehicle, validateFamily, loadDataset } from './schema.js';

const vehicles = JSON.parse(readFileSync(new URL('./vehicles.json', import.meta.url)));
const families = JSON.parse(readFileSync(new URL('./families.json', import.meta.url)));

const goodVehicle = {
  id: 'kia-ev5-air',
  familyId: 'kia-ev5',
  make: 'Kia',
  model: 'EV5',
  variant: 'Air Standard Range',
  bodyType: 'SUV',
  listPrice: 56000,
  batteryKwh: 64.2,
  rangeKm: 400,
  consumptionKwhPer100km: 16,
  bootLitresSeatsUp: 513,
  bootLitresSeatsDown: 1714,
  seats: 5,
  towKg: 1000,
  warrantyYears: 7,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47],
  sourcedAt: '2026-07-25'
};

test('a complete vehicle row validates', () => {
  assert.equal(validateVehicle(goodVehicle).valid, true);
});

test('a missing required field is reported by name', () => {
  const { bootLitresSeatsUp, ...missing } = goodVehicle;
  const result = validateVehicle(missing);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('bootLitresSeatsUp')));
});

test('a non-numeric price is rejected', () => {
  const result = validateVehicle({ ...goodVehicle, listPrice: '56,000' });
  assert.equal(result.valid, false);
});

test('a depreciation curve must start at 1 and decline', () => {
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [0.9, 0.8] }).valid, false);
  assert.equal(validateVehicle({ ...goodVehicle, depreciationCurve: [1, 0.8, 0.9] }).valid, false);
});

test('a family entry requires summary, pros, cons, sources and images', () => {
  assert.equal(validateFamily({
    id: 'kia-ev5',
    summary: 'Roomy mid-size electric SUV with a big boot.',
    pros: ['Large boot', 'Long warranty', 'Comfortable ride'],
    cons: ['Slow charging', 'Firm seats'],
    sources: ['https://www.carexpert.com.au/kia/ev5'],
    images: ['https://press.kia.com/ev5-front.jpg'],
    sourcedAt: '2026-07-25'
  }).valid, true);

  assert.equal(validateFamily({ id: 'kia-ev5', summary: 'x' }).valid, false);
});

test('every committed vehicle row is valid', () => {
  for (const row of vehicles) {
    const result = validateVehicle(row);
    assert.equal(result.valid, true, `${row.id}: ${result.errors.join(', ')}`);
  }
});

test('every committed family entry is valid', () => {
  for (const entry of families) {
    const result = validateFamily(entry);
    assert.equal(result.valid, true, `${entry.id}: ${result.errors.join(', ')}`);
  }
});

test('every vehicle points at a family that exists', () => {
  const ids = new Set(families.map(f => f.id));
  for (const row of vehicles) {
    assert.ok(ids.has(row.familyId), `${row.id} references missing family ${row.familyId}`);
  }
});

test('loadDataset skips invalid rows rather than throwing', () => {
  const result = loadDataset({
    vehicles: [goodVehicle, { id: 'broken' }],
    families
  });
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].id, 'broken');
});
