import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  representativeProfile, maxAffordablePrice, purchasingPowerSeries, optionEntryPoint
} from './capacity.js';
import { optionCosts } from './compare.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));

const inputs = {
  grossSalary: 145000, savings: 50000, termMonths: 60, annualKm: 15000,
  leaseStartDate: '2026-07-25', deposit: 0, leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020,
  electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, residualPctOverride: null
};

// Matches compare.test.js's helper — the entry-point tests moved here with it.
const vehicle = (id, listPrice) => ({
  id, listPrice, consumptionKwhPer100km: 16, insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.60, 0.53, 0.47]
});

const profile = {
  consumptionKwhPer100km: 16.1,
  insuranceAnnual: 1900,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
};

test('the representative profile is the median of the fleet', () => {
  const fleet = [
    { consumptionKwhPer100km: 14, insuranceAnnual: 1000 },
    { consumptionKwhPer100km: 16, insuranceAnnual: 2000 },
    { consumptionKwhPer100km: 20, insuranceAnnual: 3000 }
  ];
  const got = representativeProfile(fleet);
  assert.equal(got.consumptionKwhPer100km, 16);
  assert.equal(got.insuranceAnnual, 2000);
  assert.ok(Array.isArray(got.depreciationCurve), 'a curve is needed to cost a probe car');
});

test('an empty fleet still yields a usable profile rather than NaN', () => {
  const got = representativeProfile([]);
  assert.ok(got.consumptionKwhPer100km > 0);
  assert.ok(got.insuranceAnnual > 0);
});

test('a bigger budget supports a dearer car on a loan', () => {
  const small = maxAffordablePrice({ budgetMonthly: 700, option: 'loan', inputs, profile }, tables);
  const large = maxAffordablePrice({ budgetMonthly: 1400, option: 'loan', inputs, profile }, tables);
  assert.ok(large > small);
});

// The solver's answer must be a real boundary, not just a number: the price
// it returns has to be affordable, and a step above it must not be.
test('the price returned is affordable and a step above it is not', () => {
  const budget = 900;
  const max = maxAffordablePrice({ budgetMonthly: budget, option: 'loan', inputs, profile }, tables);
  assert.ok(max > 0);

  const monthlyAt = price => {
    const vehicle = { id: 'probe', listPrice: price, ...profile };
    return optionCosts({ vehicle, inputs }, tables).loan.monthlyCost;
  };
  assert.ok(monthlyAt(max) <= budget, 'the returned price must actually fit the budget');
  assert.ok(monthlyAt(max + 500) > budget, 'and $500 more must not');
});

// Cash is bounded by savings, not by the monthly budget, so its capacity is
// a horizontal line — this is the single clearest thing the new chart shows.
test('cash capacity does not move with the monthly budget', () => {
  const low = maxAffordablePrice({ budgetMonthly: 400, option: 'upfront', inputs, profile }, tables);
  const high = maxAffordablePrice({ budgetMonthly: 2700, option: 'upfront', inputs, profile }, tables);
  assert.ok(Math.abs(low - high) < 1, 'savings, not budget, is the constraint');
  assert.ok(low > 40000 && low < 50000, `expected roughly the savings ceiling, got ${low}`);
});

// Above the LCT threshold a novated lease loses its FBT exemption outright,
// so its monthly cost roughly doubles. Capacity therefore stops dead at the
// threshold and stays there until the budget can absorb the unexempted cost.
test('novated capacity plateaus at the FBT threshold', () => {
  const atPlateau = maxAffordablePrice({ budgetMonthly: 1400, option: 'novated', inputs, profile }, tables);
  const wayAbove = maxAffordablePrice({ budgetMonthly: 2200, option: 'novated', inputs, profile }, tables);
  assert.ok(Math.abs(atPlateau - tables.lct.fuelEfficientThreshold) < 200,
    `expected the plateau at the threshold, got ${atPlateau}`);
  assert.equal(atPlateau, wayAbove, 'the plateau holds until the budget clears the unexempted cost');
});

test('a budget too small for anything yields zero capacity', () => {
  const none = maxAffordablePrice({ budgetMonthly: 1, option: 'loan', inputs, profile }, tables);
  assert.ok(none < 1000, `expected effectively nothing, got ${none}`);
});

test('the series produces one point per budget step, with all three options', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, budgetRange: { min: 300, max: 1300, step: 100 } }, tables
  );
  assert.equal(series.points.length, 11);
  for (const point of series.points) {
    assert.ok('budget' in point && 'novated' in point && 'loan' in point && 'upfront' in point);
  }
});

// The meaningful crossover under this model: the budget at which a loan
// starts buying MORE car than a lease capped by the FBT cliff.
test('a crossover is reported where the leading option changes', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, budgetRange: { min: 300, max: 2700, step: 100 } }, tables
  );
  assert.ok(series.crossovers.length > 0, 'loan should overtake novated somewhere in this range');
  for (const crossover of series.crossovers) {
    assert.notEqual(crossover.from, crossover.to);
    assert.ok(crossover.budget >= 300 && crossover.budget <= 2700);
  }
});

test('the leader at a budget is the option supporting the dearest car', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, budgetRange: { min: 900, max: 900, step: 100 } }, tables
  );
  const point = series.points[0];
  const best = ['novated', 'loan', 'upfront'].reduce((a, b) => (point[b] > point[a] ? b : a));
  assert.equal(best, 'novated', 'at $900/mo on this salary the lease buys the most car');
});

// --- Where a line can first appear ---------------------------------------
// A chart line simply begins partway across when nothing is reachable below
// that budget, which reads as missing data rather than as "unaffordable".
// The entry point is the lowest monthly cost any car in the fleet can be had
// for under that option.

test('the entry point is the cheapest monthly cost across the fleet', () => {
  const fleet = [vehicle('a', 40000), vehicle('b', 60000), vehicle('c', 90000)];
  const entry = optionEntryPoint({ vehicles: fleet, inputs, option: 'loan' }, tables);
  const cheapestMonthly = Math.min(
    ...fleet.map(v => optionCosts({ vehicle: v, inputs }, tables).loan.monthlyCost)
  );
  assert.ok(Math.abs(entry.budget - cheapestMonthly) < 1e-9);
});

// The cheapest car to buy is not always the cheapest to run: insurance and
// consumption differ, so a slightly dearer car can carry a lower monthly.
test('the entry car is chosen on monthly cost, not on list price', () => {
  const thirsty = { ...vehicle('cheap-but-thirsty', 40000), insuranceAnnual: 6000 };
  const frugal = { ...vehicle('dearer-but-frugal', 42000), insuranceAnnual: 900 };
  const entry = optionEntryPoint({ vehicles: [thirsty, frugal], inputs, option: 'loan' }, tables);
  assert.equal(entry.vehicle.id, 'dearer-but-frugal');
});

test('cash ignores cars that savings cannot cover', () => {
  // Only the cheap car is within savings, so it must set the entry point even
  // though the dear car would have a lower running-cost-only monthly.
  const tight = { ...inputs, savings: 45000 };
  const fleet = [vehicle('within', 40000), { ...vehicle('beyond', 90000), insuranceAnnual: 500 }];
  const entry = optionEntryPoint({ vehicles: fleet, inputs: tight, option: 'upfront' }, tables);
  assert.equal(entry.vehicle.id, 'within');
});

test('no entry point when nothing is feasible at any budget', () => {
  const broke = { ...inputs, savings: 0 };
  const entry = optionEntryPoint({ vehicles: [vehicle('a', 40000)], inputs: broke, option: 'upfront' }, tables);
  assert.equal(entry, null);
});

test('an empty fleet has no entry point', () => {
  assert.equal(optionEntryPoint({ vehicles: [], inputs, option: 'loan' }, tables), null);
});

test('a shorter term pushes the loan entry point higher', () => {
  const fleet = [vehicle('a', 40000)];
  const short = optionEntryPoint({ vehicles: fleet, inputs: { ...inputs, termMonths: 36 }, option: 'loan' }, tables);
  const long = optionEntryPoint({ vehicles: fleet, inputs: { ...inputs, termMonths: 60 }, option: 'loan' }, tables);
  assert.ok(short.budget > long.budget, 'repaying the same car faster costs more per month');
});

// --- The market floor ------------------------------------------------------
// The solver will happily report "at $400/mo a loan reaches a $3,177 car".
// Arithmetically true, but no such car exists — the cheapest in the dataset is
// $29,840 — so the low end of the curve was fiction, and it contradicted the
// entry marker, which uses real cars and said $882/mo.

test('capacity below the cheapest real car is reported as nothing', () => {
  const floorPrice = 29840;
  const belowFloor = maxAffordablePrice(
    { budgetMonthly: 400, option: 'loan', inputs, profile, floorPrice }, tables
  );
  assert.equal(belowFloor, 0, 'no car exists at this price, so nothing is reachable');
});

test('capacity at or above the floor is unaffected', () => {
  const floorPrice = 29840;
  const withFloor = maxAffordablePrice(
    { budgetMonthly: 1400, option: 'loan', inputs, profile, floorPrice }, tables
  );
  const without = maxAffordablePrice(
    { budgetMonthly: 1400, option: 'loan', inputs, profile }, tables
  );
  assert.ok(withFloor > floorPrice);
  assert.equal(withFloor, without);
});

test('the floor defaults to zero so existing callers are unchanged', () => {
  const a = maxAffordablePrice({ budgetMonthly: 900, option: 'loan', inputs, profile }, tables);
  const b = maxAffordablePrice(
    { budgetMonthly: 900, option: 'loan', inputs, profile, floorPrice: 0 }, tables
  );
  assert.equal(a, b);
});

test('the series applies the floor to every option at every budget', () => {
  const series = purchasingPowerSeries(
    { inputs, profile, floorPrice: 29840, budgetRange: { min: 300, max: 700, step: 100 } }, tables
  );
  for (const point of series.points) {
    for (const option of ['novated', 'loan', 'upfront']) {
      assert.ok(point[option] === 0 || point[option] >= 29840,
        `${option} at $${point.budget} reported ${point[option]}, between zero and the floor`);
    }
  }
});
