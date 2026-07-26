import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { optionCosts } from './compare.js';
import { netIncome } from './tax.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

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

const ev5 = {
  id: 'kia-ev5-air',
  listPrice: 56000,
  consumptionKwhPer100km: 16,
  insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.60, 0.53, 0.47]
};

test('GOLDEN: a $145k earner takes home $107,380 a year', () => {
  close(netIncome({ grossSalary: 145000 }, tables).netAnnual, 107380);
});

test('GOLDEN: Kia EV5 Air drive-away in Victoria is $59,232', () => {
  close(optionCosts({ vehicle: ev5, inputs }, tables).novated.detail.driveAway, 59232);
});

test('GOLDEN: the 48-month residual is 37.5% of the car price, not the drive-away price', () => {
  // $21,000, not $22,212 — stamp duty and rego are excluded from the residual base.
  close(optionCosts({ vehicle: ev5, inputs }, tables).novated.detail.residual, 56000 * 0.375);
});

test('GOLDEN: novated beats loan, and upfront is out of reach on $15k savings', () => {
  const c = optionCosts({ vehicle: ev5, inputs }, tables);
  assert.ok(c.novated.tco < c.loan.tco, 'novated is cheapest');
  assert.equal(c.upfront.feasible, false, 'upfront is out of reach on $15k savings');
});

test('GOLDEN: crossing the LCT threshold shrinks the novated advantage', () => {
  const dear = { ...ev5, listPrice: 95000 };
  const c = optionCosts({ vehicle: dear, inputs }, tables);
  const gap = c.loan.tco - c.novated.tco;
  const cheapGap = (() => {
    const cheap = optionCosts({ vehicle: ev5, inputs }, tables);
    return cheap.loan.tco - cheap.novated.tco;
  })();
  assert.ok(gap < cheapGap, 'the novated advantage shrinks above the threshold');
});

test('GOLDEN: FBT phase-2 discount switches on at the 2027-04-01 boundary', () => {
  // $85,000 sits between the phase-2 exemption cap ($75,000) and the LCT
  // fuel-efficient threshold ($91,661), so it is fully exempt right up to
  // 2027-03-31 and picks up the 25% phase-2 discount from 2027-04-01.
  const dear = { ...ev5, listPrice: 85000 };
  const dayBefore = optionCosts(
    { vehicle: dear, inputs: { ...inputs, leaseStartDate: '2027-03-31' } },
    tables
  );
  const dayOf = optionCosts(
    { vehicle: dear, inputs: { ...inputs, leaseStartDate: '2027-04-01' } },
    tables
  );

  close(dayBefore.novated.detail.annualPostTaxContribution, 0);
  assert.ok(
    dayOf.novated.detail.annualPostTaxContribution > 0,
    'a post-tax contribution applies once phase 2 starts'
  );
  assert.ok(
    dayOf.novated.tco > dayBefore.novated.tco,
    'the post-tax contribution makes novated strictly more expensive'
  );

  // Taxable value is 20% of the $85,000 base value, reduced by phase 2's
  // 25% discount: 85000 * 0.20 * (1 - 0.25) = 12,750.
  close(dayOf.novated.detail.annualPostTaxContribution, 12750);
});
