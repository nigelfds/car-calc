import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optionCosts, reachableVehicle, crossoverSeries } from './compare.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));

const vehicle = (id, listPrice) => ({
  id,
  listPrice,
  consumptionKwhPer100km: 16,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.60, 0.53, 0.47]
});

const inputs = {
  grossSalary: 145000,
  savings: 15000,
  termMonths: 48,
  annualKm: 15000,
  leaseStartDate: '2026-07-25',
  leaseRatePct: 7.5,
  loanRatePct: 6.5,
  opportunityRatePct: 4.5,
  adminFeeAnnual: 1020,
  deposit: 0,
  electricityCentsPerKwh: 28,
  otherRunningCostsAnnual: 1240
};

test('all three options are costed for one vehicle', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.ok(c.novated.tco > 0 && c.loan.tco > 0 && c.upfront.tco > 0);
});

test('TCO subtracts the resale value the user is left holding', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  const grossOutflow = c.loan.detail.totalRepaid + c.loan.detail.runningCostsTotal;
  assert.ok(c.loan.tco < grossOutflow, 'resale value is credited back');
});

test('upfront is infeasible when savings cannot cover the car', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.equal(c.upfront.feasible, false);

  const rich = optionCosts({ vehicle: vehicle('a', 56000), inputs: { ...inputs, savings: 80000 } }, tables);
  assert.equal(rich.upfront.feasible, true);
});

test('a novated lease beats a direct loan for a 37% earner on a cheap EV', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.ok(c.novated.tco < c.loan.tco, 'pre-tax packaging wins under the threshold');
});

test('reachableVehicle picks the dearest variant within budget', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000), vehicle('dear', 95000)];
  const picked = reachableVehicle({ vehicles: fleet, budgetMonthly: 1000, option: 'novated', inputs }, tables);
  assert.ok(picked, 'something is affordable at $1000/mo');
  assert.notEqual(picked.id, 'cheap', 'it does not settle for the cheapest');
});

test('reachableVehicle returns null when nothing fits', () => {
  const fleet = [vehicle('dear', 95000)];
  const picked = reachableVehicle({ vehicles: fleet, budgetMonthly: 200, option: 'loan', inputs }, tables);
  assert.equal(picked, null);
});

test('the crossover series produces a point per budget step', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000), vehicle('dear', 95000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs, budgetRange: { min: 400, max: 1600, step: 100 } },
    tables
  );
  assert.equal(series.points.length, 13);
  assert.ok(series.points.every(p => 'budget' in p && 'novated' in p && 'loan' in p));
});

test('the upfront line is flat because savings, not budget, bound it', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs: { ...inputs, savings: 60000 }, budgetRange: { min: 400, max: 1600, step: 400 } },
    tables
  );
  const upfrontValues = series.points.map(p => p.upfront).filter(v => v !== null);
  assert.ok(upfrontValues.length > 1);
  assert.ok(upfrontValues.every(v => Math.abs(v - upfrontValues[0]) < 0.01), 'flat across budgets');
});

test('crossovers are reported where the leading option changes', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000), vehicle('dear', 95000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs, budgetRange: { min: 400, max: 2500, step: 50 } },
    tables
  );
  assert.ok(Array.isArray(series.crossovers));
  for (const c of series.crossovers) {
    assert.ok(c.budget >= 400 && c.budget <= 2500);
    assert.notEqual(c.from, c.to);
  }
});

// I5: electricityCentsPerKwh/otherRunningCostsAnnual used to be hardcoded
// inside this module (RATE_DEFAULTS), so editing data/rates.json — or a
// user's own edit in the rates panel — had no effect at all. They must
// flow through as plain arguments, like every other rate.
test('running-cost rates arrive as arguments, not a hardcoded default', () => {
  const v = vehicle('a', 56000);
  const cheap = optionCosts({ vehicle: v, inputs }, tables);
  const pricier = optionCosts({
    vehicle: v,
    inputs: { ...inputs, electricityCentsPerKwh: 60, otherRunningCostsAnnual: 5000 }
  }, tables);

  assert.ok(pricier.loan.detail.runningCostsTotal > cheap.loan.detail.runningCostsTotal,
    'raising the running-cost rates must raise the costed total');
  assert.notEqual(pricier.novated.tco, cheap.novated.tco);
});

test('fractional steps include the endpoint', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000)];
  const series = crossoverSeries(
    { vehicles: fleet, inputs, budgetRange: { min: 400, max: 401, step: 0.1 } },
    tables
  );
  assert.equal(series.points.length, 11, 'min 400, max 401, step 0.1 should yield 11 points');
  const lastBudget = series.points[series.points.length - 1].budget;
  assert.ok(Math.abs(lastBudget - 401) < 0.0001, 'last point budget should be 401');
});
