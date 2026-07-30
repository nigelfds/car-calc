import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparisonRows, ROW_GROUPS } from './spec-compare.js';

const tables = JSON.parse(
  readFileSync(new URL('../data/tax-tables.json', import.meta.url), 'utf8')
);

const ev5 = {
  id: 'ev5', make: 'Kia', model: 'EV5', variant: 'Air 2WD LR', bodyType: 'SUV',
  listPrice: 61170, batteryKwh: 88.1, rangeKm: 555, consumptionKwhPer100km: 18,
  bootLitresSeatsUp: 513, bootLitresSeatsDown: 1450, seats: 5, towKg: 1250,
  warrantyYears: 7, insuranceAnnual: 1800,
  depreciationCurve: [1, 0.78, 0.66, 0.57, 0.51, 0.47], sourcedAt: '2026-07-27'
};
const modelY = {
  id: 'my', make: 'Tesla', model: 'Model Y', variant: 'Premium LR AWD', bodyType: 'SUV',
  listPrice: 68900, batteryKwh: 79, rangeKm: 600, consumptionKwhPer100km: 13.5,
  bootLitresSeatsUp: 854, bootLitresSeatsDown: 2100, seats: 5, towKg: 1588,
  warrantyYears: 5, insuranceAnnual: 2550,
  depreciationCurve: [1, 0.74, 0.62, 0.53, 0.47, 0.42], sourcedAt: '2026-07-27'
};

const rowByKey = (model, key) =>
  model.groups.flatMap(g => g.rows).find(r => r.key === key);

test('values are index-aligned with the vehicles passed in', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'listPrice').values, [61170, 68900]);
  assert.deepEqual(rowByKey(model, 'seats').values, [5, 5]);
});

test('a lower-is-better row picks the smallest', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.equal(rowByKey(model, 'listPrice').winnerIndex, 0);
  assert.equal(rowByKey(model, 'insuranceAnnual').winnerIndex, 0);
});

test('a higher-is-better row picks the largest', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.equal(rowByKey(model, 'bootUp').winnerIndex, 1);
  assert.equal(rowByKey(model, 'warrantyYears').winnerIndex, 0);
});

test('a tie marks no winner', () => {
  const model = comparisonRows([ev5, { ...modelY, listPrice: 61170 }], tables);
  assert.equal(rowByKey(model, 'listPrice').winnerIndex, null);
});

test('rows with no meaningful direction never mark a winner', () => {
  const model = comparisonRows([ev5, modelY], tables);
  for (const key of ['bodyType', 'seats', 'powertrain', 'underThreshold', 'sourcedAt']) {
    assert.equal(rowByKey(model, key).winnerIndex, null, `${key} should not mark a winner`);
  }
});

test('a battery-electric car reports the same figure for electric and total range', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'electricRange').values, [555, 600]);
  assert.deepEqual(rowByKey(model, 'totalRange').values, [555, 600]);
});

test('resale reads the sixth point of the depreciation curve', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'resale5yr').values, [0.47, 0.42]);
  assert.equal(rowByKey(model, 'resale5yr').winnerIndex, 0);
});

test('drive-away adds Victorian duty and one year of rego, and excludes LCT', () => {
  const model = comparisonRows([ev5, modelY], tables);
  const [kia] = rowByKey(model, 'driveAway').values;
  // LCT is embedded in the list price, so it is never added on top.
  assert.ok(kia > 61170, 'duty and rego should lift it above list');
  assert.ok(kia < 66000, 'nothing like an LCT-sized addition should appear');
});

test('the threshold row is a plain price test against the tables', () => {
  const dear = { ...modelY, listPrice: 95000 };
  const model = comparisonRows([ev5, dear], tables);
  assert.deepEqual(rowByKey(model, 'underThreshold').values, ['Yes', 'No']);
});

test('the petrol row is omitted when nothing in the set burns petrol', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.equal(rowByKey(model, 'petrolUse'), undefined);
});

test('every group carries a label and at least one row', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(model.groups.map(g => g.key), ROW_GROUPS.map(g => g.key));
  for (const group of model.groups) {
    assert.ok(group.label.length > 0);
    assert.ok(group.rows.length > 0);
  }
});

test('three cars work as well as two', () => {
  const cheap = { ...ev5, id: 'c', make: 'BYD', model: 'Dolphin', listPrice: 29840 };
  const model = comparisonRows([ev5, modelY, cheap], tables);
  assert.equal(rowByKey(model, 'listPrice').values.length, 3);
  assert.equal(rowByKey(model, 'listPrice').winnerIndex, 2);
});

test('caveats are an empty array when nothing is amiss', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(rowByKey(model, 'listPrice').caveats, []);
});
