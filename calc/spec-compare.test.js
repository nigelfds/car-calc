import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { comparisonRows, ROW_GROUPS, CAVEAT_PRECEDENCE } from './spec-compare.js';

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

const sealion = {
  id: 'sl6', make: 'BYD', model: 'Sealion 6', variant: 'Dynamic ER', bodyType: 'SUV',
  powertrain: 'phev', listPrice: 46990, batteryKwh: 26.6, rangeKm: 140,
  combinedRangeKm: 1340, consumptionKwhPer100km: 19, fuelConsumptionL100km: 5,
  bootLitresSeatsUp: 425, bootLitresSeatsDown: 1200, seats: 5, towKg: 750,
  warrantyYears: 6, insuranceAnnual: 1500,
  depreciationCurve: [1, 0.72, 0.6, 0.5, 0.46, 0.42], sourcedAt: '2026-07-28'
};
const ranger = {
  id: 'rgr', make: 'Ford', model: 'Ranger', variant: 'PHEV Wildtrak', bodyType: 'Ute',
  powertrain: 'phev', listPrice: 86990, batteryKwh: 11.8, rangeKm: 49,
  combinedRangeKm: 800, consumptionKwhPer100km: 24, fuelConsumptionL100km: 8.3,
  bootLitresSeatsUp: 1185, bootLitresSeatsDown: 1185, seats: 5, towKg: 3500,
  warrantyYears: 5, insuranceAnnual: 2400, isNonPassengerForVicDuty: true,
  depreciationCurve: [1, 0.8, 0.7, 0.62, 0.56, 0.5], sourcedAt: '2026-07-28'
};
const sixSeat = { ...modelY, id: 'my6', seats: 6, bootLitresSeatsUp: 536 };

const caveatIds = (model, key) => rowByKey(model, key).caveats.map(c => c.id);

test('mixing a BEV and a PHEV caveats the rows where the numbers mean different things', () => {
  const model = comparisonRows([ev5, sealion], tables);
  assert.deepEqual(caveatIds(model, 'totalRange'), ['mixed-powertrain']);
  assert.deepEqual(caveatIds(model, 'batteryKwh'), ['mixed-powertrain']);
  assert.deepEqual(caveatIds(model, 'energyUse'), ['mixed-powertrain']);
  assert.deepEqual(caveatIds(model, 'petrolUse'), ['mixed-powertrain']);
});

test('the electric range row is like for like and stays uncaveated', () => {
  const model = comparisonRows([ev5, sealion], tables);
  assert.deepEqual(caveatIds(model, 'electricRange'), []);
  assert.equal(rowByKey(model, 'electricRange').winnerIndex, 0);
});

test('an all-electric set caveats nothing', () => {
  const model = comparisonRows([ev5, modelY], tables);
  for (const group of model.groups) {
    for (const row of group.rows) {
      assert.deepEqual(row.caveats, [], `${row.key} should be clean`);
    }
  }
});

test('a caveated row marks no winner', () => {
  const model = comparisonRows([ev5, sealion], tables);
  assert.equal(rowByKey(model, 'totalRange').winnerIndex, null);
  assert.equal(rowByKey(model, 'energyUse').winnerIndex, null);
});

test('the caveat names the car responsible and gives the number', () => {
  const model = comparisonRows([ev5, sealion], tables);
  const [caveat] = rowByKey(model, 'totalRange').caveats;
  assert.match(caveat.text, /Sealion 6/);
  assert.match(caveat.text, /140/);
});

test('any plug-in hybrid caveats the threshold row, even with no BEV present', () => {
  const model = comparisonRows([sealion, ranger], tables);
  assert.deepEqual(caveatIds(model, 'underThreshold'), ['phev-present']);
  assert.match(rowByKey(model, 'underThreshold').caveats[0].text, /1 April 2025/);
});

test('an all-electric set leaves the threshold row alone', () => {
  const model = comparisonRows([ev5, modelY], tables);
  assert.deepEqual(caveatIds(model, 'underThreshold'), []);
});

test('a ute against a non-ute caveats both boot rows', () => {
  const model = comparisonRows([ev5, ranger], tables);
  assert.ok(caveatIds(model, 'bootUp').includes('ute-vs-other'));
  assert.ok(caveatIds(model, 'bootDown').includes('ute-vs-other'));
  assert.match(rowByKey(model, 'bootUp').caveats[0].text, /tray/);
});

test('a ute in the set caveats seats-down, where every ute repeats its seats-up figure', () => {
  const model = comparisonRows([ranger, { ...ranger, id: 'r2', make: 'GWM', model: 'Cannon Alpha' }], tables);
  assert.deepEqual(caveatIds(model, 'bootDown'), ['ute-present']);
  assert.deepEqual(caveatIds(model, 'bootUp'), []);
});

test('differing seat counts caveat the boot rows', () => {
  const model = comparisonRows([ev5, sixSeat], tables);
  assert.deepEqual(caveatIds(model, 'bootUp'), ['mixed-seats']);
  assert.deepEqual(caveatIds(model, 'bootDown'), ['mixed-seats']);
  assert.match(rowByKey(model, 'bootUp').caveats[0].text, /seat/i);
});

test('caveats on one row come back in precedence order', () => {
  // A ute and a six-seat SUV: ute-vs-other, ute-present and mixed-seats all fire.
  const model = comparisonRows([ranger, sixSeat], tables);
  assert.deepEqual(caveatIds(model, 'bootDown'), ['ute-vs-other', 'ute-present', 'mixed-seats']);
  assert.deepEqual(CAVEAT_PRECEDENCE, [
    'ute-vs-other', 'ute-present', 'mixed-seats', 'mixed-powertrain', 'phev-present'
  ]);
});

test('every caveat text is a non-empty sentence', () => {
  const model = comparisonRows([ev5, sealion, ranger], tables);
  const all = model.groups.flatMap(g => g.rows).flatMap(r => r.caveats);
  assert.ok(all.length > 0);
  for (const caveat of all) {
    assert.ok(caveat.text.length > 20, `${caveat.id} text is too short`);
    assert.ok(caveat.text.trim().endsWith('.'), `${caveat.id} should end in a full stop`);
  }
});
