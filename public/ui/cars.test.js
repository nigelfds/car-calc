import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterVehicles, cardModel, renderCards, datasetStats } from './cars.js';
import { valueRatio } from '../../calc/compare.js';
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

test('the stats line counts brands, models and variants and dates the data', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'a', make: 'Kia', sourcedAt: '2026-07-26' },
      { familyId: 'a', make: 'Kia', sourcedAt: '2026-07-27' },
      { familyId: 'b', make: 'BYD', sourcedAt: '2026-07-20' }
    ],
    families: [{ id: 'a' }, { id: 'b' }]
  });
  assert.equal(stats.brands, 2);
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
  assert.equal(stats.brands, 0);
  assert.equal(stats.models, 0);
  assert.equal(stats.variants, 0);
  assert.equal(stats.updated, null);
});

// Brands and models are different counts and must not be confused: the header
// said "40 cars" for what was really 40 models across 24 brands.
test('one brand with several models counts once as a brand', () => {
  const stats = datasetStats({
    vehicles: [
      { familyId: 'ev3', make: 'Kia', sourcedAt: '2026-07-27' },
      { familyId: 'ev5', make: 'Kia', sourcedAt: '2026-07-27' },
      { familyId: 'ev6', make: 'Kia', sourcedAt: '2026-07-27' }
    ],
    families: [{ id: 'ev3' }, { id: 'ev5' }, { id: 'ev6' }]
  });
  assert.equal(stats.brands, 1);
  assert.equal(stats.models, 3);
  assert.equal(stats.variants, 3);
});

// Same rule as models: a brand present only in families.json, with no rows
// behind it, is one this site cannot show you a car from.
test('a brand with no variants is not counted', () => {
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', make: 'Kia', sourcedAt: '2026-07-27' }],
    families: [{ id: 'a', make: 'Kia' }, { id: 'orphan', make: 'Rivian' }]
  });
  assert.equal(stats.brands, 1, 'Rivian has no variants to show');
});

test('a vehicle with no make does not count as a brand', () => {
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', make: 'Kia' }, { familyId: 'b' }],
    families: [{ id: 'a' }, { id: 'b' }]
  });
  assert.equal(stats.brands, 1);
});

test('models counts families that actually have variants', () => {
  // A family with no rows is not a car anyone can be shown.
  const stats = datasetStats({
    vehicles: [{ familyId: 'a', sourcedAt: '2026-07-27' }],
    families: [{ id: 'a' }, { id: 'orphan' }]
  });
  assert.equal(stats.models, 1);
});

// --- Each card costed under all three funding options ---------------------
// Step 2 no longer names a car, so the cost comparison moved here — and here
// it is a fair one, because all three options price the SAME car.

const costTables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url)));
const costInputs = {
  grossSalary: 145000, savings: 80000, termMonths: 60, annualKm: 15000,
  leaseStartDate: '2026-07-25', deposit: 0, leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, residualPctOverride: null
};
const vehicleFixture = {
  id: 'a', familyId: 'fa', make: 'Kia', model: 'EV5', listPrice: 56000,
  consumptionKwhPer100km: 16, insuranceAnnual: 1850, bootLitresSeatsUp: 513,
  rangeKm: 400, seats: 5, bodyType: 'SUV',
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

test('a card carries the cost of that car under all three options', () => {
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  for (const option of ['novated', 'loan', 'upfront']) {
    assert.equal(typeof card.costs[option].tco, 'number', `${option} must be costed`);
  }
  assert.ok(card.costs.novated.tco < card.costs.loan.tco, 'packaging beats a loan on this salary');
});

test('an unaffordable cash purchase is marked, not silently costed', () => {
  const card = cardModel(vehicleFixture, [], {
    inputs: { ...costInputs, savings: 1000 }, tables: costTables
  });
  assert.equal(card.costs.upfront.feasible, false);
});

test('the card model still works with no costing context', () => {
  const card = cardModel(vehicleFixture, []);
  assert.equal(card.costs, null);
});

// The reason valueRatio survives the rework: across five differently-priced
// cars, the total alone cannot say which holds its value.
test('two similarly-priced cars can differ sharply on value retained', () => {
  const holder = { ...vehicleFixture, id: 'holder', depreciationCurve: [1, 0.9, 0.84, 0.79, 0.75, 0.71] };
  const sinker = { ...vehicleFixture, id: 'sinker', depreciationCurve: [1, 0.6, 0.45, 0.35, 0.28, 0.22] };
  const a = cardModel(holder, [], { inputs: costInputs, tables: costTables });
  const b = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  assert.ok(valueRatio(a.costs.novated) > valueRatio(b.costs.novated) + 0.1,
    'the same price with a very different curve must show a very different ratio');
});

test('renderCards prints all three totals and marks the winning option', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [
    { ...card, bandLabel: 'At your budget', band: 'at', winningOption: 'novated' }
  ]);
  assert.ok(html.includes('car-costs'), 'expected the cost table');
  assert.ok(html.includes('Novated') && html.includes('Loan') && html.includes('Cash'));
  assert.ok(/is-winner/.test(html), 'the winning option must be marked');
  assert.ok(/keeps \d+c/.test(html), 'expected the value-retained figure per option');
});

// --- The lease balloon, back where a car price exists ---------------------
// Step 2 used to disclose the residual, but it no longer names a car, so
// there is nothing to compute one from. It belongs per card. The
// affordability test is still monthly-only, so a five-figure bill on the last
// day of the term is otherwise invisible.

test('a card discloses the balloon on its novated option', () => {
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  assert.ok(card.balloon > 0, 'the residual must be surfaced, not buried in the total');
  assert.equal(card.balloon, card.costs.novated.detail.residual);
});

test('a card flags a balloon the car will not be worth enough to clear', () => {
  const sinker = { ...vehicleFixture, depreciationCurve: [1, 0.4, 0.28, 0.2, 0.15, 0.1] };
  const card = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  assert.ok(card.costs.novated.detail.resale < card.balloon, 'fixture must be underwater');
  assert.equal(card.balloonCovered, false);
});

test('a card that holds its value covers its own balloon', () => {
  const holder = { ...vehicleFixture, depreciationCurve: [1, 0.95, 0.92, 0.9, 0.88, 0.85] };
  const card = cardModel(holder, [], { inputs: costInputs, tables: costTables });
  assert.equal(card.balloonCovered, true);
});

test('no costing context means no balloon rather than a crash', () => {
  const card = cardModel(vehicleFixture, []);
  assert.equal(card.balloon, null);
  assert.equal(card.balloonCovered, null);
});

test('renderCards prints the balloon under the cost table', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const card = cardModel(vehicleFixture, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [{ ...card, bandLabel: 'At your budget' }]);
  assert.ok(/balloon/i.test(html), `expected the balloon named, got: ${html}`);
});

test('an underwater balloon is marked so it reads as a warning', () => {
  let html = '';
  const target = { set innerHTML(v) { html = v; }, get innerHTML() { return html; } };
  const sinker = { ...vehicleFixture, depreciationCurve: [1, 0.4, 0.28, 0.2, 0.15, 0.1] };
  const card = cardModel(sinker, [], { inputs: costInputs, tables: costTables });
  renderCards({ querySelector: () => target }, [{ ...card, bandLabel: 'At your budget' }]);
  assert.ok(/is-short/.test(html), 'a shortfall must be visually distinct from a covered balloon');
});
