import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runningCosts } from './running-costs.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);
const vehicle = { consumptionKwhPer100km: 16, insuranceAnnual: 1850 };
const rates = { electricityCentsPerKwh: 28, otherRunningCostsAnnual: 1240 };

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
