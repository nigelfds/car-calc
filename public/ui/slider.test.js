import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdictAt } from './slider.js';

const tables = JSON.parse(readFileSync(new URL('../../data/tax-tables.json', import.meta.url)));

const vehicle = (id, listPrice) => ({
  id, listPrice, consumptionKwhPer100km: 16, insuranceAnnual: 1850,
  depreciationCurve: [1, 0.78, 0.68, 0.6, 0.53, 0.47]
});

const inputs = {
  grossSalary: 145000, savings: 15000, termMonths: 48, annualKm: 15000,
  leaseStartDate: '2026-07-25', leaseRatePct: 7.5, loanRatePct: 6.5,
  opportunityRatePct: 4.5, adminFeeAnnual: 1020, deposit: 0
};

test('a workable budget produces a winner and a vehicle', () => {
  const fleet = [vehicle('cheap', 40000), vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1000, inputs }, tables);
  assert.ok(v.winner);
  assert.ok(v.vehicle);
});

test('a budget too small for anything yields no winner', () => {
  const fleet = [vehicle('dear', 95000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 50, inputs }, tables);
  assert.equal(v.winner, null);
});

test('the winner is the option with the lowest TCO among the feasible', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs }, tables);
  const feasible = Object.values(v.options).filter(o => o.tco !== null);
  const lowest = feasible.reduce((best, cur) => (cur.tco < best.tco ? cur : best));
  assert.equal(v.winner, lowest.option);
});

test('upfront is excluded when savings cannot cover the car', () => {
  const fleet = [vehicle('mid', 56000)];
  const v = verdictAt({ vehicles: fleet, budgetMonthly: 1200, inputs }, tables);
  assert.equal(v.options.upfront.tco, null);
});
