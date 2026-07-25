import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePhase, fbtTreatment, annualFbt } from './fbt.js';

const tables = JSON.parse(readFileSync(new URL('../data/tax-tables.json', import.meta.url)));
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

test('a lease starting today is in the full-exemption phase', () => {
  assert.equal(resolvePhase('2026-07-25', tables).discountRate, 0);
});

test('phase boundaries are inclusive of their start date', () => {
  assert.equal(resolvePhase('2027-03-31', tables).fullExemptionUpTo, null);
  assert.equal(resolvePhase('2027-04-01', tables).fullExemptionUpTo, 75000);
  assert.equal(resolvePhase('2029-04-01', tables).fullExemptionUpTo, 0);
});

test('phase 1 exempts any car under the LCT threshold', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 85000 }, tables);
  assert.equal(t.exempt, true);
});

test('a car above the LCT threshold is never exempt', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 95000 }, tables);
  assert.equal(t.exempt, false);
  assert.equal(t.overThreshold, true);
});

test('phase 2 exempts under 75k but discounts above it', () => {
  const cheap = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 70000 }, tables);
  assert.equal(cheap.exempt, true);

  const dear = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 85000 }, tables);
  assert.equal(dear.exempt, false);
  assert.equal(dear.discountRate, 0.25);
});

test('an exempt treatment produces no FBT', () => {
  const treatment = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 56000 }, tables);
  close(annualFbt({ baseValue: 56000, treatment }, tables), 0);
});

test('a discounted treatment produces 75% of full FBT', () => {
  const treatment = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 85000 }, tables);
  const expected = 85000 * 0.20 * 0.75 * 2.0802 * 0.47;
  close(annualFbt({ baseValue: 85000, treatment }, tables), expected);
});

test('phase 2 exemption cap at $75,000 is inclusive', () => {
  const atCap = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 75000 }, tables);
  assert.equal(atCap.exempt, true);
});

test('phase 2 cars above $75,000 cap lose exemption and get 25% discount', () => {
  const aboveCap = fbtTreatment({ leaseStartDate: '2027-06-01', vehicleValue: 75001 }, tables);
  assert.equal(aboveCap.exempt, false);
  assert.equal(aboveCap.discountRate, 0.25);
});

test('LCT threshold test is exclusive - car at exactly threshold is exempt', () => {
  const atThreshold = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: tables.lct.fuelEfficientThreshold }, tables);
  assert.equal(atThreshold.exempt, true);
  assert.equal(atThreshold.overThreshold, false);
});

test('LCT threshold test is exclusive - car above threshold is not exempt', () => {
  const aboveThreshold = fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: tables.lct.fuelEfficientThreshold + 1 }, tables);
  assert.equal(aboveThreshold.exempt, false);
  assert.equal(aboveThreshold.overThreshold, true);
});

test('over-threshold cars pay same FBT in phase 1 and phase 3', () => {
  const phase1 = annualFbt({ baseValue: 95000, treatment: fbtTreatment({ leaseStartDate: '2026-07-25', vehicleValue: 95000 }, tables) }, tables);
  const phase3 = annualFbt({ baseValue: 95000, treatment: fbtTreatment({ leaseStartDate: '2029-06-01', vehicleValue: 95000 }, tables) }, tables);
  close(phase1, phase3);
});
