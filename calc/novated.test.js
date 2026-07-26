import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gstCredit, residualAmount, novatedQuote } from './novated.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

const base = {
  driveAwayTotal: 59232,
  termMonths: 48,
  leaseRatePct: 7.5,
  adminFeeAnnual: 1020,
  runningCostsAnnualIncGst: 3762,
  runningCostsAnnualExGst: 3420,
  leaseStartDate: '2026-07-25',
  vehicleValue: 56000,
  grossSalary: 145000,
  residualPctOverride: null
};

test('GST credit is one eleventh, capped at the car limit', () => {
  close(gstCredit(59232, tables), 5384.73);
  close(gstCredit(120000, tables), 6353);
});

test('residual uses the ATO minimum for the term', () => {
  close(residualAmount({ vehicleCost: 56000, termMonths: 48 }, tables), 21000);
  close(residualAmount({ vehicleCost: 56000, termMonths: 60 }, tables), 15752.8);
});

test('a residual override above the minimum is accepted', () => {
  close(residualAmount({ vehicleCost: 56000, termMonths: 48, residualPctOverride: 0.45 }, tables), 25200);
});

test('a residual override below the ATO minimum is clamped up', () => {
  close(residualAmount({ vehicleCost: 56000, termMonths: 48, residualPctOverride: 0.20 }, tables), 21000);
});

test('an FBT-exempt lease carries no post-tax contribution', () => {
  const q = novatedQuote(base, tables);
  close(q.annualFbt, 0);
  close(q.annualPostTaxContribution, 0);
});

test('financed amount excludes the GST credit', () => {
  const q = novatedQuote(base, tables);
  close(q.financedAmount, 59232 - 5384.73);
});

test('net monthly cost is less than the pre-tax deduction for a 37% earner', () => {
  const q = novatedQuote(base, tables);
  const preTaxMonthly = q.annualPreTaxDeduction / 12;
  assert.ok(q.netMonthlyCost < preTaxMonthly, 'packaging costs less than it deducts');
  assert.ok(q.netMonthlyCost > preTaxMonthly * 0.5, 'but the saving is not more than the tax rate');
});

test('a car over the LCT threshold attracts FBT and a post-tax contribution', () => {
  const dear = { ...base, vehicleValue: 95000, driveAwayTotal: 101000 };
  const q = novatedQuote(dear, tables);
  assert.ok(q.annualFbt > 0, 'FBT applies above the threshold');
  assert.ok(q.annualPostTaxContribution > 0, 'contributions reduce it to nil');
});

test('a lease starting after 1 April 2027 loses the exemption above 75k', () => {
  const before = novatedQuote({ ...base, vehicleValue: 85000, driveAwayTotal: 90000, leaseStartDate: '2027-03-31' }, tables);
  const after = novatedQuote({ ...base, vehicleValue: 85000, driveAwayTotal: 90000, leaseStartDate: '2027-04-01' }, tables);
  close(before.annualPostTaxContribution, 0);
  assert.ok(after.annualPostTaxContribution > 0, 'phase 2 bites one day later');
  assert.ok(after.netMonthlyCost > before.netMonthlyCost, 'and it costs the user real money');
});
