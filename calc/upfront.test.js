import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upfrontQuote } from './upfront.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

const base = {
  driveAwayTotal: 59232,
  termMonths: 48,
  opportunityRatePct: 4.5,
  runningCostsAnnualIncGst: 3762
};

test('cash outlay is the full drive-away price', () => {
  close(upfrontQuote(base).cashOutlay, 59232);
});

test('opportunity cost is the compound return forgone over the term', () => {
  const expected = 59232 * (Math.pow(1.045, 4) - 1);
  close(upfrontQuote(base).opportunityCost, expected);
});

test('a zero return means no opportunity cost', () => {
  close(upfrontQuote({ ...base, opportunityRatePct: 0 }).opportunityCost, 0);
});

test('running costs are paid post-tax across the term', () => {
  const q = upfrontQuote(base);
  close(q.runningCostsTotal, 3762 * 4);
  close(q.netMonthlyRunningCost, 3762 / 12);
});
