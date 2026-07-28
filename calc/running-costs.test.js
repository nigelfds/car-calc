import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runningCosts } from './running-costs.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const vehicle = { consumptionKwhPer100km: 16, insuranceAnnual: 1850 };
const rates = { electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240, petrolCentsPerLitre: 195 };

test('electricity is consumption times distance times price', () => {
  const c = runningCosts({ vehicle, annualKm: 15000, rates });
  close(c.electricity, 672);
});

test('total includes insurance, electricity and other costs', () => {
  const c = runningCosts({ vehicle, annualKm: 15000, rates });
  close(c.totalIncGst, 1850 + 672 + 1240);
});

test('GST-exclusive total is the inclusive total less one eleventh', () => {
  const c = runningCosts({ vehicle, annualKm: 15000, rates });
  close(c.totalExGst, c.totalIncGst * 10 / 11);
});

const phev = {
  powertrain: 'phev', consumptionKwhPer100km: 21.5, fuelConsumptionL100km: 6.8,
  insuranceAnnual: 1700
};

test('a BEV burns no petrol whatever the battery share says', () => {
  const bev = { consumptionKwhPer100km: 16, insuranceAnnual: 1600 };
  const costs = runningCosts({ vehicle: bev, annualKm: 15000, batterySharePct: 40, rates });
  assert.equal(costs.petrol, 0, 'a BEV has no combustion side to run');
  assert.equal(costs.electricity, (16 / 100) * 15000 * 0.28);
});

test('a PHEV at 100% battery share burns no petrol', () => {
  const costs = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 100, rates });
  assert.equal(costs.petrol, 0);
  assert.equal(costs.electricity, (21.5 / 100) * 15000 * 0.28);
});

test('a PHEV at 0% battery share runs entirely on petrol', () => {
  const costs = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 0, rates });
  assert.equal(costs.electricity, 0);
  assert.equal(costs.petrol, (6.8 / 100) * 15000 * 1.95);
});

test('the split is proportional to the battery share', () => {
  const costs = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 60, rates });
  assert.equal(costs.electricity, (21.5 / 100) * 9000 * 0.28);
  assert.equal(costs.petrol, (6.8 / 100) * 6000 * 1.95);
});

// The share is the biggest lever on a PHEV's running cost, which is exactly
// why the user owns it rather than the code assuming it.
test('battery share materially moves a PHEV total', () => {
  const mostlyElectric = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 80, rates });
  const mostlyPetrol = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 20, rates });
  assert.ok(mostlyPetrol.totalIncGst > mostlyElectric.totalIncGst * 1.15,
    'a 60-point swing in battery share should move the total by more than 15%');
});

test('battery share defaults to fully electric, matching the BEV-only behaviour it replaced', () => {
  assert.deepEqual(
    runningCosts({ vehicle: phev, annualKm: 15000, rates }),
    runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 100, rates })
  );
});

test('an out-of-range battery share is clamped rather than producing negative kilometres', () => {
  const high = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: 140, rates });
  const low = runningCosts({ vehicle: phev, annualKm: 15000, batterySharePct: -20, rates });
  assert.equal(high.petrol, 0);
  assert.equal(low.electricity, 0);
});
