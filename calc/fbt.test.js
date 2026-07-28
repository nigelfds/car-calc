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

test('a BEV under the threshold is exempt, as before', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000 }, tables);
  assert.equal(t.exempt, true);
  assert.equal(t.phevIneligible, false);
});

test('a PHEV leased after 1 April 2025 is not exempt at any price', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'phev' }, tables);
  assert.equal(t.exempt, false);
  assert.equal(t.phevIneligible, true);
  assert.equal(t.discountRate, 0, 'not a discount — the exemption is simply gone');
});

// The cut-off is a date, not a blanket rule, and the tables own it.
test('a PHEV leased before the cut-off keeps the exemption', () => {
  const t = fbtTreatment({ leaseStartDate: '2025-03-31', vehicleValue: 60000, powertrain: 'phev' }, tables);
  assert.equal(t.exempt, true);
  assert.equal(t.phevIneligible, false);
});

// C1: that exemption rests on a binding commitment having been in place by
// 1 April 2025, which nothing in the inputs can confirm — so the treatment
// has to say the exemption came from the date, or the UI cannot disclose it.
test('a PHEV exempt only because of an early lease date says so', () => {
  const t = fbtTreatment({ leaseStartDate: '2025-03-31', vehicleValue: 60000, powertrain: 'phev' }, tables);
  assert.equal(t.phevExemptByDate, true);
});

test('a PHEV leased after the cut-off is not exempt by date', () => {
  const t = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'phev' }, tables);
  assert.equal(t.phevExemptByDate, false);
  assert.equal(t.phevIneligible, true);
});

// A BEV's exemption has nothing to do with the PHEV cut-off, whatever the
// date — flagging one would put a plug-in hybrid caveat on an EV card.
test('a BEV is never exempt by date, either side of the cut-off', () => {
  for (const leaseStartDate of ['2025-03-31', '2026-08-01']) {
    const t = fbtTreatment({ leaseStartDate, vehicleValue: 60000 }, tables);
    assert.equal(t.exempt, true);
    assert.equal(t.phevExemptByDate, false, leaseStartDate);
  }
});

// Over the LCT threshold there is no exemption to explain, so the caveat
// would be describing a treatment the car did not get.
test('a dear PHEV before the cut-off is not exempt, and not flagged as exempt by date', () => {
  const t = fbtTreatment({ leaseStartDate: '2025-03-31', vehicleValue: 95000, powertrain: 'phev' }, tables);
  assert.equal(t.exempt, false);
  assert.equal(t.phevExemptByDate, false);
});

test('an omitted powertrain is treated as a BEV', () => {
  const without = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000 }, tables);
  const explicit = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'bev' }, tables);
  assert.deepEqual(without, explicit);
});

// An ineligible PHEV pays real FBT, which is the whole point.
test('an ineligible PHEV accrues FBT where an equivalent BEV accrues none', () => {
  const phev = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'phev' }, tables);
  const bev = fbtTreatment({ leaseStartDate: '2026-08-01', vehicleValue: 60000, powertrain: 'bev' }, tables);
  assert.ok(annualFbt({ baseValue: 60000, treatment: phev }, tables) > 0);
  assert.equal(annualFbt({ baseValue: 60000, treatment: bev }, tables), 0);
});
