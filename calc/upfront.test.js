import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upfrontQuote, forgoneReturn } from './upfront.js';

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

// --- Forgone return, shared with the loan deposit -------------------------
// Cash priced the opportunity cost of money leaving savings; a loan deposit
// did not, though it is the same money leaving the same savings. The formula
// is exported so both charge it identically rather than growing two copies.

test('forgone return compounds at the opportunity rate over the term', () => {
  const amount = 10000;
  const got = forgoneReturn({ amount, opportunityRatePct: 4.5, termMonths: 60 });
  const expected = amount * (Math.pow(1.045, 5) - 1);
  assert.ok(Math.abs(got - expected) < 1e-9);
});

test('no money withheld means no forgone return', () => {
  assert.equal(forgoneReturn({ amount: 0, opportunityRatePct: 4.5, termMonths: 60 }), 0);
});

test('a zero opportunity rate costs nothing', () => {
  assert.equal(forgoneReturn({ amount: 10000, opportunityRatePct: 0, termMonths: 60 }), 0);
});

test('the cash purchase uses the shared formula', () => {
  const quote = upfrontQuote({
    driveAwayTotal: 59232, termMonths: 60, opportunityRatePct: 4.5,
    runningCostsAnnualIncGst: 3000
  });
  const expected = forgoneReturn({ amount: 59232, opportunityRatePct: 4.5, termMonths: 60 });
  assert.ok(Math.abs(quote.opportunityCost - expected) < 1e-9);
});
