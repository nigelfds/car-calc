import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  optionCosts, reachableVehicle,
  isVehicleReachable, reachableVehicles, optionBlocker, valueRatio, fbtCliff
} from './compare.js';
import { forgoneReturn } from './upfront.js';

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

// --- Reachability, shared by the verdict and the shortlist ---------------
// The shortlist used to ignore budget entirely: filterVehicles screened on
// boot/range/seats/body only, and scoreVehicle never saw monthlyBudget. So
// section 3 recommended the same five cars at $400/mo as at $2700/mo, while
// section 2 called them out of reach. One predicate now backs both.

test('a vehicle is reachable when at least one option fits the budget', () => {
  const cheap = vehicle('cheap', 40000);
  assert.equal(isVehicleReachable({ vehicle: cheap, budgetMonthly: 2500, inputs }, tables), true);
});

test('a vehicle nothing can pay for at this budget is not reachable', () => {
  const dear = vehicle('dear', 120000);
  assert.equal(isVehicleReachable({ vehicle: dear, budgetMonthly: 300, inputs }, tables), false);
});

test('reachability tightens as the budget falls', () => {
  const fleet = [vehicle('a', 40000), vehicle('b', 70000), vehicle('c', 120000)];
  const rich = reachableVehicles({ vehicles: fleet, budgetMonthly: 3000, inputs }, tables);
  const poor = reachableVehicles({ vehicles: fleet, budgetMonthly: 600, inputs }, tables);
  assert.ok(rich.length > poor.length, `expected fewer cars at $600/mo, got ${rich.length} vs ${poor.length}`);
  assert.ok(poor.every(v => rich.includes(v)), 'a car reachable on less must stay reachable on more');
});

test('savings alone can make a car reachable when the monthly budget cannot', () => {
  const car = vehicle('a', 56000);
  // Cash has no repayment — only running costs — so a buyer with the money
  // in the bank reaches a car their monthly budget would never finance.
  const broke = isVehicleReachable({ vehicle: car, budgetMonthly: 400, inputs: { ...inputs, savings: 0 } }, tables);
  const funded = isVehicleReachable({ vehicle: car, budgetMonthly: 400, inputs: { ...inputs, savings: 80000 } }, tables);
  assert.equal(broke, false);
  assert.equal(funded, true);
});

test('reachableVehicles preserves input order and returns the same objects', () => {
  const fleet = [vehicle('a', 40000), vehicle('b', 42000)];
  const out = reachableVehicles({ vehicles: fleet, budgetMonthly: 3000, inputs }, tables);
  assert.deepEqual(out.map(v => v.id), ['a', 'b']);
  assert.equal(out[0], fleet[0], 'must not clone — callers rank on identity');
});

// --- Why an option is out of reach ---------------------------------------
// "out of reach" read identically on all three tiles, hiding that the lever
// differs: lease and loan are gated by the monthly budget, cash by savings.

test('an over-budget loan reports the monthly figure it needs', () => {
  const costs = optionCosts({ vehicle: vehicle('a', 90000), inputs }, tables);
  const blocker = optionBlocker(costs.loan, 500);
  assert.equal(blocker.kind, 'budget');
  assert.ok(blocker.needed > 500, 'the figure quoted must be the cost that exceeds the budget');
  assert.equal(blocker.needed, costs.loan.monthlyCost);
});

test('cash reports the savings it needs, not a monthly figure', () => {
  const costs = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  const blocker = optionBlocker(costs.upfront, 5000);
  assert.equal(blocker.kind, 'savings');
  assert.equal(blocker.needed, costs.upfront.detail.driveAway);
});

test('cash is blocked by savings even when its running costs fit the budget', () => {
  const costs = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  assert.ok(costs.upfront.monthlyCost < 5000, 'running costs alone are well inside this budget');
  assert.equal(optionBlocker(costs.upfront, 5000).kind, 'savings');
});

test('an affordable option has no blocker', () => {
  const costs = optionCosts({ vehicle: vehicle('a', 40000), inputs: { ...inputs, savings: 200000 } }, tables);
  assert.equal(optionBlocker(costs.upfront, 5000), null);
  assert.equal(optionBlocker(costs.loan, 5000), null);
});

// --- Value retained per dollar spent -------------------------------------
// The gold-cup winner is no longer "lowest total cost". Each option now
// reaches the dearest car IT can afford, so the three tiles describe
// different cars, and comparing their raw totals would just reward whichever
// option is stuck shopping cheapest. The question that survives across
// different cars is: of everything you spent, how much are you still holding
// at the end of the term?

test('value ratio is resale over gross outlay', () => {
  const costs = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  const ratio = valueRatio(costs.loan);
  assert.ok(ratio > 0);
  // Against the gross, deliberately: dividing by tco would put resale on both
  // sides of the division, since tco is already net of it.
  assert.ok(Math.abs(ratio - costs.loan.detail.resale / costs.loan.detail.grossOutlay) < 1e-9);
  assert.ok(ratio < 1, 'you cannot end up holding more than you paid out');
});

test('spending less for the same car retained gives a better ratio', () => {
  const car = vehicle('a', 56000);
  const cheapFinance = optionCosts({ vehicle: car, inputs: { ...inputs, loanRatePct: 1 } }, tables);
  const dearFinance = optionCosts({ vehicle: car, inputs: { ...inputs, loanRatePct: 15 } }, tables);
  assert.ok(valueRatio(cheapFinance.loan) > valueRatio(dearFinance.loan),
    'a cheaper loan on the identical car must score better');
});

test('an option that cannot reach a car has no value ratio', () => {
  assert.equal(valueRatio(null), null);
});

// Gross outlay is the divisor now, so a zero or missing one is the only case
// that could produce Infinity or NaN.
test('a non-positive gross outlay yields no ratio rather than Infinity', () => {
  assert.equal(valueRatio({ tco: 0, detail: { resale: 1000, grossOutlay: 0 } }), null);
  assert.equal(valueRatio({ tco: 0, detail: { resale: 1000 } }), null);
  assert.equal(valueRatio({ tco: -500, detail: { resale: 1000 } }), null);
});

// --- The FBT cliff --------------------------------------------------------
// calc/fbt.js treats the LCT fuel-efficient threshold as a hard edge: one
// dollar over and the lease loses its exemption outright (exempt: false,
// discountRate: 0). The monthly cost roughly doubles across that dollar, so
// a novated lease simply cannot reach the next car up until the budget more
// than doubles too — which is why the novated line on the chart plateaus.

test('the cliff sits at the LCT threshold for a lease starting today', () => {
  const fleet = [vehicle('under', 90000), vehicle('over', 95000)];
  const cliff = fbtCliff({ vehicles: fleet, inputs }, tables);
  assert.equal(cliff.cliffPrice, tables.lct.fuelEfficientThreshold);
});

test('crossing the cliff costs far more per month than the price step suggests', () => {
  const fleet = [vehicle('under', 91000), vehicle('over', 92000)];
  const cliff = fbtCliff({ vehicles: fleet, inputs }, tables);
  assert.equal(cliff.carBelow.id, 'under');
  assert.equal(cliff.carAbove.id, 'over');
  // $1,000 more car, but the monthly ask must jump by far more than that.
  assert.ok(cliff.budgetNeeded > cliff.budgetAt * 1.5,
    `expected a steep jump, got ${cliff.budgetAt} -> ${cliff.budgetNeeded}`);
});

test('a lease starting after April 2027 has its cliff at the phase cap instead', () => {
  const fleet = [vehicle('under', 70000), vehicle('over', 80000)];
  const later = { ...inputs, leaseStartDate: '2027-06-01' };
  const cliff = fbtCliff({ vehicles: fleet, inputs: later }, tables);
  assert.equal(cliff.cliffPrice, 75000, 'the 2027 phase caps full exemption at $75,000');
});

test('no cliff is reported when every car sits on one side of it', () => {
  assert.equal(fbtCliff({ vehicles: [vehicle('a', 50000), vehicle('b', 60000)], inputs }, tables), null);
  assert.equal(fbtCliff({ vehicles: [vehicle('a', 95000), vehicle('b', 99000)], inputs }, tables), null);
});

test('the cliff names the dearest car below it and the cheapest above', () => {
  const fleet = [
    vehicle('cheap', 40000), vehicle('best-below', 90000),
    vehicle('first-above', 93000), vehicle('way-above', 120000)
  ];
  const cliff = fbtCliff({ vehicles: fleet, inputs }, tables);
  assert.equal(cliff.carBelow.id, 'best-below');
  assert.equal(cliff.carAbove.id, 'first-above');
});

test('an empty fleet reports no cliff rather than throwing', () => {
  assert.equal(fbtCliff({ vehicles: [], inputs }, tables), null);
});

// --- Gross outlay, and the value ratio that depends on it -----------------
// valueRatio originally divided resale by tco. But tco is already net of
// resale, so resale appeared on both sides of the division: the ratio was
// resale / (gross - resale), which climbs without bound as the net cost
// approaches zero. A $1.5m earner packaging an EQB produced "121c of every
// $1 spent" — you cannot retain more than you spent.

test('every option reports the gross amount that actually leaves your pocket', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables);
  for (const option of ['novated', 'loan', 'upfront']) {
    assert.ok(c[option].detail.grossOutlay > 0, `${option} must report a gross outlay`);
    // The invariant that keeps the two figures honest with each other.
    assert.ok(
      Math.abs(c[option].tco - (c[option].detail.grossOutlay - c[option].detail.resale)) < 1e-6,
      `${option}: tco must be gross outlay minus resale`
    );
  }
});

test('the novated gross outlay includes the residual balloon', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables).novated;
  const years = inputs.termMonths / 12;
  assert.ok(Math.abs(c.detail.grossOutlay - (c.detail.netAnnualCost * years + c.detail.residual)) < 1e-6,
    'the balloon is money that leaves your pocket and must be in the gross');
});

test('the value ratio measures resale against gross outlay, not against net cost', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables).loan;
  assert.ok(Math.abs(valueRatio(c) - c.detail.resale / c.detail.grossOutlay) < 1e-9);
});

// The reported case: $1.5m salary, 36-month term, so the pre-tax saving is
// enormous and the net cost collapses. The ratio must stay a proportion.
test('a very high earner cannot retain more than they spent', () => {
  const rich = { ...inputs, grossSalary: 1500000, termMonths: 36, leaseRatePct: 6.5 };
  const c = optionCosts({ vehicle: vehicle('a', 90000), inputs: rich }, tables);
  for (const option of ['novated', 'loan', 'upfront']) {
    const ratio = valueRatio(c[option]);
    if (ratio === null) continue;
    assert.ok(ratio > 0 && ratio <= 1,
      `${option} ratio ${ratio} must be a proportion of what was spent`);
  }
});

test('a ratio is still reported when the net cost is zero or negative', () => {
  // tco <= 0 used to return null, hiding exactly the cases that mattered.
  // Gross outlay is always positive, so the ratio survives.
  const rich = { ...inputs, grossSalary: 1500000, termMonths: 36 };
  const c = optionCosts({ vehicle: vehicle('a', 45000), inputs: rich }, tables).novated;
  assert.notEqual(valueRatio(c), null);
});

// --- Opportunity cost on a loan deposit -----------------------------------
// A deposit is cash pulled out of savings, exactly like an upfront purchase:
// it stops earning the moment it is handed over. Cash was charged for that
// and a deposit was not, so any deposit made a loan look cheaper than it is,
// by more as the deposit grew.

test('a loan deposit carries the same forgone return a cash purchase does', () => {
  const withDeposit = optionCosts(
    { vehicle: vehicle('a', 56000), inputs: { ...inputs, deposit: 10000 } }, tables
  ).loan;
  const expected = forgoneReturn({
    amount: 10000, opportunityRatePct: inputs.opportunityRatePct, termMonths: inputs.termMonths
  });
  assert.ok(Math.abs(withDeposit.detail.depositOpportunityCost - expected) < 1e-9);
});

test('no deposit means no deposit opportunity cost', () => {
  const c = optionCosts({ vehicle: vehicle('a', 56000), inputs }, tables).loan;
  assert.equal(c.detail.depositOpportunityCost, 0);
});

test('the deposit forgone return is inside the loan gross outlay', () => {
  const c = optionCosts(
    { vehicle: vehicle('a', 56000), inputs: { ...inputs, deposit: 10000 } }, tables
  ).loan;
  const parts = c.detail.totalRepaid + 10000 + c.detail.runningCostsTotal + c.detail.depositOpportunityCost;
  assert.ok(Math.abs(c.detail.grossOutlay - parts) < 1e-6);
  // And the invariant that binds gross to net still holds.
  assert.ok(Math.abs(c.tco - (c.detail.grossOutlay - c.detail.resale)) < 1e-6);
});

test('the charge scales with the size of the deposit', () => {
  const car = vehicle('a', 56000);
  const small = optionCosts({ vehicle: car, inputs: { ...inputs, deposit: 5000 } }, tables).loan;
  const large = optionCosts({ vehicle: car, inputs: { ...inputs, deposit: 20000 } }, tables).loan;
  assert.ok(large.detail.depositOpportunityCost > small.detail.depositOpportunityCost * 3.9,
    'four times the deposit forgoes four times the return');
});

// Whether a deposit is worth making is NOT simply "loan rate beats savings
// rate". An amortising loan charges interest on a falling balance, so its
// total interest over the term is a much smaller multiple of principal than
// compound growth on the same sum left untouched. The deposit is worth making
// only when the savings growth multiplier is below the loan's repayment
// multiplier — at the default rates over four years that is 1.1925 against
// 1.1383, so a deposit costs about $1,084 more than it saves.
test('a deposit helps only when savings growth is below the repayment multiplier', () => {
  const car = vehicle('a', 56000);
  // Savings at 1%: growth 1.0406, well under the 1.1383 repayment multiplier.
  const lowReturn = { ...inputs, opportunityRatePct: 1 };
  const noneLow = optionCosts({ vehicle: car, inputs: { ...lowReturn, deposit: 0 } }, tables).loan;
  const someLow = optionCosts({ vehicle: car, inputs: { ...lowReturn, deposit: 20000 } }, tables).loan;
  assert.ok(someLow.tco < noneLow.tco, 'with savings earning almost nothing, a deposit pays');

  // Savings at 8% against a 1% loan: growth far exceeds the interest avoided.
  const highReturn = { ...inputs, loanRatePct: 1, opportunityRatePct: 8 };
  const noneHigh = optionCosts({ vehicle: car, inputs: { ...highReturn, deposit: 0 } }, tables).loan;
  const someHigh = optionCosts({ vehicle: car, inputs: { ...highReturn, deposit: 20000 } }, tables).loan;
  assert.ok(someHigh.tco > noneHigh.tco, 'tying up cash at 8% to dodge 1% interest is a loss');
});

// Guards the counterintuitive default case, so nobody "fixes" it back later:
// at the shipped rates a deposit is mildly counterproductive, and that is the
// arithmetic rather than a bug.
test('at the default rates a deposit slightly raises the total', () => {
  const car = vehicle('a', 56000);
  const none = optionCosts({ vehicle: car, inputs: { ...inputs, deposit: 0 } }, tables).loan;
  const some = optionCosts({ vehicle: car, inputs: { ...inputs, deposit: 20000 } }, tables).loan;
  assert.ok(some.tco > none.tco);
  assert.ok(some.tco - none.tco < 2000, 'but only mildly — this is a close call, not a blowout');
});
